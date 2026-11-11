// client-smoke.mjs — 浏览器半身的加载冒烟测试（假 ModuleLoader + 假 React + 假 slots ctx）
//
// 覆盖：
//  1. window.__ModuleLoader__.load 工厂可执行，导出 apply/inject/PANEL_ID
//  2. apply() 在最小假 ctx（slots.inject + locale + layout）上注册三个 slot（plugins.bundle.config / main / sidebar.panellist）
//  3. SessionConsistencyPanel 用假 React.createElement 可渲染（不崩）
//  4. 假 Button 被引用（require('@deepseek-ai/dsh-client-ui-primitives') 通路正常）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const code = fs.readFileSync(path.join(__dirname, 'client.js'), 'utf8');

function makeEnv() {
  const buttonUsed = { count: 0 };
  const created = [];
  const FakeReact = {
    createElement(type, props, ...children) {
      created.push({ type, props, children });
      return { type, props, children };
    },
    useState(v) { return [typeof v === 'function' ? v() : v, () => {}]; },
    useEffect() { return undefined; },
    useCallback(fn) { return fn; },
  };
  const modules = {
    react: FakeReact,
    '@deepseek-ai/dsh-client-ui-primitives': {
      Button: function Button(props) { buttonUsed.count++; return { type: 'Button', props }; },
    },
  };
  const loaded = [];
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(def) { loaded.push(def.id); def.factory(id => {
          if (!(id in modules)) throw new Error('unknown module: ' + id);
          return modules[id];
        }); },
      },
    },
    navigator: { language: 'zh-CN' },
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'client.js' });
  // 工厂已执行；通过再次加载拿 exports —— ModuleLoader 只能跑一次，改用直接 require 形式：
  return { sandbox, loaded, buttonUsed, created, FakeReact, modules };
}

test('工厂可执行且注册 id 正确', () => {
  const { loaded } = makeEnv();
  assert.deepEqual(loaded, ['dsh-session-consistency']);
});

test('apply() 在假 ctx 上注册三个 slot，且面板可渲染', () => {
  // 第二个环境：捕获 exports + 捕获注入的 <style>
  const saved = {};
  const styleTags = [];
  // 可写假 React：useState setter 立即改值并重渲染一次（够驱动 loading→loaded）
  function makeFakeReact(renderPanel) {
    let renderFn = null;
    const fake = {
      createElement(t, p, ...c) { return { t, p, c }; },
      useState(v) {
        const box = { v: typeof v === 'function' ? v() : v };
        const setter = (nv) => { box.v = typeof nv === 'function' ? nv(box.v) : nv; if (renderFn) renderFn(); };
        return [box.v, setter];
      },
      useEffect() {}, useCallback(f) { return f; },
    };
    return fake;
  }
  let panelFactory = null;
  const react = makeFakeReact(() => { if (panelFactory) lastTree = panelFactory({}); });
  let lastTree = null;
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load(def) {
          const req = id => {
            if (id === 'react') return react;
            if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Button: props => ({ t: 'Button', p: props }) };
            throw new Error('unknown ' + id);
          };
          // 真实签名：factory(require)，工厂内部自建 module 并 return module.exports
          const returned = def.factory(req);
          Object.assign(saved, returned);
        },
      },
    },
    navigator: { language: 'zh-CN' },
    console,
    fetch: () => new Promise(() => {}), // 挂起态：loading=true 分支
    // 假 DOM：面板渲染时 ensureCss() 应注入一个 style 标签
    document: {
      querySelector() { return null; },
      createElement(tag) {
        const el = { tagName: tag, dataset: {}, textContent: '' };
        styleTags.push(el);
        return el;
      },
      head: { appendChild(el) { /* captured in styleTags */ } },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'client.js' });

  assert.equal(typeof saved.apply, 'function');
  assert.equal(JSON.stringify(saved.inject), JSON.stringify(['slots', 'locale', 'layout']));
  assert.equal(saved.PANEL_ID, 'session-consistency');

  // 假 slots ctx
  const injected = [];
  const registered = [];
  const ctx = {
    effect(fn) { return () => {}; },
    locale: {
      register() { return () => {}; },
      bind() { return k => k; },
    },
    layout: {
      panelInfo: { getSnapshot: () => ({ activePanelId: null }), subscribe: () => () => {} },
      selectPanel() {},
    },
    slots: {
      inject(name, install) { injected.push(name); registered.push(install()); },
      register(opts, comp) { return () => {}; },
    },
  };
  saved.apply(ctx);
  assert.equal(JSON.stringify(injected.slice().sort()), JSON.stringify(['main', 'plugins.bundle.config', 'sidebar.panellist']));

  // 面板渲染冒烟：loading=true（fetch 挂起）→ loading 分支也带 dsm-sm 类
  panelFactory = saved.SessionConsistencyPanel;
  const el = saved.SessionConsistencyPanel({});
  assert.ok(el);
  assert.ok(JSON.stringify(el).includes('dsm-sm_loading') || JSON.stringify(el).includes('dsm-sm-page'), '渲染树根为 dsm-sm 类');

  // dsh 风格断言：scoped CSS 注入 + dsw 令牌 + 分段控件类
  assert.equal(styleTags.length, 1, '应恰好注入一个 style 标签');
  const css = styleTags[0].textContent;
  assert.ok(css.includes('--dsw-alias-label-primary'), 'CSS 应用 dsw label-primary 令牌');
  assert.ok(css.includes('--dsw-alias-border-l1') && css.includes('--dsw-alias-bg-layer-1'), 'CSS 应用 dsw 卡片令牌');
  assert.ok(css.includes('.dsm-sm_segItem') && css.includes('.dsm-sm_segActive'), 'CSS 含分段控件类');
  assert.ok(css.includes('.dsm-sm_card') && css.includes('.dsm-sm_row'), 'CSS 含官方卡片/行布局类');
  assert.ok(css.includes('.dsm-sm-scrollPage'), 'CSS 含滚动容器类（防面板无法滑动）');
  assert.ok(/dsm-sm-scrollPage\{[^}]*overflow:auto/.test(css), 'scrollPage 必须 overflow:auto');
  assert.ok(/dsm-sm-scrollPage\{[^}]*height:100%/.test(css), 'scrollPage 必须 height:100%');
  assert.ok(styleTags[0].dataset.pluginCss === 'dsh-session-consistency/panel.css', 'data-plugin-css 标识正确');
  // 源码断言：toolbar 分段控件由 Button(ghost) 构成（官方形状）
  assert.ok(code.includes('dsm-sm_segItem') && code.includes('variant: "ghost"'), '分段控件 = Button ghost 形状');
});
