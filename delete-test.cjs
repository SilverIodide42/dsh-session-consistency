// 删除功能端到端验证（夹具假 .dsh 树，绝不碰真实会话）
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-del-'));
const dsh = path.join(root, 'fake-dsh');
const ID_OK = 'session-aaaa1111-1111-4111-8111-111111111111';   // 归档中 → 应删除
const ID_LIVE = 'session-bbbb2222-2222-4222-8222-222222222222'; // 未归档 → 应拒绝
const ID_MISS = 'session-cccc3333-3333-4333-8333-333333333333'; // 索引陈旧条目

for (const id of [ID_OK, ID_LIVE]) {
  const dir = path.join(dsh, 'sessions', 'ws-k', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'session.v4.jsonl.zstd'), Buffer.alloc(500, 7));
  const pc = path.join(dsh, 'storages', 'session_projcache', 'sessions');
  fs.mkdirSync(pc, { recursive: true });
  fs.writeFileSync(path.join(pc, id + '.json'), JSON.stringify({ record: { identity: { createdAt: Date.now() }, rows: { title: { ver: 1, seq: 1, val: 'T-' + id.slice(8, 14) } } } }));
}
fs.mkdirSync(path.join(dsh, 'storages'), { recursive: true });
fs.writeFileSync(path.join(dsh, 'storages', 'workspace.json'), JSON.stringify({
  global: { defaultWorkspaceId: 'ws-1', archivedSessionIds: [ID_OK, ID_MISS], pinnedSessionIds: [] },
  tables: { workspaces: { 'ws-1': { path: root, title: 'w', sessionIds: [ID_OK, ID_LIVE, ID_MISS] } } },
}, null, 2));

// 用插件模块直接测（设 DSH_HOME 指向夹具）
process.env.DSH_HOME = dsh;
import('./plugin/index.js').then(async (m) => {
  const http = await import('node:http');
  const routes = [];
  const ctx = { webServer: { register: (r) => { routes.push(r); return () => {}; } }, logger: { warn: () => {} }, effect: (fn) => { fn(); return () => {}; } };
  m.apply(ctx);
  const server = http.createServer((req, res) => { const r = routes.find((x) => req.url.startsWith(x.path)); if (r) r.handler(req, res); else { res.statusCode = 404; res.end(); } });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const post = (p, b) => fetch(`http://127.0.0.1:${port}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

  let pass = 0, fail = 0;
  const check = (name, cond) => { console.log((cond ? '✔' : '✖') + ' ' + name); cond ? pass++ : fail++; };

  // 1) dry-run 不删
  const dry = await post('/session-manager/api/delete', { ids: [ID_OK, ID_LIVE] });
  check('dry-run 返回计划', dry.ok && dry.value.dryRun === true);
  check('dry-run 目标只有归档会话', dry.value.targets.length === 1 && dry.value.targets[0].id === ID_OK);
  check('dry-run 拒绝未归档会话', (dry.value.skipped || []).some((s) => s.id === ID_LIVE && s.reason === 'not-archived'));
  check('dry-run 未删文件', fs.existsSync(path.join(dsh, 'sessions', 'ws-k', ID_OK)));

  // 2) apply 真删
  const app = await post('/session-manager/api/delete', { ids: [ID_OK, ID_LIVE], apply: true });
  check('apply 删除 1 个', app.ok && app.value.deleted === 1);
  check('会话目录已删', !fs.existsSync(path.join(dsh, 'sessions', 'ws-k', ID_OK)));
  check('projcache 已删', !fs.existsSync(path.join(dsh, 'storages', 'session_projcache', 'sessions', ID_OK + '.json')));
  const idx = JSON.parse(fs.readFileSync(path.join(dsh, 'storages', 'workspace.json'), 'utf8'));
  check('索引 archived 已清', !idx.global.archivedSessionIds.includes(ID_OK));
  check('索引 sessionIds 已清', !Object.values(idx.tables.workspaces)[0].sessionIds.includes(ID_OK));
  check('未归档会话完好', fs.existsSync(path.join(dsh, 'sessions', 'ws-k', ID_LIVE)));
  check('备份已生成', fs.existsSync(app.value.backupDir) && fs.existsSync(path.join(app.value.backupDir, 'workspace.json.before')));
  check('备份含会话目录', fs.existsSync(path.join(app.value.backupDir, 'sessions', ID_OK)));

  // 3) includeUnhidden 可强制删未归档
  const force = await post('/session-manager/api/delete', { ids: [ID_LIVE], apply: true, includeUnhidden: true });
  check('includeUnhidden 可删未归档', force.ok && force.value.deleted === 1 && !fs.existsSync(path.join(dsh, 'sessions', 'ws-k', ID_LIVE)));

  // 4) 空 ids 报错
  const bad = await post('/session-manager/api/delete', { ids: [] });
  check('空 ids 报 400', bad.ok === false);

  console.log(`\n${pass} passed, ${fail} failed`);
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error('FAIL', e); process.exit(1); });
