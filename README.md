# dsh-session-consistency

> DSH（DeepSeek Harness）会话管理插件 — Web GUI 侧栏面板，用于检查三处会话存储的一致性、归档/恢复会话、备份后清理归档残留，以及工作区体检。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/SilverIodide42/dsh-session-consistency?color=blue)](https://github.com/SilverIodide42/dsh-session-consistency/releases/latest)
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
| 会话 · 统计条 | 总数 + 五状态（active / archived 残留 / tombstone / missing / orphan，带色点） | `GET /api/status` |
| 会话 · 统一会话列表 | 三维过滤（可见性 × 状态 × 文本搜索标题/ID）+ 行内归档/恢复 + 勾选；归档会话在同一列表内筛选 | — |
| 会话 · 批量操作 | 勾选后浮出批量条：归档 / 恢复 / 删除选中 / 清空选择 | `POST /api/archive`、`POST /api/delete` |
| 会话 · 清理 | 备份 + 清理归档残留/墓碑/陈旧索引（可勾选连孤儿）；恒先备份 | `GET /api/plan`、`POST /api/purge` |
| 体检 | 工作区健康分 + 磁盘/重复/引用/备份/tmp（动态加载工作区 `tools/workspace-doctor/lib`，缺失时降级提示） | `GET /api/doctor` |
| 体检 · AI 修复提示词 | 把体检发现整理成可粘贴给 AI 的修复提示词，一键复制 | `buildDoctorPrompt`（client 纯函数） |

### UI 与交互要点

- **信息密度优先**：统计条 + 单一会话列表（不再重复渲染两批勾选框）
- **零内联样式**：所有布局走 `dsm-sm_*` 类，配色取 `--dsw-alias-*` 令牌
- **静默刷新**：归档/删除后保留列表与滚动位置，仅顶部细进度条
- **快捷键**：`Ctrl/⌘+F` 聚焦搜索、`Esc` 清空
- **排序与空态**：最近 / 标题 / 体积三档；区分「确实没会话」与「筛选无结果」

## 安装 / 更新

### 方式一：下载预打包文件（推荐）

从 [Releases](https://github.com/SilverIodide42/dsh-session-consistency/releases/latest) 下载 `dsh-session-consistency-0.1.2.tgz`，解压到 DSH profile 的 `node_modules`：

```powershell
$dst = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-session-consistency"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$tmp = Join-Path $env:TEMP ("dsh-consistency-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
tar -xzf dsh-session-consistency-0.1.2.tgz -C $tmp
Copy-Item "$tmp\package\*" $dst -Recurse -Force
```

### 方式二：从仓库直接装

```bash
dsh plugin --profile desktop add github:SilverIodide42/dsh-session-consistency
# 或固定版本：
pnpm add github:SilverIodide42/dsh-session-consistency#v0.1.2
```

### 方式三：从源码复制（开发调试）

```powershell
$dst = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules\dsh-session-consistency"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item index.js,client.js,cordis.patch.yml,package.json,icon.svg,README.md,LICENSE $dst -Force
```

### 首次安装的额外两步

1. profile `package.json` 的 `dependencies` 加 `"dsh-session-consistency": "file:./node_modules/dsh-session-consistency"`
2. profile `package.json` 的 `dsh.profile.bundles` 数组加 `"dsh-session-consistency"`

然后**重启 DSH**（宿主半生效）；仅更新 client 半时刷新页面即可。

> ⚠️ 不要在 profile 目录跑完整 `pnpm install` —— 会重建 `node_modules` 并把自引用的 `file:` 依赖掏空。用 `--lockfile-only` 或手动复制。

## HTTP API

宿主半身挂一条 prefix 路由 `/session-consistency/api`：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/session-consistency/api/status` | 全量会话 + 五状态摘要（只读） |
| GET | `/session-consistency/api/plan` | 清理计划（dry-run，只读） |
| POST | `/session-consistency/api/purge` | `{}` → dry-run；`{apply:true}` → 备份+清理；`{orphans:true}` 纳入孤儿 |
| GET | `/session-consistency/api/doctor` | 工作区体检（动态加载工作区 `tools/workspace-doctor/lib`；缺失时 500 + 面板降级提示） |
| POST | `/session-consistency/api/archive` | `{ids:[], hide:true}` 归档 / `hide:false` 恢复，走宿主 `workspace/*` RPC |
| POST | `/session-consistency/api/delete` | 永久删除三处数据；默认 dry-run，`apply:true` 才执行，恒先备份 |

安全：loopback Host 围栏 + `sec-fetch-site: cross-site` 拒绝 + Origin 同源校验；purge/delete 恒先备份（workspace `backup/archived-sessions-<stamp>/`）。

## 面板挂载点

- `plugins.bundle.config`（按包名 key）→ 插件详情页内嵌面板
- `main` + `sidebar.panellist`（id `session-consistency`，order 31，紧随 usage-stats）→ 独立全局面板「会话管理」

## 仓库结构

```
.
├── package.json        # dsh.bundle.patch + dsh.client.inject 声明
├── cordis.patch.yml    # 一行 insert 挂载宿主半身
├── index.js            # 宿主半身：prefix 路由 /session-consistency/api（ESM，零依赖）
├── client.js           # 浏览器半身：手写 __ModuleLoader__ 工厂（React，无构建）
├── icon.svg / LICENSE
├── README.md
└── *-test.cjs / *-check.cjs / client-smoke.mjs / plugin-test.mjs
```

## 测试

```powershell
node plugin-test.mjs    # 宿主半身 8 项（假 webServer + 真 HTTP + 假 .dsh 树，含 403/404 围栏）
node client-smoke.mjs   # 浏览器半身冒烟 2 项（假 ModuleLoader + 假 React + dsh 风格断言）
node delete-test.cjs    # 永久删除 14 项（dry-run 只读/护栏拒绝未归档/三处删除/备份完整/includeUnhidden/空 ids）
node delete-ui-test.cjs # 列表 UI 11 项（合并列表/勾选框计数/统计条/批量条）
node ux-test.cjs        # 交互体验 10 项（排序/空态区分/进度条/快捷键/无内联样式）
node integ-check.cjs    # 集成验证 8 项（真宿主路由 + 假 React 全链路渲染）
```

## 已知限制

- 工作区体检依赖工作区内 `tools/workspace-doctor/lib`，缺失时该标签页降级提示
- 删除与清理会改动 DSH 数据目录，大规模清理建议先退出其他 DSH 实例
- 浏览器半身为手写工厂（无 tsdown/tsc），未做类型检查
- 面板表格最多展示 200 行（可用状态/搜索过滤）

## License

MIT © SilverIodide42