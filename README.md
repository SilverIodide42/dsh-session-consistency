# dsh-session-manager

> DSH（DeepSeek Harness）会话管理插件 — Web GUI 侧栏面板，用于检查三处会话存储的一致性、归档/恢复会话、永久清理归档残留，以及工作区体检。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

## 这是什么

DSH 把会话数据存在**三个地方**，任何一处不同步都会导致「历史会话打不开」或「归档聊天不显示」：

| 位置 | 内容 |
|---|---|
| `sessions/<workspace>/<id>/session.v4.jsonl.zstd` | 会话日志（多帧 zstd） |
| `storages/session_projcache/sessions/<id>.json` | 元数据缓存（标题、时间） |
| `storages/workspace.json` | 索引（`sessionIds` 全部注册；`archivedSessionIds` 为 GUI 隐藏集） |

本插件在 DSH 侧栏提供一个面板，把你从「手动翻文件 + 猜哪个能删」里解放出来：

- **一眼看清**五个状态：`active` / `archived` / `tombstone` / `missing` / `orphan`
- **安全清理**：任何删除都先备份到 `backup/`，再动三处
- **归档管理**：走宿主官方 RPC，归档=侧栏隐藏、恢复=重新出现
- **工作区体检**：磁盘/重复文件/失效引用/备份/tmp，并生成可粘贴给 AI 的修复提示词

## 功能（面板两块）

| 标签/区块 | 功能 | API |
|---|---|---|
| 会话 · 统计条 | 总数 + 五状态（active / archived 残留 / tombstone / missing / orphan，带色点），替代原来的 6 张大卡 | `GET /api/status` |
| 会话 · 统一会话列表 | 三维过滤（可见性 × 状态 × 文本搜索标题/ID）+ 行内归档/恢复 + 勾选；**归档会话在同一列表内筛选**，不再单独列一份 | — |
| 会话 · 批量操作 | 勾选后浮出批量条：归档 / 恢复 / 删除选中 / 清空选择 | `POST /api/archive`、`POST /api/delete` |
| 会话 · 清理 | 备份 + 清理归档残留/墓碑/陈旧索引（可勾选连孤儿）；恒先备份 | `GET /api/plan`、`POST /api/purge` |
| 体检 | 工作区健康分 + 磁盘/重复/引用/备份/tmp（动态加载工作区 `tools/workspace-doctor/lib`，缺失时降级提示） | `GET /api/doctor` |
| 体检 · AI 修复提示词 | 把体检发现整理成**可粘贴给 AI 的修复提示词**（工作区路径 + 约定 + 分级 findings + 重复/失效明细 + 先列计划再动手），一键复制 | `buildDoctorPrompt`（client 纯函数） |

### UI 设计要点（2026-11-09 重构）

- **信息密度优先**：6 张摘要大卡 → 一条 `dsm-sm_stats` 统计条（色点标识状态，0 值自动弱化）
- **单一数据源**：原「清理归档」独立区块的勾选框与会话列表的勾选框**重复渲染同一批会话**，已合并为一份列表 + 批量操作条
- **零内联样式**：所有布局走 `dsm-sm_*` 类（`style: {...}` 计数为 0），配色全部取 `--dsw-alias-*` 令牌
- **无障碍**：分段控件带 `aria-pressed`、分组带 `role="group"` + `aria-label`
- **滚动**：列表区 `dsm-sm_listTight` 自带 `max-height:360px` + `overflow:auto`，长列表不撑爆面板

### 交互体验（2026-11-09 二轮）

| 改进 | 效果 |
|---|---|
| **静默刷新** | 归档/删除后的 `refresh(true)` 不再整页闪 "检查中…"，保留列表与滚动位置，只在顶部走一条细进度条（`dsm-sm_progressBar`） |
| **成功提示自动消失** | 4.5s 后自动收起；错误提示常驻并带 `×` 手动关闭 |
| **排序切换** | 最近 / 标题 / 体积三档（标题用 `localeCompare(...,"zh")` 中文排序） |
| **快捷键** | `Ctrl/⌘+F` 聚焦搜索框；搜索框内 `Esc` 清空 |
| **空态区分** | "确实没会话" 与 "筛选无结果" 分开提示，后者引导清空搜索 |
| **被过滤的已选项** | 勾选后切换筛选，批量条显示"（N 个已选项被当前筛选隐藏）"，避免误以为丢失选择 |

## 体检 · AI 修复提示词

体检标签底部的「AI 修复提示词」区：点「生成提示词」把当前体检报告整理成一段纯文本（只读 textarea），点「复制」写入剪贴板，直接粘给 AI（本助手/任意模型）即可开工。提示词内容：

- **工作区根**与**约定**（备份到 `backup/`、`tmp/` 可清空、脚本 UTF-8、完成后重跑体检）
- 健康分、分级 findings（error/warn/info）、磁盘用量
- 重复文件组（`n×大小：路径A 与 路径B`）、失效路径引用（`引用 ← 文档`）、备份清单、tmp 占用
- **要求**：先列带优先级的修复计划并说明风险（尤其不可恢复操作），等确认后再执行

实现：`buildDoctorPrompt(report, L)` 纯函数（零依赖、可单测），面板只负责渲染与复制；`navigator.clipboard` 不可用时降级提示"请手工全选复制"。

## 清理归档（delete，永久删除）

宿主**没有**「持久化删除会话」的公开 RPC（`session/delete` 只动运行时态——实测调用返回 OK 但三处数据完全不变），所以三处删除由本插件执行（与旧 CLI purge 同款语义）：

- **范围**：会话目录 + projcache JSON + `archivedSessionIds` / `sessionIds` 索引条目
- **护栏**：默认**只删已归档（隐藏中）的会话**；未归档需 `includeUnhidden: true`（面板不传，防误删）
- **安全**：默认 dry-run（返回计划 + `skipped` 原因）；`apply: true` 才执行，且**恒先备份**到 `<workspace>/backup/archived-sessions-<时间戳>/`（会话目录 + projcache + workspace.json.before），可手工恢复
- **面板操作**：「清理归档」区列出全部隐藏会话 → 逐条勾选或「全选隐藏会话」→「删除选中 (n)」→ 二次确认

## 归档管理（archive）

DSH 的归档语义（app.asar 逆向 + 真机实验确认）：`archivedSessionIds` 是 **GUI 隐藏集**——被归档的会话从侧栏消失但数据完好；`sessionIds` 含全部注册会话（含被隐藏的）。

- **归档**：`POST /api/archive {ids:[], hide:true}` → 逐个走宿主官方 `workspace/archiveSession` RPC（一致性由宿主保证，不直接改索引）
- **恢复**：`hide:false` → `workspace/unarchiveSession`，会话重新出现在 GUI 侧栏
- **`stopActivity`**（默认 true）：归档运行中的会话时，宿主先请求停止其 turn/子代理/后台任务/定时；不开启则宿主以 `workspace/session-active` 拒绝
- **面板操作**：会话列表每行「归档/恢复」按钮 + 顶部「显示中/隐藏中」过滤器；活跃会话归档前弹确认

## 安装 / 更新

```powershell
# 复制插件目录到 profile（无需 rename-core，自动命名功能已移除）
Copy-Item plugin\* C:\Users\ZYY\.dsh\profiles\desktop\node_modules\dsh-session-manager\ -Force
# 重启 DSH 生效
```

首次安装还需：profile `package.json` 加 `"dsh-session-manager": "file:./node_modules/dsh-session-manager"` 依赖与 `dsh.profile.bundles` 数组条目。

安全：loopback Host 围栏 + `sec-fetch-site: cross-site` 拒绝 + Origin 同源校验；purge/delete 恒先备份。

## 测试

```powershell
node plugin-test.mjs    # 宿主半身 8 个（假 webServer + 真 HTTP + 假 .dsh 树，含 403/404 围栏）
node client-smoke.mjs   # 浏览器半身冒烟 2 个（假 ModuleLoader + 假 React + dsh 风格断言）
node delete-test.cjs    # 永久删除 14 项（dry-run 只读/护栏拒绝未归档/三处删除/备份完整/includeUnhidden/空 ids）
node delete-ui-test.cjs # 列表 UI 11 项（合并列表/勾选框计数/统计条/批量条）
node ux-test.cjs        # 交互体验 10 项（排序/空态区分/进度条/快捷键/无内联样式）
node integ-check.cjs    # 集成验证（真宿主路由 + 假 React 全链路渲染）
```

## 文件

- `plugin/index.js` — 宿主半身（prefix 路由 /session-manager/api）
- `plugin/client.js` — 浏览器半身（手写 __ModuleLoader__ 工厂，dsh 官方面板风格）
- `plugin-test.mjs` / `client-smoke.mjs` / `delete-test.cjs` / `delete-ui-test.cjs` / `integ-check.cjs` — 测试
