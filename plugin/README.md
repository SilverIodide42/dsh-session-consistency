# dsh-session-manager（插件版）

DSH 会话管理 Web GUI 插件：在浏览器里做三处一致性检查、备份与清理。与 [CLI 版](../README.md) 同一状态模型，宿主逻辑内联移植（不依赖 CLI 文件）。

## 结构

```
plugin/
├── package.json       # dsh.bundle.patch + dsh.client.inject 声明
├── cordis.patch.yml   # 一行 insert 挂载宿主半身
├── index.js           # 宿主半身：prefix 路由 /session-manager/api（ESM，零依赖）
├── client.js          # 浏览器半身：手写 __ModuleLoader__ 工厂（React，无构建）
├── icon.svg / LICENSE
```

## HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/session-manager/api/status` | 全量会话 + 五状态摘要（只读） |
| GET | `/session-manager/api/plan` | 清理计划（dry-run，只读） |
| POST | `/session-manager/api/purge` | `{}` → dry-run；`{apply:true}` → 备份+清理；`{orphans:true}` 纳入孤儿 |
| GET | `/session-manager/api/doctor` | 工作区体检（动态加载工作区 `tools/workspace-doctor/lib`；缺失时 500 + 面板降级提示） |

安全：loopback Host 围栏 + `sec-fetch-site: cross-site` 拒绝 + Origin 同源校验（usage-statistics-panel 同款）；purge 恒先备份（workspace `backup/archived-sessions-<stamp>/`）。

## UI 挂载点

- `plugins.bundle.config`（按包名 key）→ 插件详情页内嵌面板
- `main` + `sidebar.panellist`（id `session-manager`，order 31，紧随 usage-stats）→ 独立全局面板「会话管理」

## 安装（本机 profile，file: 模式）

```powershell
# 1. 复制
Copy-Item -Recurse tools\dsh-session-manager\plugin C:\Users\ZYY\.dsh\profiles\desktop\node_modules\dsh-session-manager
# 2. profile package.json：
#    dependencies += "dsh-session-manager": "file:./node_modules/dsh-session-manager"
#    dsh.profile.bundles += "dsh-session-manager"
# 3. 重启 DSH（Desktop 宿主读 profile 装配组合树）
```

照 `dsh-our-free-model` 的先例：普通目录 + file: 依赖即可被 Desktop 宿主加载，无需 pnpm install（无第三方运行时依赖）。

## 测试

```powershell
node plugin-test.mjs     # 宿主半身：8 项（假 webServer + 真 HTTP + 假 .dsh 树）
node client-smoke.mjs    # 浏览器半身：2 项（假 ModuleLoader + 假 React）
node test.mjs            # CLI 回归：7 项
```

## 已知限制

- 浏览器半身为手写工厂（无 tsdown/tsc），类型契约参考 usage-statistics-panel 的 `context-types.ts` 约定，未做类型检查
- purge 时若其他 DSH 实例在跑，索引可能被回写（与 CLI 相同限制，面板上有提示文案）
- 面板表格最多展示 200 行（下拉可按状态过滤）
