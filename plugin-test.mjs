// plugin-test.mjs — 插件宿主半身的功能级测试（假 webServer 上下文 + 真 HTTP + 假 .dsh 树）
//
// 覆盖：
//  1. apply() 在假 ctx 上注册 prefix 路由，effect 返回清理函数
//  2. GET /status 返回五状态摘要（夹具树：2 active + 1 archived + 1 tombstone + 1 orphan + 1 missing）
//  3. GET /plan 只读
//  4. POST /purge {} → dry-run 计划（不改文件）
//  5. POST /purge {apply:true} → 备份 + 清理，三方一致
//  6. POST /purge {apply:true, orphans:true} → 孤儿也清，完全一致
//  7. 403 围栏：非本机 Host 头被拒
//  8. 404 未知端点
//
// 运行：node plugin-test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN = path.join(__dirname, 'plugin', 'index.js');

let root, dsh, server, baseUrl, route;

const ID = {
  a1: 'session-11111111-1111-4111-8111-111111111111',
  a2: 'session-22222222-2222-4222-8222-222222222222',
  ar: 'session-33333333-3333-4333-8333-333333333333',
  tb: 'session-44444444-4444-4444-8444-444444444444',
  or: 'session-55555555-5555-4555-8555-555555555555',
  ms: 'session-66666666-6666-4666-8666-666666666666',
};

function mkSessionDir(id, size = 100) {
  const dir = path.join(dsh, 'sessions', 'ws-key-1', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), Buffer.alloc(size, 7));
}
function mkProjcache(id, title = 't-' + id.slice(8, 14)) {
  const dir = path.join(dsh, 'storages', 'session_projcache', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({
    version: 7,
    record: { identity: { formatVersion: 4, createdAt: Date.now() }, rows: { title: { ver: 1, seq: 1, val: title } } },
  }));
}
function mkIndex() {
  const file = path.join(dsh, 'storages', 'workspace.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, defaultWorkspaceId: 'ws-1', workspaceIds: ['ws-1'], archivedSessionIds: [ID.ar, ID.tb], pinnedSessionIds: [] },
    tables: { workspaces: { 'ws-1': { path: path.join(root, 'fake-workspace'), title: 'fake-ws', sessionIds: [ID.a1, ID.a2, ID.ms], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' } } },
  }, null, 2));
}

const API = '/session-manager/api';
function get(p, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(baseUrl + API + p, { headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}
function post(p, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(baseUrl + API + p, { method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), ...headers } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end(data);
  });
}
const j = r => JSON.parse(r.body);

async function startServer() {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    // 真实 host 的 prefix 语义：handler 收到完整 URL，不做剥离
    if (p.startsWith(route.path)) {
      route.handler(req, res);
      return;
    }
    res.statusCode = 404; res.end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
}

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsm-plugin-'));
  dsh = path.join(root, 'fake-dsh');
  // 夹具：同 CLI 测试的状态矩阵
  mkSessionDir(ID.a1, 1000); mkProjcache(ID.a1, '活跃A');
  mkSessionDir(ID.a2, 500);  mkProjcache(ID.a2, '活跃B');
  mkSessionDir(ID.ar, 2000); mkProjcache(ID.ar, '归档残留');
  mkSessionDir(ID.or, 300);  mkProjcache(ID.or, '孤儿');
  mkIndex();
  process.env.DSH_HOME = dsh; // 宿主半身经 resolveDshHome() 读它
  const mod = await import('file://' + PLUGIN.replace(/\\/g, '/'));
  assert.equal(mod.name, 'dsh-session-consistency');
  assert.deepEqual(mod.inject, ['webServer']);
  const registered = [];
  const ctx = {
    logger: console,
    effect(fn) { return fn(); }, // 立即执行，忽略清理（测试进程退出即释放）
    webServer: { register(r) { registered.push(r); return () => {}; } },
  };
  mod.apply(ctx);
  assert.equal(registered.length, 1, '应注册恰好 1 条路由');
  route = registered[0];
  assert.equal(route.kind, 'prefix');
  assert.equal(route.path, '/session-manager/api');
  await startServer();
});

after(() => {
  process.env.DSH_HOME = undefined;
  try { server?.close(); } catch { /* ignore */ }
  try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* Windows 句柄延迟 */ }
});

test('GET /status 返回五状态摘要', async () => {
  const r = j(await get('/status'));
  assert.equal(r.ok, true);
  assert.equal(r.value.summary.active, 2);
  assert.equal(r.value.summary.archived, 1);
  assert.equal(r.value.summary.tombstone, 1);
  assert.equal(r.value.summary.orphan, 1);
  assert.equal(r.value.summary.missing, 1);
  assert.equal(r.value.summary.total, 6);
});

test('GET /plan 只读，含 totals', async () => {
  const before = fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8');
  const r = j(await get('/plan'));
  assert.equal(r.ok, true);
  assert.equal(r.value.targets.length, 3); // ar + tb + ms（不含 orphan）
  assert.equal(r.value.totals.sessions, 3);
  assert.equal(r.value.totals.dirCount, 1); // 只有 ar 有目录
  assert.equal(fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8'), before, 'plan 不得改动文件');
});

test('POST /purge {} 默认 dry-run，不改文件', async () => {
  const idxBefore = fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8');
  const r = j(await post('/purge', {}));
  assert.equal(r.ok, true);
  assert.equal(r.value.dryRun, true);
  assert.equal(r.value.targets.length, 3);
  assert.equal(fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8'), idxBefore);
  assert.ok(fs.existsSync(path.join(dsh, 'sessions', 'ws-key-1', ID.ar)), 'dry-run 不得删除目录');
});

test('POST /purge {apply:true} 备份 + 清理（默认不含孤儿）', async () => {
  const r = j(await post('/purge', { apply: true }));
  assert.equal(r.ok, true);
  assert.equal(r.value.purged, 3);
  // 三处验证
  assert.ok(!fs.existsSync(path.join(dsh, 'sessions', 'ws-key-1', ID.ar)));
  assert.ok(!fs.existsSync(path.join(dsh, 'storages', 'session_projcache', 'sessions', ID.ar + '.json')));
  const idx = JSON.parse(fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8'));
  assert.equal(idx.global.archivedSessionIds.length, 0);
  assert.ok(!idx.tables.workspaces['ws-1'].sessionIds.includes(ID.ms));
  assert.ok(idx.tables.workspaces['ws-1'].sessionIds.includes(ID.a1), '活跃会话不得被清');
  // 备份验证
  const backupDir = r.value.backupDir;
  assert.ok(fs.existsSync(path.join(backupDir, 'sessions', ID.ar)));
  assert.ok(fs.existsSync(path.join(backupDir, 'projcache', ID.ar + '.json')));
  assert.ok(fs.existsSync(path.join(backupDir, 'workspace.json.before')));
});

test('POST /purge {apply:true, orphans:true} 连孤儿清，完全一致', async () => {
  const r = j(await post('/purge', { apply: true, orphans: true }));
  assert.equal(r.value.purged, 1);
  assert.ok(!fs.existsSync(path.join(dsh, 'sessions', 'ws-key-1', ID.or)));
  const r2 = j(await get('/status'));
  assert.equal(r2.value.summary.total, 2); // 只剩 a1 a2
  assert.equal(r2.value.summary.active, 2);
});

test('非本机 Host → 403', async () => {
  const r = await get('/status', { host: 'evil.example.com' });
  assert.equal(r.status, 403);
  assert.equal(j(r).ok, false);
});

test('cross-site sec-fetch-site → 403', async () => {
  const r = await get('/status', { 'sec-fetch-site': 'cross-site' });
  assert.equal(r.status, 403);
});

test('未知端点 → 404', async () => {
  const r = await get('/nope');
  assert.equal(r.status, 404);
  assert.equal(j(r).ok, false);
});
