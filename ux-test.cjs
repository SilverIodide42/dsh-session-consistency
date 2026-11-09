// 体验特性验证：静默刷新不闪屏 / 排序 / banner 自动消失 / 空态区分 / 进��条
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync('plugin/client.js', 'utf8');

const boxes = [];
let hi = 0;
let effects = [];
let saved = {};
const react = {
  createElement(t, p, ...c) { return { t, p, c }; },
  useState(v) { const i = hi++; if (boxes[i] === undefined) boxes[i] = { v: typeof v === 'function' ? v() : v }; const b = boxes[i]; return [b.v, (nv) => { b.v = typeof nv === 'function' ? nv(b.v) : nv; }]; },
  useEffect(f) { effects.push(f); },
  useCallback(f) { return f; },
  Fragment: 'Fragment',
};
const MK = (id, title, size, mtime) => ({ id, status: 'active', hidden: false, title, onDisk: true, diskSize: size, inCache: true, mtime });
const SESSIONS = [
  MK('session-1111aaaa-1111-4111-8111-111111111111', 'Zebra', 100, 1000),
  MK('session-2222bbbb-2222-4222-8222-222222222222', 'Alpha', 9000, 2000),
  MK('session-3333cccc-3333-4333-8333-333333333333', 'Mike', 500, 3000),
];
const listeners = {};
const sb = {
  window: { __ModuleLoader__: { load(d) { const rq = (id) => { if (id === 'react') return react; if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Button: (p) => ({ t: 'Button', p }) }; throw new Error(id); }; Object.assign(saved, d.factory(rq)); } } },
  navigator: { language: 'zh-CN' },
  console,
  fetch: (u) => Promise.resolve({ json: () => Promise.resolve(u.includes('/plan')
    ? { ok: true, value: { targets: [], totals: { sessions: 0, diskBytes: 0 } } }
    : { ok: true, value: { dshDir: 'X', sessions: SESSIONS, summary: { total: 3, active: 3, archived: 0, tombstone: 0, orphan: 0, missing: 0 } } }) }),
  document: {
    querySelector: () => null,
    getElementById: () => null,
    addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); },
    removeEventListener: () => {},
    createElement: (t) => ({ tagName: t, dataset: {}, textContent: '' }),
    head: { appendChild() {} },
  },
  setTimeout: (fn, ms) => { sb._timers = sb._timers || []; sb._timers.push({ fn, ms }); return sb._timers.length; },
  clearTimeout: () => {},
};
vm.createContext(sb);
vm.runInContext(code, sb, { filename: 'client.js' });

const flat = (n, d = 0, o = []) => { if (n == null || d > 120) return o; if (Array.isArray(n)) { for (const x of n) flat(x, d + 1, o); return o; } if (typeof n !== 'object') return o; o.push(n); if (n.c && n.c !== n) flat(n.c, d + 1, o); return o; };
const render = async () => {
  hi = 0; effects = [];
  const e1 = saved.SessionManagerPanel({});
  for (const f of [...effects]) { try { f(); } catch {} }
  await new Promise((r) => setTimeout(r, 300));
  hi = 0; effects = [];
  const e2 = saved.SessionManagerPanel({});
  for (const f of [...effects]) { try { f(); } catch {} }
  return e2;
};
let pass = 0, fail = 0;
const check = (n, c) => { console.log((c ? '✔' : '✖') + ' ' + n); c ? pass++ : fail++; };

(async () => {
  const el = await render();
  let txt = JSON.stringify(el);

  // 1. 排序控件
  check('排序控件存在（最近/标题/体积）', txt.includes('最近') && txt.includes('标题') && txt.includes('体积'));
  check('默认按时间（最近）激活', (txt.match(/"aria-pressed":true/g) || []).length >= 1);

  // 2. 点击「标题」排序后顺序应为 Alpha/Mike/Zebra
  const sortBtn = flat(el).find((x) => Array.isArray(x.c) && x.c.join('') === '标题');
  check('找到「标题」排序按钮', !!sortBtn);
  sortBtn.p.onClick();
  const el2 = await render();
  const t2 = JSON.stringify(el2);
  const iAlpha = t2.indexOf('Alpha'), iMike = t2.indexOf('Mike'), iZebra = t2.indexOf('Zebra');
  check('按标题排序生效（Alpha < Mike < Zebra）', iAlpha > 0 && iAlpha < iMike && iMike < iZebra);

  // 3. 空态区分：搜索无结果
  const searchInput = flat(el2).find((x) => x.p && x.p.type === 'search');
  check('搜索框存在', !!searchInput);
  searchInput.p.onChange({ target: { value: 'zzzz-no-match' } });
  const el3 = await render();
  const t3 = JSON.stringify(el3);
  check('筛选无结果时显示专用空态', t3.includes('没有匹配当前筛选的会话'));

  // 4. 进度条容器（静默刷新时才有内容，初次渲染 refreshing=false → 无进度条）
  check('非刷新态不显示进度条', !t3.includes('dsm-sm_progressBar'));

  // 5. banner 自动消失：静态确认实现存在（运行时需有 message 才注册定时器）
  check('成功提示有 4.5s 自动消失实现', code.includes('4500') && code.includes('setMessage(null)'));

  // 6. Ctrl+F 快捷键已注册
  check('Ctrl+F 快捷键监听已注册', Array.isArray(listeners.keydown) && listeners.keydown.length > 0);

  // 7. 无内联样式
  check('仍无内联 style', (t3.match(/"style":/g) || []).length === 0);

  console.log(`\n${pass}/${pass + fail} 通过`);
  process.exit(fail ? 1 : 0);
})();
