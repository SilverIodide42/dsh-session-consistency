// 集成验证 v2：完整假 React（共享 hook 池 + effect 手动执行 + 真 HTTP API）
import('./plugin/index.js').then(async (m) => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');
  const http = await import('node:http');

  // 1) 真宿主路由
  const routes = [];
  const fakeCtx = { webServer: { register: (r) => { routes.push(r); return () => {}; } }, logger: { warn: () => {} }, effect: (fn) => { fn(); return () => {}; } };
  m.apply(fakeCtx);
  const server = http.createServer((req, res) => {
    const r = routes.find((x) => req.url.startsWith(x.path));
    if (r) r.handler(req, res); else { res.statusCode = 404; res.end(); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;

  // 2) client.js + 完整假 React
  const code = fs.readFileSync('plugin/client.js', 'utf8');
  const saved = {};
  const hooks = [];
  let hookIdx = 0;
  const effects = [];
  const react = {
    createElement(t, p, ...c) { return { t, p, c }; },
    useState(v) {
      const i = hookIdx++;
      if (!hooks[i]) hooks[i] = { v: typeof v === 'function' ? v() : v };
      const box = hooks[i];
      return [box.v, (nv) => { box.v = typeof nv === 'function' ? nv(box.v) : nv; }];
    },
    useEffect(fn) { effects.push(fn); },
    useCallback(f) { return f; },
  };
  const styleTags = [];
  const sandbox = {
    window: { __ModuleLoader__: { load(def) {
      const req = (id) => {
        if (id === 'react') return react;
        if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Button: (props) => ({ t: 'Button', p: props }) };
        throw new Error('unknown ' + id);
      };
      Object.assign(saved, def.factory(req));
    } } },
    navigator: { language: 'zh-CN' }, console,
    fetch: (url) => fetch(`http://127.0.0.1:${port}${url}`),
    document: { querySelector() { return null; }, createElement(tag) { const el = { tagName: tag, dataset: {}, textContent: '' }; styleTags.push(el); return el; }, head: { appendChild() {} } },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'client.js' });
  const render = () => { hookIdx = 0; effects.length = 0; return saved.SessionManagerPanel({}); };

  // 3) 挂载：首渲 + 执行 effects（发 status/plan 请求）→ 等 resolve → 重渲
  render();
  const mountEffects = [...effects];
  for (const e of mountEffects) { try { e(); } catch {} }
  await new Promise((r) => setTimeout(r, 400));
  const treesFinal = render();
  let s = JSON.stringify(treesFinal);

  // 注：假 React.createElement 不调用函数组件；Button 以函数引用挂树（JSON 序列化会丢弃函数，需遍历检测）
  let buttonInTree = false;
  const walk = (n, d) => {
    if (d > 8 || !n || typeof n !== 'object') return;
    if (typeof n.t === 'function' && /props/.test(String(n.t))) buttonInTree = true;
    if (n.c) for (const c of n.c) walk(c, d + 1);
  };
  walk(treesFinal, 0);
  const checks = [
    ['会话页完整(非loading)', !s.includes('dsm-sm_loading')],
    ['toolbar + segmented control', s.includes('dsm-sm_group') && s.includes('dsm-sm_segItem')],
    ['Button 组件通路', buttonInTree],
    ['style 标识唯一正确', styleTags.every((t) => t.dataset.pluginCss === 'dsh-session-manager/panel.css') && styleTags.length >= 1],
    ['统计条（会话页）', s.includes('dsm-sm_stats') && s.includes('dsm-sm_stat')],
    ['行列表', s.includes('dsm-sm_row')],
    ['状态徽章', s.includes('dsm-sm_badge')],
    ['内联布局样式已清零(borderBottom=0)', (s.match(/borderBottom/g) || []).length === 0],
  ];
  let fail = 0;
  for (const [name, ok] of checks) { console.log((ok ? '✔' : '✖'), name); if (!ok) fail++; }
  console.log('style 注入:', styleTags.length, '| pluginCss:', styleTags[0]?.dataset.pluginCss);

  server.close();
  process.exit(fail ? 1 : 0);
}).catch((e) => { console.error('FAIL', e); process.exit(1); });
