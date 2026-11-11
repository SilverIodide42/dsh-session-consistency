/**
 * dsh-session-consistency — host half.
 *
 * Mounts one prefixed HTTP route (/session-consistency/api) on the host
 * webServer and serves the three-location consistency model, the
 * workspace doctor check:
 *
 *   GET  /session-consistency/api/status   → summary + session list
 *   GET  /session-consistency/api/plan     → purge plan (dry-run, no writes)
 *   POST /session-consistency/api/purge    { apply?: boolean, orphans?: boolean }
 *                                      → backup + purge (apply=true) or plan
 *   GET  /session-consistency/api/doctor   → workspace health check (integrated
 *                                        from tools/workspace-doctor; read-only,
 *                                        needs the workspace-doctor libs on disk)
 *   POST /session-consistency/api/archive  { ids: string[], hide?: boolean }
 *                                      → archive (hide=true, default) / unarchive via
 *                                        the host's own workspace RPC (consistency
 *                                        guaranteed by the host, not by us)
 *   POST /session-consistency/api/delete   { ids: string[], apply?: boolean, includeUnhidden?: boolean }
 *                                      → PERMANENT delete: session dirs + projcache + index
 *                                        (archived sessions only unless includeUnhidden;
 *                                        always backs up first; dry-run by default)
 *
 * The route handler follows the dsh-usage-statistics-panel conventions:
 * loopback/trusted-origin fence, JSON envelope { ok, value | error }.
 * Purge ALWAYS backs up first (workspace backup dir), exactly like the CLI.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

export const name = 'dsh-session-consistency'

export const inject = ['webServer']

const SESSION_FILE = 'session.v4.jsonl.zstd'
const PROJCACHE_DIR = path.join('storages', 'session_projcache', 'sessions')
const WORKSPACE_JSON = path.join('storages', 'workspace.json')
// 会话 ID 两种形态：老版 session-<uuid> 与新版裸 <uuid>（2026-10-25 实测 DSH 新建会话无前缀）
const UUID_STR = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const SESSION_ID_RE = new RegExp('^(?:session-)?' + UUID_STR + '$', 'i')
const MAX_BODY_BYTES = 65536

/** Same semantics as @deepseek-ai/dsh-home-paths (DSH_HOME or ~/.dsh). */
function resolveDshHome() {
  const env = process.env.DSH_HOME
  const selected = env !== undefined && env.trim() !== '' ? env : path.join(os.homedir(), '.dsh')
  const expanded = selected === '~' ? os.homedir()
    : selected.startsWith('~/') || selected.startsWith('~\\') ? path.join(os.homedir(), selected.slice(2))
    : selected
  return path.resolve(expanded)
}

// ---------- scanning (ported from the CLI, identical semantics) ----------

function scanSessionDirs(dshDir) {
  const sessionsRoot = path.join(dshDir, 'sessions')
  const out = new Map()
  if (!fs.existsSync(sessionsRoot)) return out
  for (const wsKey of fs.readdirSync(sessionsRoot)) {
    const wsDir = path.join(sessionsRoot, wsKey)
    let st
    try { st = fs.statSync(wsDir) } catch { continue }
    if (!st.isDirectory()) continue
    for (const sid of fs.readdirSync(wsDir)) {
      if (!SESSION_ID_RE.test(sid)) continue
      const sDir = path.join(wsDir, sid)
      let sst
      try { sst = fs.statSync(sDir) } catch { continue }
      if (!sst.isDirectory()) continue
      const f = path.join(sDir, SESSION_FILE)
      let size = null; let mtimeMs = null
      try {
        const fst = fs.statSync(f)
        size = fst.size; mtimeMs = fst.mtimeMs
      } catch { /* dir without the session file still counts */ }
      out.set(sid, { dir: sDir, workspaceKey: wsKey, mtimeMs, size })
    }
  }
  return out
}

function scanProjcache(dshDir) {
  const dir = path.join(dshDir, PROJCACHE_DIR)
  const out = new Map()
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue
    const id = entry.slice(0, -5)
    if (!SESSION_ID_RE.test(id)) continue
    const file = path.join(dir, entry)
    let meta = {}
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'))
      meta.createdAt = j?.record?.identity?.createdAt ?? null
      meta.title = j?.record?.rows?.title?.val ?? null
    } catch { meta.parseError = true }
    let mtimeMs = null
    try { mtimeMs = fs.statSync(file).mtimeMs } catch { /* ignore */ }
    out.set(id, { file, mtimeMs, meta })
  }
  return out
}

function readIndex(dshDir) {
  const file = path.join(dshDir, WORKSPACE_JSON)
  if (!fs.existsSync(file)) return null
  let raw
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')) }
  catch (e) { throw new Error(`workspace.json parse failed: ${e.message}`) }
  const archived = new Set(raw?.global?.archivedSessionIds ?? [])
  const activeMap = new Map()
  for (const ws of Object.values(raw?.tables?.workspaces ?? {})) {
    for (const sid of ws?.sessionIds ?? []) {
      if (!activeMap.has(sid)) activeMap.set(sid, [])
      activeMap.get(sid).push(ws?.title ?? '')
    }
  }
  return { file, raw, archived, activeMap }
}

function buildReport(dshDir) {
  const dirs = scanSessionDirs(dshDir)
  const cache = scanProjcache(dshDir)
  const index = readIndex(dshDir)
  if (!index) return { error: 'workspace.json not found under ' + dshDir }
  const allIds = new Set([...dirs.keys(), ...cache.keys(), ...index.activeMap.keys(), ...index.archived])
  const sessions = []
  for (const id of allIds) {
    const d = dirs.get(id) ?? null
    const c = cache.get(id) ?? null
    const isActive = index.activeMap.has(id)
    const isArchived = index.archived.has(id)
    let status
    if (isActive && (d || c)) status = 'active'
    else if (isActive) status = 'missing'
    else if (isArchived && (d || c)) status = 'archived'
    else if (isArchived) status = 'tombstone'
    else status = 'orphan'
    sessions.push({
      id,
      status,
      // 归档语义（2026-10-25 实测）：archivedSessionIds = GUI 隐藏集；
      // sessionIds 含全部注册会话（含被隐藏的）。hidden = GUI 侧栏不显示。
      hidden: isArchived,
      onDisk: !!d,
      diskSize: d?.size ?? null,
      mtime: d?.mtimeMs ?? c?.mtimeMs ?? null,
      inCache: !!c,
      title: c?.meta?.title ?? null,
      createdAt: c?.meta?.createdAt ?? null,
    })
  }
  sessions.sort((a, b) => (b.mtime ?? 0) - (a.mtime ?? 0))
  const by = k => sessions.filter(s => s.status === k).length
  return {
    dshDir,
    indexFile: index.file,
    sessions,
    summary: {
      total: sessions.length,
      active: by('active'),
      archived: by('archived'),
      tombstone: by('tombstone'),
      orphan: by('orphan'),
      missing: by('missing'),
    },
  }
}

function collectPurgeTargets(report, { includeOrphans = false } = {}) {
  const base = s => s.status === 'archived' || s.status === 'tombstone' || s.status === 'missing'
  return report.sessions.filter(s => base(s) || (includeOrphans && s.status === 'orphan'))
}

function buildPurgePlan(dshDir, { includeOrphans = false } = {}) {
  const report = buildReport(dshDir)
  if (report.error) return report
  const dirs = scanSessionDirs(dshDir)
  const cache = scanProjcache(dshDir)
  const targets = collectPurgeTargets(report, { includeOrphans }).map(s => {
    const d = dirs.get(s.id)
    const c = cache.get(s.id)
    return {
      id: s.id,
      status: s.status,
      title: s.title ?? null,
      diskDir: d?.dir ?? null,
      diskSize: d?.size ?? null,
      cacheFile: c?.file ?? null,
    }
  })
  return {
    dshDir,
    indexFile: report.indexFile,
    targets,
    totals: {
      sessions: targets.length,
      diskBytes: targets.reduce((n, t) => n + (t.diskSize ?? 0), 0),
      dirCount: targets.filter(t => t.diskDir).length,
      cacheCount: targets.filter(t => t.cacheFile).length,
      indexEntries: targets.length,
    },
  }
}

function timeStamp() {
  const d = new Date()
  const p = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Backup root: <workspace>\backup\archived-sessions-<stamp>\ when the index
 *  names a workspace path, else <dsh>\backup\... (same default as the CLI). */
function resolveBackupDir(dshDir, indexFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(indexFile, 'utf8'))
    const defId = raw?.global?.defaultWorkspaceId
    const ws = raw?.tables?.workspaces?.[defId] ?? Object.values(raw?.tables?.workspaces ?? {})[0]
    if (ws?.path) return path.join(ws.path, 'backup', `archived-sessions-${timeStamp()}`)
  } catch { /* fall through */ }
  return path.join(dshDir, 'backup', `archived-sessions-${timeStamp()}`)
}

function backupTarget(t, backupDir) {
  if (t.diskDir) {
    fs.cpSync(t.diskDir, path.join(backupDir, 'sessions', path.basename(t.diskDir)), { recursive: true })
  }
  if (t.cacheFile) {
    const dest = path.join(backupDir, 'projcache', path.basename(t.cacheFile))
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(t.cacheFile, dest)
  }
}

function applyPurge(plan, backupDir) {
  for (const t of plan.targets) backupTarget(t, backupDir)
  fs.mkdirSync(backupDir, { recursive: true })
  fs.copyFileSync(plan.indexFile, path.join(backupDir, 'workspace.json.before'))
  for (const t of plan.targets) {
    if (t.diskDir && fs.existsSync(t.diskDir)) fs.rmSync(t.diskDir, { recursive: true, force: true })
    if (t.cacheFile && fs.existsSync(t.cacheFile)) fs.rmSync(t.cacheFile, { force: true })
  }
  const raw = JSON.parse(fs.readFileSync(plan.indexFile, 'utf8'))
  const ids = new Set(plan.targets.map(t => t.id))
  let removedArchived = 0
  let removedSessionIds = 0
  if (Array.isArray(raw.global?.archivedSessionIds)) {
    const before = raw.global.archivedSessionIds.length
    raw.global.archivedSessionIds = raw.global.archivedSessionIds.filter(x => !ids.has(x))
    removedArchived = before - raw.global.archivedSessionIds.length
  }
  for (const ws of Object.values(raw.tables?.workspaces ?? {})) {
    if (Array.isArray(ws.sessionIds)) {
      const before = ws.sessionIds.length
      ws.sessionIds = ws.sessionIds.filter(x => !ids.has(x))
      removedSessionIds += before - ws.sessionIds.length
    }
  }
  fs.copyFileSync(plan.indexFile, plan.indexFile + '.before')
  fs.writeFileSync(plan.indexFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  return { purged: plan.targets.length, removedArchived, removedSessionIds, backupDir }
}

// ---------- 永久删除（归档会话清理；三处 + 恒先备份） ----------
// 宿主无「持久化删除会话」的公开 RPC（session/delete 只动运行时态，实测三处数据不变），
// 因此由本插件按旧 CLI purge 同款语义执行：会话目录 + projcache + 索引三处，先备份再删。
// 安全护栏：只允许删除「已归档（隐藏中）」的会话；孤儿/活跃会话必须显式 force。

/** 删除计划：{ targets: [{id, status, hidden, diskDir, cacheFile, title, diskSize}], totals } */
function buildDeletePlan(dshDir, ids, { includeUnhidden = false } = {}) {
  const report = buildReport(dshDir)
  if (report.error) return report
  const dirs = scanSessionDirs(dshDir)
  const cache = scanProjcache(dshDir)
  const want = new Set(ids)
  const targets = []
  const skipped = []
  for (const s of report.sessions) {
    if (!want.has(s.id)) continue
    if (!s.hidden && !includeUnhidden) { skipped.push({ id: s.id, reason: 'not-archived' }); continue }
    const d = dirs.get(s.id)
    const c = cache.get(s.id)
    targets.push({
      id: s.id,
      status: s.status,
      hidden: s.hidden,
      title: s.title ?? null,
      diskDir: d?.dir ?? null,
      diskSize: d?.size ?? null,
      cacheFile: c?.file ?? null,
    })
  }
  return {
    dshDir,
    indexFile: path.join(dshDir, WORKSPACE_JSON),
    targets,
    skipped,
    totals: {
      sessions: targets.length,
      diskBytes: targets.reduce((n, t) => n + (t.diskSize ?? 0), 0),
      dirCount: targets.filter(t => t.diskDir).length,
      cacheCount: targets.filter(t => t.cacheFile).length,
      // 无磁盘/无缓存的纯索引残留（missing/tombstone）——删除它们只清索引条目，释放 0 字节
      indexOnly: targets.filter(t => !t.diskDir && !t.cacheFile).length,
    },
  }
}

function applyDelete(plan, backupDir) {
  for (const t of plan.targets) backupTarget(t, backupDir)
  fs.mkdirSync(backupDir, { recursive: true })
  fs.copyFileSync(plan.indexFile, path.join(backupDir, 'workspace.json.before'))
  let removedDirs = 0
  let removedCache = 0
  for (const t of plan.targets) {
    if (t.diskDir && fs.existsSync(t.diskDir)) { fs.rmSync(t.diskDir, { recursive: true, force: true }); removedDirs += 1 }
    if (t.cacheFile && fs.existsSync(t.cacheFile)) { fs.rmSync(t.cacheFile, { force: true }); removedCache += 1 }
  }
  const raw = JSON.parse(fs.readFileSync(plan.indexFile, 'utf8'))
  const ids = new Set(plan.targets.map(t => t.id))
  let removedArchived = 0
  let removedSessionIds = 0
  if (Array.isArray(raw.global?.archivedSessionIds)) {
    const before = raw.global.archivedSessionIds.length
    raw.global.archivedSessionIds = raw.global.archivedSessionIds.filter(x => !ids.has(x))
    removedArchived = before - raw.global.archivedSessionIds.length
  }
  for (const ws of Object.values(raw.tables?.workspaces ?? {})) {
    if (Array.isArray(ws.sessionIds)) {
      const before = ws.sessionIds.length
      ws.sessionIds = ws.sessionIds.filter(x => !ids.has(x))
      removedSessionIds += before - ws.sessionIds.length
    }
  }
  fs.writeFileSync(plan.indexFile, JSON.stringify(raw, null, 2) + '\n', 'utf8')
  return {
    deleted: plan.targets.length,
    removedDirs,
    removedCache,
    removedArchived,
    removedSessionIds,
    backupDir,
  }
}

// ---------- doctor (integrated from tools/workspace-doctor) ----------

/** 默认工作区根（defaultWorkspaceId 的 path，失败取第一个存在的） */
function resolveWorkspaceRoot(dshDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dshDir, WORKSPACE_JSON), 'utf8'))
    const defId = raw?.global?.defaultWorkspaceId
    const wsList = Object.values(raw?.tables?.workspaces ?? {})
    const ws = raw?.tables?.workspaces?.[defId] ?? wsList[0]
    if (ws?.path && fs.existsSync(ws.path)) return ws.path
  } catch { /* fall through */ }
  return null
}

/** 动态加载 tools/workspace-doctor 的 lib（工作区里存在时）；缓存 import 结果。
 *  找不到时返回 null（面板显示"需要 workspace-doctor"）。 */
const doctorLibCache = new Map()
async function loadDoctorLib(root) {
  if (doctorLibCache.has(root)) return doctorLibCache.get(root)
  let lib = null
  try {
    const base = path.join(root, 'tools', 'workspace-doctor', 'lib')
    const asUrl = (p) => pathToFileURL(p).href
    const [disk, dupes, docs, house] = await Promise.all([
      import(asUrl(path.join(base, 'disk.mjs'))),
      import(asUrl(path.join(base, 'dupes.mjs'))),
      import(asUrl(path.join(base, 'docs.mjs'))),
      import(asUrl(path.join(base, 'housekeeping.mjs'))),
    ])
    lib = {
      scanDisk: disk.scanDisk,
      DEFAULT_SKIP: disk.DEFAULT_SKIP,
      findDupes: dupes.findDupes,
      checkDocs: docs.checkDocs,
      scanBackups: house.scanBackups,
      scanTmp: house.scanTmp,
      buildFindings: house.buildFindings,
      healthScore: house.healthScore,
    }
  } catch { lib = null }
  doctorLibCache.set(root, lib)
  return lib
}

async function runDoctor(dshDir, { skip = [] } = {}) {
  const root = resolveWorkspaceRoot(dshDir)
  if (!root) return { error: 'workspace root not found in workspace.json' }
  const lib = await loadDoctorLib(root)
  if (!lib) {
    return { error: `workspace-doctor libs not found under ${root}\\tools\\workspace-doctor\\lib (install tools/workspace-doctor in the workspace, or use the CLI doctor command)` }
  }
  const skipAll = [...lib.DEFAULT_SKIP, ...skip]
  const disk = await lib.scanDisk(root, { skip: skipAll })
  const dupes = await lib.findDupes(disk.files, {})
  const docs = await lib.checkDocs(disk.files, root)
  const backups = await lib.scanBackups(path.join(root, 'backup'))
  const tmp = await lib.scanTmp(path.join(root, 'tmp'))
  const findings = lib.buildFindings({ disk: { ...disk, skip: skipAll }, dupes, docs, backups, tmp })
  const score = lib.healthScore(findings)
  const { files: _files, ...diskNoFiles } = disk
  void _files
  return {
    workspace: root,
    score,
    findings,
    disk: diskNoFiles,
    dupes: { groups: dupes.groups.slice(0, 20), wastedTotal: dupes.wastedTotal, groupCount: dupes.groups.length },
    docs: { checkedDocs: docs.checkedDocs, refCount: docs.refs.length, okCount: docs.okCount, broken: docs.broken.slice(0, 30), brokenCount: docs.broken.length },
    backups,
    tmp,
  }
}

// ---------- archive / unarchive（GUI 归档管理；走宿主官方 RPC，由宿主保证索引一致性） ----------

/** DSH_HOME 语义与 resolveDshHome 一致；http 端口从运行中宿主的环境里取不到，
 *  因此复用宿主 webServer 的实际监听端口：插件与宿主同进程，直接从 ctx 拿不到，
 *  退而求其次：宿主 RPC 也可用进程内 service 调用——但插件拿不到 workspaceController
 *  句柄，所以走 loopback HTTP。端口由首次请求时自动探测（默认端口写死会随启动漂移）。 */
let hostBase = null
function detectHostBase(ctx) {
  if (hostBase) return hostBase
  // DSH web GUI 端口每次启动不同；从 webServer 插件上下文里找监听端口
  const candidates = []
  if (ctx?.webServer?.port) candidates.push(ctx.webServer.port)
  if (ctx?.webServer?.address) { try { const a = ctx.webServer.address(); if (a?.port) candidates.push(a.port) } catch { /* ignore */ } }
  if (process.env.DSH_PORT) candidates.push(Number(process.env.DSH_PORT))
  if (process.env.DSH_WEB_URL) { try { candidates.push(new URL(process.env.DSH_WEB_URL).port) } catch { /* ignore */ } }
  hostBase = candidates.length ? `http://127.0.0.1:${candidates[0]}` : null
  return hostBase
}

/** 手铸 dsh-auth cookie（与宿主同款 HMAC，凭 .credentials.yaml 的 browser-session secret） */
function mintCookie(base) {
  const { createHash, createHmac } = createRequire(import.meta.url)('node:crypto')
  const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
  const raw = fs.readFileSync(credPath, 'utf8')
  const keyIdx = raw.indexOf('client-connection/browser-session')
  const m = keyIdx >= 0 ? raw.slice(keyIdx).match(/secret:\s*([A-Za-z0-9_-]+)\s/) : null
  if (!m) throw new Error('browser-session secret not found in .credentials.yaml')
  const secret = Buffer.from(m[1].replaceAll('-', '+').replaceAll('_', '/'), 'base64')
  const b64u = (b) => Buffer.from(b).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
  const authority = new URL(base).host
  const cookieName = 'dsh-auth-' + b64u(createHash('sha256').update(authority).digest())
  const now = Date.now()
  const body = b64u(JSON.stringify({ version: 1, authority, issuedAt: now, expiresAt: now + 3600_000 }))
  const sig = b64u(createHmac('sha256', secret).update(body).digest())
  return `${cookieName}=v1.${body}.${sig}`
}

async function hostRpc(ctx, method, request) {
  const base = detectHostBase(ctx)
  if (!base) throw new Error('host web server port unknown')
  const cookie = mintCookie(base)
  const r = await fetch(`${base}/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie, origin: base },
    body: JSON.stringify({ type: 'client-request', rpcId: 'sm-' + Date.now(), method, payload: { args: { request } } }),
  })
  const j = await r.json().catch(() => null)
  const result = j?.result
  if (!result?.ok) {
    const msg = result?.error?.message ?? `host rpc ${method} failed (${r.status})`
    throw new Error(msg)
  }
  return result.value
}

/** 归档/恢复一批会话（走宿主官方 workspace/archiveSession|unarchiveSession，一致性由宿主保证）
 *  hide=true 时可选 stopActivity：宿主会先请求停止该会话的运行工作（turn/子代理/后台任务/定时）
 *  而不是以 workspace/session-active 拒绝归档。 */
async function setArchived(ctx, ids, hide, stopActivity = false) {
  const method = hide ? 'workspace/archiveSession' : 'workspace/unarchiveSession'
  const results = []
  for (const id of ids) {
    try {
      await hostRpc(ctx, method, hide ? { sessionId: id, stopActivity } : { sessionId: id })
      results.push({ id, ok: true })
    } catch (e) {
      results.push({ id, ok: false, error: e.message })
    }
  }
  return { changed: results.filter(r => r.ok).length, results }
}

// ---------- HTTP layer ----------

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

function writeJson(res, value, status = 200) {
  res.statusCode = status
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(value))
}

function writeError(res, err) {
  const status = err instanceof ApiError ? err.status : 500
  writeJson(res, { ok: false, error: { message: err instanceof ApiError ? err.message : 'internal error' } }, status)
}

async function readJsonBody(req) {
  let body = ''
  let bytes = 0
  for await (const chunk of req) {
    bytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.byteLength
    if (bytes > MAX_BODY_BYTES) throw new ApiError(413, 'request body too large')
    body += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
  }
  if (body === '') return {}
  try { return JSON.parse(body) }
  catch { throw new ApiError(400, 'invalid json body') }
}

/** Loopback host fence (same shape as the official one, simplified for the
 *  panel's own prefix route): loopback host, no cross-site fetch, same-origin
 *  when Origin is present. */
function isLoopback(hostname) {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4 && parts[0] === '127'
    && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255)
}

function isTrusted(req) {
  const host = req.headers.host
  if (!host) return false
  try {
    const url = new URL(`http://${host}`)
    if (!isLoopback(url.hostname)) return false
  } catch { return false }
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site === 'cross-site') return false
  const origin = req.headers.origin
  if (origin === undefined) return true
  try { return new URL(origin).host === host } catch { return false }
}

function buildRoute(ctx) {
  const handler = async (req, res) => {
    if (!isTrusted(req)) return writeJson(res, { ok: false, error: { message: 'untrusted host' } }, 403)
    const routePath = (req.url ?? '').split(/[?#]/, 1)[0]
    const method = req.method ?? 'GET'
    const dshHome = resolveDshHome()
    try {
      // The handler receives the FULL url (host prefix semantics: req.url
      // keeps /session-consistency/api), same as the usage panel's route.
      if (method === 'GET' && routePath === '/session-consistency/api/status') {
        const report = buildReport(dshHome)
        if (report.error) throw new ApiError(500, report.error)
        return writeJson(res, { ok: true, value: report })
      }
      if (method === 'GET' && routePath === '/session-consistency/api/plan') {
        const plan = buildPurgePlan(dshHome, { includeOrphans: false })
        if (plan.error) throw new ApiError(500, plan.error)
        return writeJson(res, { ok: true, value: plan })
      }
      if (method === 'POST' && routePath === '/session-consistency/api/purge') {
        const body = await readJsonBody(req)
        const includeOrphans = body?.orphans === true
        const plan = buildPurgePlan(dshHome, { includeOrphans })
        if (plan.error) throw new ApiError(500, plan.error)
        if (plan.targets.length === 0) {
          return writeJson(res, { ok: true, value: { purged: 0, nothingToDo: true } })
        }
        if (body?.apply !== true) {
          return writeJson(res, { ok: true, value: { dryRun: true, ...plan } })
        }
        const backupDir = resolveBackupDir(dshHome, plan.indexFile ?? path.join(dshHome, WORKSPACE_JSON))
        const result = applyPurge(plan, backupDir)
        return writeJson(res, { ok: true, value: result })
      }
      if (method === 'GET' && routePath === '/session-consistency/api/doctor') {
        const report = await runDoctor(dshHome)
        if (report.error) throw new ApiError(500, report.error)
        return writeJson(res, { ok: true, value: report })
      }
      if (method === 'POST' && routePath === '/session-consistency/api/archive') {
        const body = await readJsonBody(req)
        const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === 'string') : []
        if (ids.length === 0) throw new ApiError(400, 'ids[] required')
        if (ids.length > 100) throw new ApiError(400, 'too many ids (max 100)')
        const value = await setArchived(ctx, ids, body?.hide !== false, body?.stopActivity !== false)
        return writeJson(res, { ok: true, value })
      }
      // 永久删除（仅归档会话；dry-run 默认，apply 才真删，恒先备份）
      if (method === 'POST' && routePath === '/session-consistency/api/delete') {
        const body = await readJsonBody(req)
        const ids = Array.isArray(body?.ids) ? body.ids.filter((x) => typeof x === 'string') : []
        if (ids.length === 0) throw new ApiError(400, 'ids[] required')
        if (ids.length > 200) throw new ApiError(400, 'too many ids (max 200)')
        const plan = buildDeletePlan(dshHome, ids, { includeUnhidden: body?.includeUnhidden === true })
        if (plan.error) throw new ApiError(500, plan.error)
        if (body?.apply !== true) {
          return writeJson(res, { ok: true, value: { dryRun: true, ...plan } })
        }
        if (plan.targets.length === 0) {
          return writeJson(res, { ok: true, value: { deleted: 0, nothingToDo: true, skipped: plan.skipped } })
        }
        const backupDir = resolveBackupDir(dshHome, plan.indexFile)
        const value = applyDelete(plan, backupDir)
        return writeJson(res, { ok: true, value })
      }
      return writeJson(res, { ok: false, error: { message: `unknown endpoint ${method} ${routePath}` } }, 404)
    } catch (err) {
      ctx.logger?.warn?.(err instanceof Error ? err : new Error(String(err)))
      return writeError(res, err)
    }
  }
  return { kind: 'prefix', path: '/session-consistency/api', handler }
}

export function apply(ctx) {
  ctx.effect(() => {
    const route = buildRoute(ctx)
    return ctx.webServer.register(route)
  }, 'dsh-session-consistency: routes')
}
