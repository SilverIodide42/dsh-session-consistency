// delete-ui-test.cjs — 「清理归档」UI 渲染验证（假 React + 假 fetch，不碰真实数据）
// 断言方式：直接检查序列化渲染树里的标记（避免遍历实现的坑）
const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync(__dirname + '/client.js', 'utf8');

function render(statusValue) {
  return new Promise((resolve) => {
    const boxes = [];
    let hi = 0;
    let effects = [];
    const saved = {};
    const react = {
      createElement(t, p, ...c) { return { t, p, c }; },
      useState(v) {
        const i = hi++;
        if (boxes[i] === undefined) boxes[i] = { v: typeof v === 'function' ? v() : v };
        const b = boxes[i];
        return [b.v, (nv) => { b.v = typeof nv === 'function' ? nv(b.v) : nv; }];
      },
      useEffect(f) { effects.push(f); }, useCallback(f) { return f; },
    };
    const sandbox = {
      window: { __ModuleLoader__: { load(def) {
        const req = (id) => {
          if (id === 'react') return react;
          if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Button: (p) => ({ t: 'Button', p }) };
          throw new Error('unknown ' + id);
        };
        Object.assign(saved, def.factory(req));
      } } },
      navigator: { language: 'zh-CN' },
      console,
      fetch: (url) => Promise.resolve({ json: () => Promise.resolve(
        url.includes('/plan')
          ? { ok: true, value: { targets: [], totals: { sessions: 0, diskBytes: 0 } } }
          : { ok: true, value: statusValue }) }),
      document: { querySelector() { return null; }, createElement(t) { return { tagName: t, dataset: {}, textContent: '' }; }, head: { appendChild() {} } },
    };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'client.js' });
    const doRender = () => { hi = 0; effects = []; const el = saved.SessionConsistencyPanel({}); const e = [...effects]; for (const f of e) { try { f(); } catch {} } return el; };
    doRender();
    setTimeout(() => resolve(JSON.stringify(doRender())), 300);
  });
}

const hiddenSession = (id, title, size) => ({ id, status: 'active', hidden: true, title, onDisk: true, diskSize: size, inCache: true, mtime: Date.now() });

(async () => {
  let pass = 0, fail = 0;
  const check = (name, cond) => { console.log((cond ? '✔' : '✖') + ' ' + name); cond ? pass++ : fail++; };

  const withHidden = await render({
    dshDir: 'X', indexFile: 'Y',
    sessions: [
      hiddenSession('session-aaaa1111-1111-4111-8111-111111111111', 'ARCHIVED_ONE', 1048576),
      hiddenSession('session-bbbb2222-2222-4222-8222-222222222222', 'ARCHIVED_TWO', 2097152),
    ],
    summary: { total: 2, active: 2, archived: 0, tombstone: 0, orphan: 0, missing: 0 },
  });
  // 重构后：单一合并列表（不再有独立的「清理归档」区块与重复勾选框）
  check('永久删除说明文案', withHidden.includes('永久删除勾选的归档会话'));
  check('全选当前筛选结果行存在', withHidden.includes('全选当前筛选结果'));
  check('渲染勾选框（checkbox）', withHidden.includes('"type":"checkbox"'));
  // 结构：全选表头 1 个 + 每个会话 1 个（2 个隐藏会话，无其它） = 3
  check('勾选框总数 = 全选表头(1) + 会话数(2)', (withHidden.match(/"type":"checkbox"/g) || []).length === 3);
  check('统计条取代大卡（含 dsm-sm_stats）', withHidden.includes('dsm-sm_stats'));
  check('隐藏会话数据出现在行内', withHidden.includes('ARCHIVED_ONE') && withHidden.includes('ARCHIVED_TWO'));
  // 重构后删除只在批量条出现（未勾选时不存在），故此处不断言独立删除按钮
  check('搜索框存在', withHidden.includes('"type":"search"'));
  check('搜索提示文案', withHidden.includes('搜索标题或 ID'));

  // 未勾选时批量条不出现（批量删除按钮隐藏）
  check('未勾选时无批量操作条', !withHidden.includes('dsm-sm_batch'));

  const noHidden = await render({
    dshDir: 'X', indexFile: 'Y',
    sessions: [{ id: 'session-cccc3333-3333-4333-8333-333333333333', status: 'active', hidden: false, title: 'NORMAL', onDisk: true, diskSize: 1000, inCache: true, mtime: Date.now() }],
    summary: { total: 1, active: 1, archived: 0, tombstone: 0, orphan: 0, missing: 0 },
  });
  // 无隐藏会话时同样只有合并列表：全选表头 1 + 会话 1 = 2
  const noHiddenCbCount = (noHidden.match(/"type":"checkbox"/g) || []).length;
  check('无隐藏会话时 checkbox = 全选表头(1) + 会话数(1)', noHiddenCbCount === 2);
  check('无隐藏会话时说明仍在', noHidden.includes('永久删除勾选的归档会话'));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
