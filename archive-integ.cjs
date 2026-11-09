// 集成验证：插件的 /api/archive 走真宿主 RPC（归档→恢复往返，复原现场）
import('./plugin/index.js').then(async (m) => {
  const http = await import('node:http');
  const routes = [];
  const ctx = { webServer: { register: (r) => { routes.push(r); return () => {}; } }, logger: { warn: () => {} }, effect: (fn) => { fn(); return () => {}; } };
  m.apply(ctx);
  const server = http.createServer((req, res) => { const r = routes.find((x) => req.url.startsWith(x.path)); if (r) r.handler(req, res); else { res.statusCode = 404; res.end(); } });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  const post = (p, b) => fetch(`http://127.0.0.1:${port}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());

  // 选一个当前「显示中」的会话做实验
  const s = await (await fetch(`http://127.0.0.1:${port}/session-manager/api/status`)).json();
  const target = s.value.sessions.find((x) => x.status === 'active' && !x.hidden);
  if (!target) { console.log('无可用实验对象'); server.close(); return; }
  console.log('实验对象:', target.id.slice(0, 34), '| hidden:', target.hidden);

  // 归档（隐藏）
  const a1 = await post('/session-manager/api/archive', { ids: [target.id], hide: true });
  console.log('archive →', a1.ok ? 'ok' : JSON.stringify(a1), '| changed:', a1.value?.changed);
  const s2 = await (await fetch(`http://127.0.0.1:${port}/session-manager/api/status`)).json();
  const after1 = s2.value.sessions.find((x) => x.id === target.id);
  console.log('  归档后 hidden:', after1.hidden);

  // 恢复
  const a2 = await post('/session-manager/api/archive', { ids: [target.id], hide: false });
  console.log('unarchive →', a2.ok ? 'ok' : JSON.stringify(a2), '| changed:', a2.value?.changed);
  const s3 = await (await fetch(`http://127.0.0.1:${port}/session-manager/api/status`)).json();
  const after2 = s3.value.sessions.find((x) => x.id === target.id);
  console.log('  恢复后 hidden:', after2.hidden);

  const pass = a1.ok && a2.ok && after1.hidden === true && after2.hidden === false;
  console.log(pass ? '✅ 归档管理闭环通过' : '❌ 失败');
  server.close();
  process.exit(pass ? 0 : 1);
}).catch((e) => { console.error('FAIL', e.message); process.exit(1); });
