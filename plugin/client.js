/**
 * dsh-session-consistency — browser half.
 *
 * Hand-written window.__ModuleLoader__ factory (same wrapper shape as the
 * tsdown output of dsh-usage-statistics-panel / dshmarket): the host module
 * loader executes the factory with a require that resolves the host-provided
 * client packages (@deepseek-ai/dsh-client-ui-primitives, react).
 *
 * UI follows the official dsh-usage-statistics-panel conventions:
 *  - scoped CSS injected via <style data-plugin-css> (no inline styles for layout)
 *  - --dsw-alias-* design tokens only (theme-aware, light/dark)
 *  - segmented control built from Button(ghost, sm) inside a bordered group
 *  - card / modelRow / sectionHead layout shapes
 *
 * Panels:
 *  - plugins.bundle.config (keyed by package name) → the Plugins page detail
 *  - main + sidebar.panellist → a standalone global panel ("会话管理")
 *
 * Locale: two dictionaries (zh / en) registered under the plugin namespace;
 * t() falls back key→key when the host locale service is absent.
 */
window.__ModuleLoader__.load({
	id: "dsh-session-consistency",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");
		var primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		var Button = primitives.Button;
		var clsx = function () {
			var parts = [];
			for (var i = 0; i < arguments.length; i++) {
				var a = arguments[i];
				if (!a) continue;
				if (typeof a === "string") parts.push(a);
				else if (typeof a === "object") for (var k in a) if (a[k]) parts.push(k);
			}
			return parts.join(" ");
		};

		var BUNDLE_NAME = "dsh-session-consistency";
		var PANEL_ID = "session-manager";
		var PANEL_ORDER = 31; // right after usage-stats (30)
		var LOCALE_NS = "sessionManager";

		var zh = {
			meta: { title: "会话管理", description: "检查 DSH 会话三处存储（会话目录 / 元数据缓存 / 索引）的一致性，备份并清理归档残留、纯墓碑与陈旧索引条目。" },
			nav: "会话管理",
			refresh: "刷新",
			checking: "检查中…",
			summaryTitle: "一致性摘要",
			sessionsTitle: "会话列表",
			purgeTitle: "清理",
			status_active: "活跃",
			status_archived: "归档残留",
			status_tombstone: "纯墓碑",
			status_orphan: "孤儿",
			status_missing: "陈旧索引",
			purgeTargets: "待清理对象",
			purgeEmpty: "没有需要清理的对象，三方一致。",
			purgePlanHint: "清理会先备份到 workspace 的 backup/ 目录，再删除三处数据。建议先退出其他正在运行的 DSH 实例。",
			purgeOrphans: "连同孤儿一起清理（不在索引中的磁盘/缓存残留）",
			runPurge: "执行清理",
			purging: "清理中…",
			purgeDone: "已清理 {n} 个会话，备份在 {dir}",
			confirmPurge: "确认清理？该操作会先备份，但删除后需要从备份恢复。",
			error: "出错了",
			total: "总计",
			reclaimed: "预计可释放",
			activeHint: "活跃会话不受影响（active 状态永远不会被清理）",
			modified: "修改时间",
			size: "大小",
			title: "标题",
			status: "状态",
			filterAll: "全部",
			noSessions: "（无会话）",
			noMatch: "没有匹配当前筛选的会话（试试清空搜索或切换过滤器）",
			tabSessions: "会话",
			tabDoctor: "体检",
			doctorUnavailable: "体检功能需要工作区内存在 tools/workspace-doctor/lib（磁盘/重复/引用/备份/tmp 检查由它驱动）。",
			doctorScore: "健康分",
			doctorFindings: "检查发现",
			doctorDisk: "磁盘占用",
			doctorDupes: "重复文件",
			doctorDupesEmpty: "未发现 ≥1MiB 内容重复文件",
			doctorBroken: "失效路径引用",
			doctorBrokenEmpty: "无失效引用",
			doctorBackups: "备份清单",
			doctorTmp: "tmp/ 占用",
			files: "{n} 个文件",
			archive: "归档",
			unarchive: "恢复",
			archiving: "处理中…",
			archiveDone: "已{op} {n} 个会话",
			hidden: "隐藏中",
			hiddenHint: "「隐藏中」= 已归档：GUI 侧栏不显示，数据完好。恢复后重新出现在侧栏。",
			filterVisible: "显示中",
			deleteTitle: "清理归档",
			deleteHint: "永久删除勾选的归档会话（会话目录 + 元数据缓存 + 索引三处），删除前恒先备份到 workspace/backup/。",
			deleteSelectedN: "删除选中 ({n})",
			deletePreview: "将永久删除：",
			deleteConfirm: "确认永久删除 {n} 个归档会话？会先备份，但恢复需手工操作。",
			deleteDone: "已删除 {n} 个会话（释放 {size}），备份在 {dir}",
			deleteNothing: "没有勾选任何会话。",
			selectAllHidden: "全选隐藏会话",
			selectAllShown: "全选当前筛选结果",
			searchHint: "搜索标题或 ID（Ctrl+F）",
			sortTime: "最近",
			sortTitle: "标题",
			sortSize: "体积",
			selHiddenByFilter: "{n} 个已选项被当前筛选隐藏",
			dismiss: "关闭",
			clearSelection: "清空选择",
			selected: "已选 {n}",
			deleteIndexOnly: "（其中 {n} 个已被 DSH 回收数据，仅剩索引残留——删除只清理索引，不释放空间）",
			search: "搜索标题或 ID…",
			batchArchive: "归档选中",
			batchUnarchive: "恢复选中",
			batchDelete: "删除选中",
			batchNoop: "勾选若干会话后可批量归档/恢复/删除",
			aiPromptTitle: "AI 修复提示词",
			aiPromptHint: "把体检发现整理成一段可直接粘贴给 AI（如本助手）的修复提示词，含路径/约定/优先级，确保 AI 能正确解读并按约定清理。",
			aiPromptGen: "生成提示词",
			aiPromptCopy: "复制",
			aiPromptCopied: "已复制（粘贴给 AI 即可）",
			aiPromptCopyFail: "复制失败，请手工全选复制",
			aiPromptEmpty: "未发现需要 AI 介入的问题（全部 healthy）",
		};
		var en = {
			meta: { title: "Session Manager", description: "Check consistency across the three DSH session stores (session dirs / projcache / index), back up and purge archived residue, tombstones and stale index entries." },
			nav: "Sessions",
			refresh: "Refresh",
			checking: "Checking…",
			summaryTitle: "Consistency summary",
			sessionsTitle: "Sessions",
			purgeTitle: "Purge",
			status_active: "active",
			status_archived: "archived residue",
			status_tombstone: "tombstone",
			status_orphan: "orphan",
			status_missing: "stale index",
			purgeTargets: "purge targets",
			purgeEmpty: "Nothing to purge — all three locations are consistent.",
			purgePlanHint: "Purge backs up to the workspace backup/ dir first, then deletes from all three locations. Quit other running DSH instances first.",
			purgeOrphans: "Include orphans (disk/cache residue absent from the index)",
			runPurge: "Purge now",
			purging: "Purging…",
			purgeDone: "Purged {n} session(s); backup at {dir}",
			confirmPurge: "Confirm purge? A backup is taken first, but restoring afterwards is manual.",
			error: "Error",
			total: "total",
			reclaimed: "reclaimable",
			activeHint: "Active sessions are never touched",
			modified: "modified",
			size: "size",
			title: "title",
			status: "status",
			filterAll: "all",
			noSessions: "(no sessions)",
			noMatch: "No sessions match the current filter (try clearing the search or switching filters)",
			tabSessions: "Sessions",
			tabDoctor: "Doctor",
			doctorUnavailable: "Doctor needs tools/workspace-doctor/lib in the workspace (disk/dupe/ref checks).",
			doctorScore: "Health score",
			doctorFindings: "Findings",
			doctorDisk: "Disk usage",
			doctorDupes: "Duplicate files",
			doctorDupesEmpty: "No duplicate files ≥1MiB",
			doctorBroken: "Broken path refs",
			doctorBrokenEmpty: "No broken refs",
			doctorBackups: "Backups",
			doctorTmp: "tmp/ usage",
			files: "{n} files",
			archive: "Archive",
			unarchive: "Restore",
			archiving: "Working…",
			archiveDone: "{op} {n} session(s)",
			hidden: "hidden",
			hiddenHint: "'hidden' = archived: not shown in the GUI sidebar, data intact. Restore to bring it back.",
			filterVisible: "visible",
			deleteTitle: "Clean up archive",
			deleteHint: "Permanently delete checked archived sessions (session dir + metadata cache + index). Always backs up to workspace/backup/ first.",
			deleteSelectedN: "Delete checked ({n})",
			deletePreview: "Will be permanently deleted:",
			deleteConfirm: "Permanently delete {n} archived session(s)? A backup is taken first, but restoring is manual.",
			deleteDone: "Deleted {n} session(s) ({size}); backup at {dir}",
			deleteNothing: "Nothing checked.",
			selectAllHidden: "Select all hidden",
			selectAllShown: "Select all shown",
			searchHint: "Search title or ID (Ctrl+F)",
			sortTime: "Recent",
			sortTitle: "Title",
			sortSize: "Size",
			selHiddenByFilter: "{n} selected item(s) hidden by the current filter",
			dismiss: "Dismiss",
			clearSelection: "Clear",
			selected: "{n} selected",
			deleteIndexOnly: "({n} of these were already reclaimed by DSH, leaving only index entries — deleting cleans the index only, no space freed)",
			search: "Search title or ID…",
			batchArchive: "Archive checked",
			batchUnarchive: "Restore checked",
			batchDelete: "Delete checked",
			batchNoop: "Check sessions above, then batch archive / restore / delete here",
			aiPromptTitle: "AI repair prompt",
			aiPromptHint: "Package findings into a paste-ready repair prompt for an AI (like this assistant), with paths/conventions/priorities.",
			aiPromptGen: "Generate prompt",
			aiPromptCopy: "Copy",
			aiPromptCopied: "Copied (paste it to an AI)",
			aiPromptCopyFail: "Copy failed, select and copy manually",
			aiPromptEmpty: "No issues need AI repair (all healthy)",
			aiPromptBuild: "Below is the health-check report of this workspace. Follow the attached conventions to repair. First list a repair plan (with priorities) and wait for my confirmation before acting:",
		};

		// ---------- scoped CSS（dsw 设计令牌；类名沿用 dsm-sm_* 前缀） ----------
		var CSS = [
			// 容器与滚动
			".dsm-sm-scrollPage{box-sizing:border-box;height:100%;min-height:0;overflow:auto;overscroll-behavior:contain}",
			".dsm-sm-scrollInner{max-width:880px;margin:0 auto;padding:16px 20px 56px}",
			".dsm-sm-backRow{margin-bottom:14px;display:flex}",
			".dsm-sm-back{align-items:center;gap:6px;display:inline-flex;color:var(--dsw-alias-label-secondary)}",
			".dsm-sm-page{box-sizing:border-box;color:var(--dsw-alias-label-primary);flex-direction:column;gap:20px;min-width:0;padding:0 0 24px;display:flex;font-size:13px;line-height:1.6}",
			// 顶部工具栏（标签切换 + 全局操作）
			".dsm-sm_toolbar{flex-wrap:wrap;align-items:center;gap:8px;display:flex}",
			".dsm-sm_toolbarSpacer{flex:1 1 auto;min-width:0}",
			".dsm-sm_group{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:8px;flex-wrap:wrap;align-items:center;gap:2px;padding:3px;display:inline-flex}",
			".dsm-sm_segItem{border-radius:6px}",
			".dsm-sm_segItem:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
			".dsm-sm_segActive,.dsm-sm_segActive:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-label-primary)}",
			// 提示条
			".dsm-sm_errorBanner{border:1px solid var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);color:var(--dsw-alias-label-primary);border-radius:8px;padding:9px 13px;font-size:12.5px;word-break:break-all}",
			".dsm-sm_okBanner{border:1px solid color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 10%,transparent);color:var(--dsw-alias-label-primary);border-radius:8px;padding:9px 13px;font-size:12.5px}",
			".dsm-sm_loading{text-align:center;color:var(--dsw-alias-label-tertiary);padding:28px;font-size:13px}",
			".dsm-sm_empty{text-align:center;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l2);border-radius:10px;padding:22px 16px;font-size:12.5px}",
			// 区块
			".dsm-sm_section{flex-direction:column;gap:10px;min-width:0;display:flex}",
			".dsm-sm_sectionHead{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;display:flex}",
			".dsm-sm_sectionTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;font-weight:600;letter-spacing:.01em;display:flex;align-items:center;gap:8px}",
			".dsm-sm_sectionCount{color:var(--dsw-alias-label-tertiary);font-weight:400;font-variant-numeric:tabular-nums;font-size:12.5px}",
			// 统计条（替代 6 张大卡）
			".dsm-sm_stats{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;display:flex;flex-wrap:wrap;overflow:hidden}",
			".dsm-sm_stat{flex:1 1 0;min-width:88px;padding:11px 14px;display:flex;flex-direction:column;gap:3px;border-right:1px solid var(--dsw-alias-border-l1)}",
			".dsm-sm_stat:last-child{border-right:none}",
			".dsm-sm_statLabel{color:var(--dsw-alias-label-secondary);font-size:12px;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;display:flex;align-items:center;gap:5px}",
			".dsm-sm_statValue{color:var(--dsw-alias-label-primary);font-weight:600;font-size:17px;line-height:1.1;font-variant-numeric:tabular-nums}",
			".dsm-sm_statValue--muted{color:var(--dsw-alias-label-tertiary);font-weight:500}",
			".dsm-sm_dot{width:6px;height:6px;border-radius:50%;flex:none;display:inline-block}",
			".dsm-sm_dotActive{background:var(--dsw-alias-state-success-primary,#16a34a)}",
			".dsm-sm_dotWarn{background:var(--dsw-alias-state-warn-primary,#d97706)}",
			".dsm-sm_dotMuted{background:var(--dsw-alias-border-l2)}",
			".dsm-sm_dotError{background:var(--dsw-alias-state-error-primary,#b91c1c)}",
			// 卡片（体检页仍在用）
			".dsm-sm_cards{grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;display:grid}",
			".dsm-sm_card{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:5px;min-width:0;padding:12px 14px;display:flex}",
			".dsm-sm_cardLabel{color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;overflow:hidden}",
			".dsm-sm_cardValue{color:var(--dsw-alias-label-primary);font-weight:600;font-size:16px;line-height:1.15;font-variant-numeric:tabular-nums}",
			".dsm-sm_cardSub{color:var(--dsw-alias-label-tertiary);font-size:11.5px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}",
			// 设置组
			".dsm-sm_prefGroup{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;min-width:0;display:flex;overflow:hidden}",
			".dsm-sm_prefRow{align-items:center;gap:12px;padding:10px 14px;display:flex;min-width:0}",
			".dsm-sm_prefRow + .dsm-sm_prefRow{border-top:1px solid var(--dsw-alias-border-l1)}",
			".dsm-sm_prefGrow{flex:1 1 auto;min-width:0}",
			// 开关
			".dsm-sm_switch{cursor:pointer;background:0 0;border:none;flex:none;align-items:center;padding:0;display:inline-flex}",
			".dsm-sm_switchTrack{background:var(--dsw-alias-border-l2);width:38px;height:21px;transition:background-color .14s var(--ds-ease-in-out,ease);border-radius:11px;flex:none;display:inline-block;position:relative}",
			".dsm-sm_switchOn .dsm-sm_switchTrack{background:var(--dsw-alias-state-business-primary,#6da9b4)}",
			".dsm-sm_switchThumb{background:var(--dsw-alias-bg-layer-1);width:17px;height:17px;transition:transform .14s var(--ds-ease-in-out,ease);border-radius:50%;position:absolute;top:2px;left:2px;box-shadow:0 1px 2px rgba(0,0,0,.25)}",
			".dsm-sm_switchOn .dsm-sm_switchThumb{transform:translate(17px)}",
			// 列表与行
			".dsm-sm_list{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:10px;min-width:0;margin:0;padding:0;list-style:none;overflow:hidden}",
			".dsm-sm_listTight{max-height:360px;overflow:auto}",
			".dsm-sm_row{border-bottom:1px solid var(--dsw-alias-border-l1);align-items:center;gap:8px;padding:8px 12px;font-size:13px;display:flex;min-width:0;transition:background-color .1s ease}",
			".dsm-sm_row:last-child{border-bottom:none}",
			".dsm-sm_row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsm-sm_rowHead{background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent);font-size:12px;color:var(--dsw-alias-label-secondary);position:sticky;top:0;z-index:1}",
			".dsm-sm_rowHead:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary) 4%,transparent)}",
			".dsm-sm_rowMain{flex-direction:column;gap:2px;min-width:0;flex:1;display:flex}",
			".dsm-sm_rowTitle{color:var(--dsw-alias-label-primary);text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden;line-height:1.35}",
			".dsm-sm_rowSub{color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;font-size:11px;min-width:0;overflow:hidden;font-variant-numeric:tabular-nums}",
			".dsm-sm_rowValues{flex-direction:column;flex:none;align-items:flex-end;gap:2px;display:flex}",
			".dsm-sm_rowNum{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12.5px}",
			".dsm-sm_rowNumSub{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;font-size:11px;white-space:nowrap}",
			".dsm-sm_rowActions{flex:none;display:flex;align-items:center;gap:4px}",
			// 徽章
			".dsm-sm_badge{border-radius:999px;padding:0 7px;font-size:11px;line-height:17px;white-space:nowrap;flex:none;border:1px solid transparent;font-weight:500}",
			".dsm-sm_bActive{color:var(--dsw-alias-state-success-primary,#16a34a);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#16a34a) 9%,transparent)}",
			".dsm-sm_bWarn{color:var(--dsw-alias-state-warn-primary,#d97706);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary,#d97706) 9%,transparent)}",
			".dsm-sm_bError{color:var(--dsw-alias-state-error-primary,#b91c1c);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,#b91c1c) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#b91c1c) 9%,transparent)}",
			".dsm-sm_bMuted{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l2)}",
			// 辅助文本
			".dsm-sm_foot{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:1.5}",
			".dsm-sm_footWarn{color:var(--dsw-alias-state-warn-primary,#d97706)}",
			// 搜索框
			".dsm-sm_search{box-sizing:border-box;flex:1 1 160px;min-width:0;max-width:280px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:7px;color:var(--dsw-alias-label-primary);padding:5px 10px;font-size:12.5px;font-family:inherit;outline:none;transition:border-color .12s ease}",
			".dsm-sm_search::placeholder{color:var(--dsw-alias-label-tertiary)}",
			".dsm-sm_search:focus{border-color:var(--dsw-alias-label-tertiary)}",
			// 复选框
			".dsm-sm_check{flex:none;width:14px;height:14px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-state-business-primary,#6da9b4)}",
			// 批量操作条（有勾选时浮出）
			".dsm-sm_batch{border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#6da9b4) 8%,var(--dsw-alias-bg-layer-1));border-radius:9px;padding:7px 10px;flex-wrap:wrap;align-items:center;gap:8px;display:flex}",
			// 进度条
			".dsm-sm_barWrap{background:var(--dsw-alias-border-l2);border-radius:4px;height:7px;min-width:100px;flex:1 1 auto;overflow:hidden}",
			".dsm-sm_barFill{background:linear-gradient(90deg,var(--dsw-provider-1,#6da9b4),var(--dsw-chart-4,#bb94f6));height:100%;transition:width .3s var(--ds-ease-in-out,ease)}",
			".dsm-sm_barRow{display:flex;align-items:center;gap:8px;min-width:0;flex:1}",
			// 提示词 textarea
			".dsm-sm_promptText{box-sizing:border-box;width:100%;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;color:var(--dsw-alias-label-primary);padding:10px 12px;font-size:12px;line-height:1.5;font-family:ui-monospace,Consolas,monospace;resize:vertical;outline:none}",
			".dsm-sm_promptText:focus{border-color:var(--dsw-alias-label-tertiary)}",
			// 危险操作按钮配色
			".dsm-sm_danger{color:var(--dsw-alias-state-error-primary,#b91c1c)!important}",
			// 静默刷新进度条（刷新时不闪屏，只在顶部走一条细线）
			".dsm-sm_progress{height:2px;border-radius:1px;background:transparent;overflow:hidden;margin:-6px 0 0}",
			".dsm-sm_progressOn{background:linear-gradient(90deg,transparent,var(--dsw-alias-state-business-primary,#6da9b4),transparent);animation:dsm-sm-slide 1.1s ease-in-out infinite}",
			"@keyframes dsm-sm-slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}",
			".dsm-sm_progressTrack{height:2px;overflow:hidden;border-radius:1px}",
			".dsm-sm_progressBar{height:100%;width:40%;background:var(--dsw-alias-state-business-primary,#6da9b4);border-radius:1px;animation:dsm-sm-slide 1.1s ease-in-out infinite}",
			// 排序按钮组（复用 group 外观，但更紧凑）
			".dsm-sm_sortRow{display:flex;align-items:center;gap:6px;flex-wrap:wrap}",
			".dsm-sm_kbd{border:1px solid var(--dsw-alias-border-l2);border-radius:4px;padding:0 4px;font-size:10.5px;color:var(--dsw-alias-label-tertiary);font-family:ui-monospace,Consolas,monospace;line-height:15px}",
			".dsm-sm_bannerClose{margin-left:auto;background:none;border:none;cursor:pointer;color:inherit;opacity:.6;padding:0 2px;font-size:14px;line-height:1}",
			".dsm-sm_bannerClose:hover{opacity:1}",
			".dsm-sm_bannerRow{display:flex;align-items:stretch;gap:0}",
			".dsm-sm_bannerRow > .dsm-sm_okBanner,.dsm-sm_bannerRow > .dsm-sm_errorBanner{flex:1 1 auto;min-width:0}",
		].join("");
		var cssTagId = "dsh-session-consistency/panel.css";
		function ensureCss() {
			if (typeof document === "undefined") return;
			if (document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
				var tag = document.createElement("style");
				tag.dataset.plugin = "dsh-session-consistency";
				tag.dataset.pluginCss = cssTagId;
				tag.textContent = CSS;
				document.head.appendChild(tag);
			}
		}

		function fmtBytes(n) {
			if (n == null) return "-";
			var units = ["B", "KB", "MB", "GB"];
			var i = 0, v = n;
			while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
			return (v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)) + " " + units[i];
		}
		function fmtDate(ms) {
			if (ms == null) return "-";
			var d = new Date(ms);
			if (isNaN(d.getTime())) return "-";
			var p = function (x) { return String(x).padStart(2, "0"); };
			return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
		}
		function fmtInt(n) {
			if (n == null || isNaN(n)) return "-";
			return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
		}
		function fill(tpl, vars) {
			return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? String(vars[k]) : "{" + k + "}"; });
		}

		function localeBackLabel() {
			return (typeof navigator !== "undefined" && navigator.language || "zh").startsWith("zh") ? "返回" : "Back";
		}

		function api(path, body) {
			var init = body !== undefined
				? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
				: {};
			return fetch("/session-manager/api/" + path, init).then(function (r) {
				return r.json().then(function (j) {
					if (!j.ok) throw new Error((j.error && j.error.message) || "api error");
					return j.value;
				});
			});
		}

		var STATUS_ORDER = ["active", "archived", "tombstone", "missing", "orphan"];
		var STATUS_BADGE = {
			active: "dsm-sm_bActive",
			archived: "dsm-sm_bWarn",
			tombstone: "dsm-sm_bMuted",
			missing: "dsm-sm_bWarn",
			orphan: "dsm-sm_bMuted",
		};
		var STATUS_TONE = { ok: "dsm-sm_bActive", info: "dsm-sm_bMuted", warn: "dsm-sm_bWarn", error: "dsm-sm_bError" };

		/** 把体检报告整理成可直接粘贴给 AI 的修复提示词（零依赖、纯文本） */
		function buildDoctorPrompt(r, L) {
			if (!r || typeof r !== "object") return "";
			var out = [];
			out.push("【背景】请修复一个 DSH 工作区（Windows）的体检问题。工作区根：" + (r.workspace || "（当前目录）"));
			out.push("【约定】删除/移动前必须先备份到 `backup/`；`tmp/` 可清空；中文文件名脚本统一 UTF-8；完成后重跑体检验证。");
			if (r.score != null) out.push("【健康分】" + r.score + " / 100");
			if (Array.isArray(r.findings) && r.findings.length) {
				out.push("【findings】");
				for (const f of r.findings) out.push("- [" + String(f.level || "").toUpperCase() + "] " + (f.area || "") + ": " + (f.message || ""));
			}
			if (r.disk && r.disk.totalBytes != null) out.push("【磁盘】" + fmtBytes(r.disk.totalBytes) + "（" + (r.disk.totalFiles || 0) + " 个文件）");
			if (r.dupes && r.dupes.groupCount > 0) {
				out.push("【重复文件】" + r.dupes.groupCount + " 组，可释放 " + fmtBytes(r.dupes.wastedTotal || 0) + "：");
				for (const g of (r.dupes.groups || []).slice(0, 20)) out.push("- " + g.count + "× " + fmtBytes(g.size) + "： " + (g.files || []).join(" 与 "));
			}
			if (r.docs && r.docs.brokenCount > 0) {
				out.push("【失效路径引用】" + r.docs.brokenCount + " 条：");
				for (const b of (r.docs.broken || []).slice(0, 30)) out.push("- " + b.ref + "  ←  " + b.doc);
			}
			if (r.backups && r.backups.exists) {
				out.push("【备份清单】");
				for (const e of (r.backups.entries || []).slice(0, 20)) out.push("- " + (e.name || e) + (e.bytes ? "  " + fmtBytes(e.bytes) : ""));
			}
			if (r.tmp) out.push("【tmp/】" + fmtBytes(r.tmp.bytes) + "（" + (r.tmp.files || 0) + " 个文件，可清空）");
			out.push("【要求】先列修复计划（带优先级）并解释每一步的风险（特别是不可恢复操作）；等我确认后再动手。若有工作区特定的约定（如索引一致性、锁具占用），请指出来再执行。");
			return out.join("\n");
		}

		function Card(label, value, sub) {
			return React.createElement("div", { className: "dsm-sm_card" },
				React.createElement("div", { className: "dsm-sm_cardLabel" }, label),
				React.createElement("div", { className: "dsm-sm_cardValue" }, value),
				sub != null && React.createElement("div", { className: "dsm-sm_cardSub" }, sub));
		}

		function Switch(props) {
			return React.createElement("button", {
				type: "button", role: "switch", "aria-checked": props.checked,
				className: clsx("dsm-sm_switch", props.checked && "dsm-sm_switchOn"),
				onClick: function () { props.onChange(!props.checked); },
			},
				React.createElement("span", { className: "dsm-sm_switchTrack" },
					React.createElement("span", { className: "dsm-sm_switchThumb" })));
		}

		/** 体检标签页 */
		function DoctorTab(props) {
			var L = props.L;
			var loadingPair = React.useState(true);
			var errorPair = React.useState(null);
			var reportPair = React.useState(null);
			var promptPair = React.useState("");
			var copyPair = React.useState(null);
			var loading = loadingPair[0], setLoading = loadingPair[1];
			var error = errorPair[0], setError = errorPair[1];
			var report = reportPair[0], setReport = reportPair[1];
			var prompt = promptPair[0], setPrompt = promptPair[1];
			var copyMsg = copyPair[0], setCopyMsg = copyPair[1];

			var load = React.useCallback(function () {
				setLoading(true); setError(null);
				api("doctor").then(function (r) { setReport(r); setLoading(false); })
					.catch(function (e) { setError(String(e && e.message || e)); setLoading(false); });
			}, []);
			React.useEffect(function () { load(); }, [load]);

			var generatePrompt = function () {
				setPrompt(buildDoctorPrompt(report, L));
				setCopyMsg(null);
			};
			var copyPrompt = function () {
				var text = prompt || buildDoctorPrompt(report, L);
				if (!text.trim()) return;
				if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).then(function () { setCopyMsg(L("aiPromptCopied")); })
						.catch(function () { setCopyMsg(L("aiPromptCopyFail")); });
				} else {
					setCopyMsg(L("aiPromptCopyFail"));
				}
			};

			if (loading) return React.createElement("div", { className: "dsm-sm_loading" }, L("checking"));
			if (error) return React.createElement("div", null,
				React.createElement("div", { className: "dsm-sm_errorBanner" }, L("error") + ": " + error),
				React.createElement("div", { className: "dsm-sm_foot" }, L("doctorUnavailable")));

			var tone = report.score >= 90 ? "dsm-sm_bActive" : report.score >= 75 ? "dsm-sm_bActive" : report.score >= 60 ? "dsm-sm_bWarn" : "dsm-sm_bError";
			var dupes = report.dupes || { groups: [], groupCount: 0, wastedTotal: 0 };
			var docs = report.docs || { broken: [], brokenCount: 0 };
			return React.createElement("div", { className: "dsm-sm_section" },
				// 分数卡 + 概览卡
				React.createElement("div", { className: "dsm-sm_cards" },
					Card(L("doctorScore"), String(report.score) + " / 100", report.workspace),
					Card(L("doctorDisk"), fmtBytes(report.disk.totalBytes), fill(L("files"), { n: fmtInt(report.disk.totalFiles) })),
					Card(L("doctorDupes"), String(dupes.groupCount), dupes.wastedTotal ? fmtBytes(dupes.wastedTotal) : null),
					Card(L("doctorBroken"), String(docs.brokenCount), docs.refCount != null ? (docs.refCount - docs.brokenCount) + " / " + docs.refCount : null),
					report.tmp && Card(L("doctorTmp"), fmtBytes(report.tmp.bytes), report.tmp.files != null ? fill(L("files"), { n: fmtInt(report.tmp.files) }) : null),
					report.backups && report.backups.exists && Card(L("doctorBackups"), String(report.backups.entries.length), fmtBytes(report.backups.totalBytes))),
				// findings 列表
				React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" },
						React.createElement("h3", { className: "dsm-sm_sectionTitle" }, L("doctorFindings")),
						React.createElement(Button, { size: "sm", variant: "ghost", onClick: load }, L("refresh"))),
					React.createElement("div", { className: "dsm-sm_list" }, report.findings.map(function (f, i) {
						return React.createElement("div", { key: i, className: "dsm-sm_row" },
							React.createElement("span", { className: clsx("dsm-sm_badge", STATUS_TONE[f.level] || "dsm-sm_bMuted") }, f.level),
							React.createElement("div", { className: "dsm-sm_rowMain" },
								React.createElement("div", { className: "dsm-sm_rowTitle" }, f.message)),
							React.createElement("div", { className: "dsm-sm_rowValues" },
								React.createElement("span", { className: "dsm-sm_rowNumSub" }, f.area)));
					}))),
				// 重复文件
				React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" }, React.createElement("h3", { className: "dsm-sm_sectionTitle" }, L("doctorDupes"))),
					dupes.groupCount === 0
						? React.createElement("div", { className: "dsm-sm_empty" }, L("doctorDupesEmpty"))
						: React.createElement("div", { className: "dsm-sm_list" }, dupes.groups.map(function (g, i) {
							return React.createElement("div", { key: i, className: "dsm-sm_row" },
								React.createElement("div", { className: "dsm-sm_rowMain" }, g.files.map(function (p, j) {
									return React.createElement("div", { key: j, className: j === 0 ? "dsm-sm_rowTitle" : "dsm-sm_rowSub" }, p);
								})),
								React.createElement("div", { className: "dsm-sm_rowValues" },
									React.createElement("span", { className: "dsm-sm_rowNum" }, fmtBytes(g.wasted)),
									React.createElement("span", { className: "dsm-sm_rowNumSub" }, fmtBytes(g.size) + " × " + g.count)));
						}))),
				// 失效引用
				React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" }, React.createElement("h3", { className: "dsm-sm_sectionTitle" }, L("doctorBroken") + " (" + docs.brokenCount + ")")),
					docs.brokenCount === 0
						? React.createElement("div", { className: "dsm-sm_empty" }, L("doctorBrokenEmpty"))
						: React.createElement("div", { className: "dsm-sm_list" }, docs.broken.map(function (b, i) {
							return React.createElement("div", { key: i, className: "dsm-sm_row" },
								React.createElement("div", { className: "dsm-sm_rowMain" },
									React.createElement("div", { className: "dsm-sm_rowTitle" }, b.ref),
									React.createElement("div", { className: "dsm-sm_rowSub" }, b.doc)));
						}))),
				// AI 修复提示词（把体检发现整理成可直接粘贴给 AI 的修复提示词）
				React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" },
						React.createElement("h3", { className: "dsm-sm_sectionTitle" }, L("aiPromptTitle")),
						React.createElement("div", { className: "dsm-sm_toolbar" },
							React.createElement(Button, { size: "sm", variant: "ghost", onClick: generatePrompt }, L("aiPromptGen")),
							prompt && React.createElement(Button, { size: "sm", variant: "primary", onClick: copyPrompt }, L("aiPromptCopy")))),
					React.createElement("div", { className: "dsm-sm_foot" }, L("aiPromptHint")),
					copyMsg && React.createElement("div", { className: "dsm-sm_okBanner" }, copyMsg),
					prompt
						? React.createElement("textarea", {
							readOnly: true, value: prompt, rows: 12, className: "dsm-sm_promptText",
						})
						: React.createElement("div", { className: "dsm-sm_empty" }, L("aiPromptEmpty"))));
		}

		function SessionManagerPanel(props) {
			var t = props && props.t ? props.t : function (k) { return k; };
			var locale = (typeof navigator !== "undefined" && navigator.language || "zh").startsWith("zh") ? zh : en;
			var L = function (k) {
				var v = locale[k];
				if (v == null) return t(k);
				return typeof v === "string" ? v : (v.title || k);
			};

			ensureCss();

			var loadingPair = React.useState(true);   // 首次加载（会渲染整页 loading）
			var refreshingPair = React.useState(false); // 后续静默刷新（保留旧数据 + 顶部细进度条）
			var errorPair = React.useState(null);
			var reportPair = React.useState(null);
			var planPair = React.useState(null);
			var busyPair = React.useState(false);
			var messagePair = React.useState(null);
			var filterPair = React.useState("all");
			var orphansPair = React.useState(false);
			var tabPair = React.useState("sessions");

			var loading = loadingPair[0], setLoading = loadingPair[1];
			var refreshing = refreshingPair[0], setRefreshing = refreshingPair[1];
			var error = errorPair[0], setError = errorPair[1];
			var report = reportPair[0], setReport = reportPair[1];
			var plan = planPair[0], setPlan = planPair[1];
			var busy = busyPair[0], setBusy = busyPair[1];
			var message = messagePair[0], setMessage = messagePair[1];
			var filter = filterPair[0], setFilter = filterPair[1];
			var includeOrphans = orphansPair[0], setIncludeOrphans = orphansPair[1];
			var tab = tabPair[0], setTab = tabPair[1];

			// silent=true：保留现有列表，仅顶部细进度条（归档/删除后用它，避免整页闪 loading）
			var refresh = React.useCallback(function (silent) {
				var isSilent = silent === true;
				if (isSilent) setRefreshing(true);
				else setLoading(true);
				setError(null); setMessage(null);
				Promise.all([api("status"), api("plan")]).then(function (vals) {
					setReport(vals[0]); setPlan(vals[1]);
					setLoading(false); setRefreshing(false);
				}).catch(function (e) {
					setError(String(e && e.message || e)); setLoading(false); setRefreshing(false);
				});
			}, []);

			React.useEffect(function () { refresh(); }, [refresh]);

			// 成功提示 4.5s 后自动消失（错误保留，需用户看见）
			React.useEffect(function () {
				if (!message) return undefined;
				var timer = setTimeout(function () { setMessage(null); }, 4500);
				return function () { clearTimeout(timer); };
			}, [message]);

			// Ctrl+F / ⌘F 聚焦搜索框（仅在会话标签页生效）
			React.useEffect(function () {
				if (typeof document === "undefined" || typeof document.addEventListener !== "function") return undefined;
				var onKey = function (e) {
					if (!e || !(e.ctrlKey || e.metaKey) || String(e.key).toLowerCase() !== "f") return;
					var box = document.getElementById("dsm-sm-search");
					if (!box) return;
					e.preventDefault();
					if (typeof box.focus === "function") box.focus();
					if (typeof box.select === "function") box.select();
				};
				document.addEventListener("keydown", onKey);
				return function () { document.removeEventListener("keydown", onKey); };
			}, []);

			var refreshPlan = React.useCallback(function (orphans) {
				api("purge", { orphans: !!orphans }).then(function (p) {
					if (p && p.nothingToDo) setPlan({ targets: [], totals: { sessions: 0, diskBytes: 0 } });
					else setPlan(p);
				}).catch(function (e) { setError(String(e && e.message || e)); });
			}, []);

			React.useEffect(function () {
				if (!loading) refreshPlan(includeOrphans);
			}, [includeOrphans, loading, refreshPlan]);

			var runPurge = function () {
				if (typeof window !== "undefined" && window.confirm && !window.confirm(L("confirmPurge"))) return;
				setBusy(true); setMessage(null);
				api("purge", { apply: true, orphans: includeOrphans }).then(function (result) {
					setMessage(fill(L("purgeDone"), { n: result.purged, dir: result.backupDir || "backup/" }));
					refresh(true);
				}).catch(function (e) {
					setError(String(e && e.message || e));
				}).finally(function () { setBusy(false); });
			};

			// 归档管理（归档 = GUI 隐藏；恢复 = 重新显示；走宿主官方 RPC）
			// 活跃会话（本会话/运行中）会被宿主拒绝归档——面板明确提示而非静默失败
			var archBusyPair = React.useState(null); // 正在处理的会话 id
			var archBusy = archBusyPair[0], setArchBusy = archBusyPair[1];
			var setArchived = function (s) {
				var hide = !s.hidden;
				var doIt = function () {
					setArchBusy(s.id);
					api("archive", { ids: [s.id], hide: hide }).then(function (r) {
						var results = r.results || [];
						var okCount = results.filter(function (x) { return x.ok; }).length;
						var firstErr = results.find(function (x) { return !x.ok; });
						if (okCount === 0 && firstErr) setError(String(firstErr.error || "archive failed"));
						else setMessage(fill(L("archiveDone"), { op: hide ? L("archive") : L("unarchive"), n: okCount }));
						refresh(true);
					}).catch(function (e) {
						setError(String(e && e.message || e));
					}).finally(function () { setArchBusy(null); });
				};
				if (hide && s.status === "active" && s.id !== (report && report.selfId) && typeof window !== "undefined" && window.confirm) {
					if (!window.confirm("该会话可能正在运行工作。归档会让宿主先停止它（stopActivity），确定继续？")) return;
				}
				doIt();
			};

			// 选择/永久删除（仅归档会话）
			var selPair = React.useState({}); // id -> true
			var sel = selPair[0], setSel = selPair[1];
			var delBusyPair = React.useState(false);
			var delBusy = delBusyPair[0], setDelBusy = delBusyPair[1];
			var selIds = Object.keys(sel).filter(function (k) { return sel[k]; });
			var toggleSel = function (id) {
				var next = {}; for (var k in sel) next[k] = sel[k];
				next[id] = !next[id]; setSel(next);
			};
			var selectAllHidden = function () {
				var next = {};
				sessions.filter(function (s) { return s.hidden; }).forEach(function (s) { next[s.id] = true; });
				setSel(next);
			};
			var runDelete = function () {
				if (selIds.length === 0) { setError(L("deleteNothing")); return; }
				if (typeof window !== "undefined" && window.confirm && !window.confirm(fill(L("deleteConfirm"), { n: selIds.length }))) return;
				setDelBusy(true); setMessage(null); setError(null);
				api("delete", { ids: selIds, apply: true }).then(function (r) {
					if (r && r.nothingToDo) { setError(L("deleteNothing")); return; }
					setMessage(fill(L("deleteDone"), { n: r.deleted || 0, size: fmtBytes(r.diskBytes || 0), dir: r.backupDir || "backup/" }));
					setSel({});
					refresh(true);
				}).catch(function (e) { setError(String(e && e.message || e)); })
					.finally(function () { setDelBusy(false); });
			};

			// 批量归档/恢复（对当前勾选集）
			var batchBusyPair = React.useState(false);
			var batchBusy = batchBusyPair[0], setBatchBusy = batchBusyPair[1];
			var batchSetArchived = function (hide) {
				if (selIds.length === 0) return;
				setBatchBusy(true); setMessage(null); setError(null);
				api("archive", { ids: selIds, hide: hide }).then(function (r) {
					var okCount = (r.results || []).filter(function (x) { return x.ok; }).length;
					setMessage(fill(L("archiveDone"), { op: hide ? L("archive") : L("unarchive"), n: okCount }));
					refresh(true);
				}).catch(function (e) { setError(String(e && e.message || e)); })
					.finally(function () { setBatchBusy(false); });
			};
			var toggleAllShown = function () {
				var next = {}; for (var k in sel) next[k] = sel[k];
				var allChecked = shown.length > 0 && shown.every(function (s) { return next[s.id]; });
				for (const s of shown) next[s.id] = !allChecked;
				setSel(next);
			};

			var summary = report && report.summary;
			var sessions = (report && report.sessions) || [];
			// 三维过滤：status × visibility × 文本搜索（标题/ID）+ 排序
			var visPair = React.useState("all");
			var vis = visPair[0], setVis = visPair[1];
			var queryPair = React.useState("");
			var query = queryPair[0], setQuery = queryPair[1];
			var sortPair = React.useState("time");
			var sortBy = sortPair[0], setSortBy = sortPair[1];
			var q = String(query || "").trim().toLowerCase();
			var shown = sessions.filter(function (s) {
				if (filter !== "all" && s.status !== filter) return false;
				if (vis === "visible" && s.hidden) return false;
				if (vis === "hidden" && !s.hidden) return false;
				if (q) {
					var hay = (String(s.title || "") + " " + s.id).toLowerCase();
					if (!hay.includes(q)) return false;
				}
				return true;
			});
			// 排序（稳定）：时间倒序 / 标题 / 体积
			if (sortBy === "title") {
				shown = shown.slice().sort(function (a, b) {
					return String(a.title || a.id).localeCompare(String(b.title || b.id), "zh");
				});
			} else if (sortBy === "size") {
				shown = shown.slice().sort(function (a, b) { return (b.diskSize || 0) - (a.diskSize || 0); });
			}
			// 已勾选但被过滤掉的数量（提示用户）
			var selHiddenByFilter = selIds.filter(function (id) {
				return !shown.some(function (s) { return s.id === id; });
			}).length;
			var hiddenCount = sessions.filter(function (s) { return s.hidden; }).length;
			// 已被 DSH 回收数据、仅剩索引残留的隐藏会话（missing/tombstone）
			var indexOnlyHidden = sessions.filter(function (s) { return s.hidden && !s.onDisk && !s.inCache; }).length;

			// 仅首次加载（尚无 report）才整页 loading；静默刷新保留列表，不打断滚动与阅读
			if (loading && !report) return React.createElement("div", { className: "dsm-sm_loading" }, L("checking"));

			// 标签切换（会话 / 体检）——官方 segmented control 形状
			var TABS = [["sessions", L("tabSessions")], ["doctor", L("tabDoctor")]];
			var toolbar = React.createElement("div", { className: "dsm-sm_toolbar" },
				React.createElement("div", { className: "dsm-sm_group", role: "group", "aria-label": "tab" },
					TABS.map(function (pair) {
						return React.createElement(Button, {
							key: pair[0], size: "sm", variant: "ghost",
							className: clsx("dsm-sm_segItem", tab === pair[0] && "dsm-sm_segActive"),
							"aria-pressed": tab === pair[0],
							onClick: function () { setTab(pair[0]); },
						}, pair[1]);
					})),
				React.createElement("div", { className: "dsm-sm_toolbarSpacer" }));

			// 静默刷新进度条（首次加载时整页 loading，不显示）
			var progressBar = refreshing && React.createElement("div", { className: "dsm-sm_progressTrack" },
				React.createElement("div", { className: "dsm-sm_progressBar" }));

			var tabBody;
			if (tab === "doctor") {
				tabBody = React.createElement(DoctorTab, { L: L });
			} else {
				// ===== 会话标签页 =====
				var hasVisible = shown.length > 0;
				var allShownChecked = hasVisible && shown.every(function (s) { return !!sel[s.id]; });

				// 统计条：总数 + 五种状态（用色点 + 数字，替代 6 张大卡）
				var statDot = { active: "dsm-sm_dotActive", archived: "dsm-sm_dotWarn", tombstone: "dsm-sm_dotMuted", missing: "dsm-sm_dotWarn", orphan: "dsm-sm_dotMuted" };
				var statsBar = summary && React.createElement("div", { className: "dsm-sm_stats" },
					React.createElement("div", { className: "dsm-sm_stat" },
						React.createElement("div", { className: "dsm-sm_statLabel" }, L("total")),
						React.createElement("div", { className: "dsm-sm_statValue" }, fmtInt(summary.total || 0))),
					STATUS_ORDER.map(function (k) {
						var n = summary[k] != null ? summary[k] : 0;
						return React.createElement("div", { key: k, className: "dsm-sm_stat" },
							React.createElement("div", { className: "dsm-sm_statLabel" },
								React.createElement("span", { className: clsx("dsm-sm_dot", statDot[k] || "dsm-sm_dotMuted") }),
								L("status_" + k)),
							React.createElement("div", { className: clsx("dsm-sm_statValue", n === 0 && "dsm-sm_statValue--muted") }, fmtInt(n)));
					}));

				// 清理卡（整合 purge：残留/墓碑/陈旧索引；孤儿可选）
				var purgeCard = plan && React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" },
						React.createElement("h3", { className: "dsm-sm_sectionTitle" },
							L("purgeTitle"),
							plan.totals && plan.totals.sessions ? React.createElement("span", { className: "dsm-sm_sectionCount" }, String(plan.totals.sessions)) : null)),
					(plan.targets && plan.targets.length === 0)
						? React.createElement("div", { className: "dsm-sm_empty" }, L("purgeEmpty"))
						: React.createElement("div", { className: "dsm-sm_prefGroup" },
							React.createElement("div", { className: "dsm-sm_prefRow" },
								React.createElement("div", { className: "dsm-sm_prefGrow" },
									React.createElement("div", null, L("purgeTargets") + " " + String(plan.totals ? plan.totals.sessions : 0)),
									React.createElement("div", { className: "dsm-sm_foot" }, L("reclaimed") + " " + fmtBytes(plan.totals ? plan.totals.diskBytes : 0))),
								React.createElement(Button, { size: "sm", variant: "primary", disabled: busy, onClick: runPurge },
									busy ? L("purging") : L("runPurge"))),
							React.createElement("div", { className: "dsm-sm_prefRow" },
								React.createElement(Switch, { checked: includeOrphans, onChange: function (v) { setIncludeOrphans(v); } }),
								React.createElement("span", { className: "dsm-sm_prefGrow" }, L("purgeOrphans"))),
							React.createElement("div", { className: "dsm-sm_prefRow" },
								React.createElement("span", { className: "dsm-sm_foot" }, L("purgePlanHint")))));

				// 会话列表（统一列表：三维过滤 + 内联归档/删除；隐藏会话直接在这里勾选删除，不再单列一份）
				var listSection = React.createElement("section", { className: "dsm-sm_section" },
					React.createElement("div", { className: "dsm-sm_sectionHead" },
						React.createElement("h3", { className: "dsm-sm_sectionTitle" },
							L("sessionsTitle"),
							React.createElement("span", { className: "dsm-sm_sectionCount" }, fmtInt(shown.length) + " / " + fmtInt(sessions.length))),
						React.createElement("div", { className: "dsm-sm_toolbar" },
							React.createElement(Button, { size: "sm", variant: "ghost", onClick: refresh }, L("refresh")))),
					// 过滤器行：可见性 + 状态 + 搜索
					React.createElement("div", { className: "dsm-sm_toolbar" },
						React.createElement("div", { className: "dsm-sm_group", role: "group", "aria-label": "visibility" },
							[["all", L("filterAll")], ["visible", L("filterVisible")], ["hidden", L("hidden")]].map(function (pair) {
								return React.createElement(Button, {
									key: pair[0], size: "sm", variant: "ghost",
									className: clsx("dsm-sm_segItem", vis === pair[0] && "dsm-sm_segActive"),
									"aria-pressed": vis === pair[0],
									onClick: function () { setVis(pair[0]); },
								}, pair[1] + (pair[0] === "hidden" && hiddenCount ? " (" + hiddenCount + ")" : ""));
							})),
						React.createElement("div", { className: "dsm-sm_group", role: "group", "aria-label": "status" },
							["all"].concat(STATUS_ORDER).map(function (k) {
								return React.createElement(Button, {
									key: k, size: "sm", variant: "ghost",
									className: clsx("dsm-sm_segItem", filter === k && "dsm-sm_segActive"),
									"aria-pressed": filter === k,
									onClick: function () { setFilter(k); },
								}, k === "all" ? L("filterAll") : L("status_" + k));
							})),
						React.createElement("input", {
							type: "search",
							id: "dsm-sm-search",
							className: "dsm-sm_search",
							placeholder: L("searchHint"),
							value: query,
							onChange: function (e) { setQuery((e && e.target && e.target.value) || ""); },
							onKeyDown: function (e) {
								if (e && e.key === "Escape") { setQuery(""); }
							},
						}),
						// 排序切换
						React.createElement("div", { className: "dsm-sm_group", role: "group", "aria-label": "sort" },
							[["time", L("sortTime")], ["title", L("sortTitle")], ["size", L("sortSize")]].map(function (pair) {
								return React.createElement(Button, {
									key: pair[0], size: "sm", variant: "ghost",
									className: clsx("dsm-sm_segItem", sortBy === pair[0] && "dsm-sm_segActive"),
									"aria-pressed": sortBy === pair[0],
									onClick: function () { setSortBy(pair[0]); },
								}, pair[1]);
							}))),
					// 上下文提示（仅在相关视图出现）
					vis === "hidden" && React.createElement("div", { className: "dsm-sm_foot" }, L("hiddenHint")),
					indexOnlyHidden > 0 && React.createElement("div", { className: clsx("dsm-sm_foot", "dsm-sm_footWarn") },
						fill(L("deleteIndexOnly"), { n: indexOnlyHidden })),
					// 批量操作条（有勾选时浮出）
					selIds.length > 0 && React.createElement("div", { className: "dsm-sm_batch" },
						React.createElement("span", { className: "dsm-sm_foot" }, fill(L("selected"), { n: selIds.length })),
						selHiddenByFilter > 0 && React.createElement("span", { className: clsx("dsm-sm_foot", "dsm-sm_footWarn") },
							"（" + fill(L("selHiddenByFilter"), { n: selHiddenByFilter }) + "）"),
						React.createElement(Button, { size: "sm", variant: "ghost", disabled: batchBusy, onClick: function () { batchSetArchived(true); } },
							batchBusy ? L("archiving") : L("batchArchive")),
						React.createElement(Button, { size: "sm", variant: "ghost", disabled: batchBusy, onClick: function () { batchSetArchived(false); } },
							L("batchUnarchive")),
						React.createElement(Button, { size: "sm", variant: "ghost", className: "dsm-sm_danger", disabled: delBusy || batchBusy, onClick: runDelete },
							delBusy ? L("archiving") : L("batchDelete")),
						React.createElement("div", { className: "dsm-sm_toolbarSpacer" }),
						React.createElement(Button, { size: "sm", variant: "ghost", onClick: function () { setSel({}); } }, L("clearSelection"))),
					// 列表（空态区分：无会话 vs 筛选无结果）
					!hasVisible
						? React.createElement("div", { className: "dsm-sm_empty" },
							sessions.length === 0 ? L("noSessions") : L("noMatch"))
						: React.createElement("div", { className: clsx("dsm-sm_list", "dsm-sm_listTight") },
							React.createElement("div", { className: clsx("dsm-sm_row", "dsm-sm_rowHead") },
								React.createElement("input", {
									type: "checkbox", className: "dsm-sm_check",
									checked: allShownChecked,
									onChange: toggleAllShown,
								}),
								React.createElement("span", { className: "dsm-sm_prefGrow" }, L("selectAllShown")),
								React.createElement("span", { className: "dsm-sm_rowNum" }, fmtInt(shown.length))),
							shown.slice(0, 200).map(function (s) {
								var isBusy = archBusy === s.id;
								return React.createElement("div", { key: s.id, className: "dsm-sm_row" },
									React.createElement("input", {
										type: "checkbox", className: "dsm-sm_check",
										checked: !!sel[s.id],
										onChange: function () { toggleSel(s.id); },
									}),
									React.createElement("span", { className: clsx("dsm-sm_badge", STATUS_BADGE[s.status] || "dsm-sm_bMuted") }, L("status_" + s.status)),
									s.hidden && React.createElement("span", { className: clsx("dsm-sm_badge", "dsm-sm_bMuted") }, L("hidden")),
									React.createElement("div", { className: "dsm-sm_rowMain" },
										React.createElement("div", { className: "dsm-sm_rowTitle" }, s.title || s.id),
										React.createElement("div", { className: "dsm-sm_rowSub" }, s.id)),
									React.createElement("div", { className: "dsm-sm_rowValues" },
										React.createElement("span", { className: "dsm-sm_rowNum" }, s.onDisk ? fmtBytes(s.diskSize) : "-"),
										React.createElement("span", { className: "dsm-sm_rowNumSub" }, fmtDate(s.mtime))),
									React.createElement("div", { className: "dsm-sm_rowActions" },
										React.createElement(Button, {
											size: "sm", variant: "ghost",
											disabled: isBusy,
											onClick: function () { setArchived(s); },
										}, isBusy ? L("archiving") : (s.hidden ? L("unarchive") : L("archive")))));
							}),
							shown.length > 200 && React.createElement("div", { className: clsx("dsm-sm_row", "dsm-sm_foot") }, "… " + String(shown.length - 200))),
					// 底部提示
					React.createElement("div", { className: "dsm-sm_foot" }, L("activeHint")),
					React.createElement("div", { className: "dsm-sm_foot" }, L("deleteHint")));

				tabBody = React.createElement("div", { className: "dsm-sm_section" },
					message && React.createElement("div", { className: "dsm-sm_bannerRow" },
						React.createElement("div", { className: "dsm-sm_okBanner" }, message)),
					error && React.createElement("div", { className: "dsm-sm_bannerRow" },
						React.createElement("div", { className: "dsm-sm_errorBanner" }, L("error") + ": " + error),
						React.createElement("button", { className: "dsm-sm_bannerClose", title: L("dismiss"), onClick: function () { setError(null); } }, "×")),
					statsBar,
					listSection,
					purgeCard);
			}

			return React.createElement("div", { className: "dsm-sm-page" }, toolbar, progressBar, tabBody);
		}
		/** The sidebar row's glyph (inline SVG, a stacked-layers broom). */
		function PanelIcon(_props) {
			void _props;
			return React.createElement("svg", {
				width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
				stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
			},
				React.createElement("path", { d: "M3 7h18" }),
				React.createElement("path", { d: "M3 12h12" }),
				React.createElement("path", { d: "M3 17h7" }),
				React.createElement("path", { d: "m16 15 5 5" }),
				React.createElement("path", { d: "m21 15-5 5" }));
		}

		var inject = ["slots", "locale", "layout"];

		function apply(ctx) {
			// dictionaries (best effort: hosts without a locale service skip)
			if (ctx.locale && typeof ctx.locale.register === "function") {
				ctx.effect(function () {
					var offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
					var offEn = ctx.locale.register(LOCALE_NS, "en", en);
					return function () { offZh(); offEn(); };
				}, "dsh-session-consistency: dictionaries");
			}

			var t = ctx.locale && typeof ctx.locale.bind === "function"
				? ctx.locale.bind(LOCALE_NS)
				: function (k) { return k; };

			var previousPanelId = null;
			var lastPanelId = ctx.layout && ctx.layout.panelInfo ? ctx.layout.panelInfo.getSnapshot().activePanelId : null;
			if (ctx.layout && ctx.layout.panelInfo) {
				ctx.effect(function () {
					return ctx.layout.panelInfo.subscribe(function () {
						var next = ctx.layout.panelInfo.getSnapshot().activePanelId;
						if (next === PANEL_ID && lastPanelId !== PANEL_ID) previousPanelId = lastPanelId;
						lastPanelId = next;
					});
				}, "dsh-session-consistency: panel history");
			}
			var goBack = function () {
				if (previousPanelId === null || previousPanelId === PANEL_ID) {
					ctx.layout.selectPanel(null);
					return;
				}
				try { ctx.layout.selectPanel(previousPanelId); }
				catch { ctx.layout.selectPanel(null); }
			};

			// Plugins page detail (keyed slot)
			ctx.slots.inject("plugins.bundle.config", function () {
				return ctx.slots.register({
					name: "plugins.bundle.config",
					key: BUNDLE_NAME,
					locale: LOCALE_NS,
				}, function Section(props) {
					return React.createElement(SessionManagerPanel, props);
				});
			});

			// standalone main panel —— 外层容器接管滚动（官方 page 同款：height:100% + overflow:auto）
			ctx.slots.inject("main", function () {
				return ctx.slots.register({
					name: "main",
					key: PANEL_ID,
					locale: LOCALE_NS,
					inject: function () { return { goBack: goBack }; },
				}, function PanelPage(props) {
					var goBackFn = props && props.goBack;
					return React.createElement("div", { className: "dsm-sm-scrollPage" },
						React.createElement("div", { className: "dsm-sm-scrollInner" },
							typeof goBackFn === "function" && React.createElement("div", { className: "dsm-sm-backRow" },
								React.createElement(Button, { size: "sm", variant: "ghost", className: "dsm-sm-back", onClick: goBackFn }, "‹ " + (localeBackLabel()))),
							React.createElement(SessionManagerPanel, null)));
				});
			});

			// sidebar row
			ctx.slots.inject("sidebar.panellist", function () {
				return ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_ID,
					order: PANEL_ORDER,
					label: function () { return t("nav"); },
					locale: LOCALE_NS,
				}, PanelIcon);
			});
		}

		exports.BUNDLE_NAME = BUNDLE_NAME;
		exports.PANEL_ID = PANEL_ID;
		exports.SessionManagerPanel = SessionManagerPanel;
		exports.DoctorTab = DoctorTab;
		exports.buildDoctorPrompt = buildDoctorPrompt;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
