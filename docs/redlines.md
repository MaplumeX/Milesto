# Milesto 红线（禁止事项）

本文件用于明确 **Milesto** 项目中“绝对不能做”的事（Red Lines）。
这些红线主要来源于产品 PRD 与技术框架文档（例如 `docs/tech-framework.md`、`docs/prd/*`），用于约束实现阶段的架构、安全、隐私与范围边界。

适用范围：仓库内所有代码、配置、文档与发布产物。

## 0. 违规处理（默认）

- 触犯红线的 PR：默认 **不允许合并**。
- 如必须破例：必须在 PR 中写清“为什么需要破例、风险是什么、如何回滚/降级、影响面有哪些”，并在本文件中补充记录（见“例外流程”）。

## 1. Electron 安全基线（强制）

来源：`docs/tech-framework.md`「安全基线（默认强制）」。

- 禁止在渲染进程启用 Node 能力：不得开启 `nodeIntegration`。
- 禁止关闭上下文隔离：不得关闭 `contextIsolation`。
- 禁止使用 remote：不得引入或依赖 `@electron/remote`（或旧 `remote` 方案）。
- 禁止弱化 CSP：渲染进程必须启用 Content-Security-Policy，至少 **禁止** `unsafe-eval`。

补充（对齐 Electron 官方安全指南）：

- 禁止处理 IPC 时不校验来源：主进程处理 IPC 必须验证 sender/来源窗口，避免非预期页面触发特权操作。

## 1.1 快捷键边界（强制）

来源：`docs/tech-framework.md`「键盘优先与命令面板」章节。

- 禁止上来就大量使用 `globalShortcut` 抢占系统快捷键：优先使用菜单 `accelerator`，减少冲突与平台不一致。

## 2. Preload 与 IPC 能力边界（强制）

来源：`docs/tech-framework.md`「Preload」「IPC 设计规范」。

- 禁止在 Renderer 直接使用 `ipcRenderer`：Renderer 只能调用 `window.api.*` 形式的业务级 API。
- 禁止在 Preload 暴露高危原语：不得暴露“任意 SQL 执行能力”或“任意文件系统能力”。
- 禁止开口子式 IPC：IPC 通道必须白名单化，且请求/响应必须做 schema 校验（文档建议使用 `zod`）。
- 禁止混用 IPC 形态：只使用 `ipcMain.handle` / `ipcRenderer.invoke` 的请求-响应模型；避免 `send/on` 无约束广播。
- 禁止把敏感错误细节直接抛到 UI：UI 只依赖 `code/message` 做提示与恢复；`details` 仅用于日志。

## 3. 数据库与数据一致性（强制）

来源：`docs/tech-framework.md`「DB Worker」「SQLite 与迁移策略」「导入/导出」。

- 禁止在 Main/Renderer 直接执行 SQLite：数据库访问必须在 `worker_threads` 中进行。
- 禁止开放任意 SQL：DB Worker 对外只能暴露业务级 action（例如 `task.create`/`task.search`），不得提供 `query(sql)` 之类通用接口。
- 禁止非事务写入：所有写操作必须在事务内执行。
- 禁止“半套数据”落盘：导入/批量写入失败必须回滚，不能留下部分成功的数据。
- 禁止把数据库文件打进 asar：DB 必须持久化在 `app.getPath("userData")` 等用户数据目录中。

## 4. Sync-ready 数据约束（强制）

来源：`docs/tech-framework.md`「同步就绪（Sync-ready）原则」。

- 禁止使用自增整数作为核心对象 ID：从一开始使用 UUID（建议 UUIDv7）。
- 禁止不可追踪的删除：核心对象应使用软删除（预留 `deleted_at`），避免未来同步/导入合并失控。
- 禁止不可靠的变更时间：`updated_at` 必须在任何变更时可靠更新（冲突检测基础）。
- 禁止把大量状态塞进单个 JSON blob（除非经过例外流程批准）：未来需要冲突可解释与字段级差异展示。

## 5. 隐私与同步安全（强制）

来源：`docs/prd/03-v0.3-sync.md`「安全与隐私」「同步原则」。

- 禁止默认收集行为数据：不得加入 telemetry/analytics 之类默认上报；同步日志仅本地可见。
- 禁止明文传输同步数据：传输加密（HTTPS/WebDAV TLS）是最低要求。
- 禁止 silent merge：当无法自动安全合并时必须进入冲突状态，并由用户可见、可手动处理。
- 禁止不可恢复的同步动作：同步必须“可解释、可恢复”，失败必须可重试且不破坏本地数据。

## 6. 性能红线（强制）

来源：`docs/prd/00-overview.md` 与 `docs/tech-framework.md` 性能章节。

- 禁止牺牲核心性能指标：在 10k 任务规模下，搜索首屏必须 < 200ms；冷启动到可交互目标 < 1s。
- 禁止列表渲染“全量堆字段”：列表页只取必要字段；大文本（如 `notes`）按需加载。
- 禁止 10k 规模下不用虚拟滚动：任务列表默认使用虚拟滚动。

## 7. 发布与打包（强制）

来源：`docs/tech-framework.md`「打包与发布」。

- 禁止接入自动更新：当前阶段暂不考虑自动更新，禁止引入 `electron-updater`（或同类）。
- 禁止忽视原生依赖的跨平台构建：`better-sqlite3` 为原生模块，必须按目标 OS 构建/重建，CI 需走多平台矩阵。

## 7.1 工程化与质量门禁（强制）

来源：`docs/tech-framework.md`「工程化」「CI」章节。

- 禁止绕过类型检查：TypeScript 必须保持 `strict`（禁止为“临时能跑”而放松类型边界）。
- 禁止绕过代码规范：必须遵循项目的 lint/format 规则（文档建议 ESLint + Prettier + Git hooks）。
- 禁止合并破坏性变更而不跑检查：CI 建议流水线为 `install -> lint -> typecheck -> test -> build -> dist`，破坏链路的提交不应合入主分支。
- 禁止引入高风险依赖而无评审：新增依赖必须说明用途、替代方案、体积/安全影响（供应链风险）。
- 禁止提交任何密钥/凭据/个人数据到仓库：包括但不限于 `.env`、token、私钥、真实用户数据导出文件。

## 8. 版本范围红线（按 PRD 强制）

来源：`docs/prd/*` 的 In Scope/Out of Scope。

- v0.1：禁止实现同步/账号体系、提醒（通知）与重复任务、团队协作、与日历双向集成。
- v0.2：禁止把多端同步、端到端加密、高级自动化/插件系统塞进本迭代。
- v0.3：禁止默认开启同步；同步必须是可选模块。

## 9. 侵权与品牌风险（强制）

来源：`docs/prd/00-overview.md`。

- 禁止引入未授权的图标/字体/图片/文案等资源；开源替代必须保持可证明的原创/合规来源。

## 10. 例外流程（必须走）

当你认为某条红线必须破例时：

1) 在 PR 描述中写明：破例条目、原因、风险、影响面、替代方案、回滚/降级方案。
2) 在 `docs/redlines.md` 的对应条目下追加“已批准例外”记录（日期、链接、负责人、有效期）。
3) 例外必须有明确的“到期删除/回归红线”的计划。

## 11. 参考（外部权威）

以下链接用于解释“为什么这些红线必须存在”（不取代本文件的约束性）：

- Electron Security Checklist: https://www.electronjs.org/docs/latest/tutorial/security
- Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation
- Electron IPC sender validation: https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages
- Electron Performance (avoid blocking main process): https://www.electronjs.org/docs/latest/tutorial/performance#3-blocking-the-main-process
- better-sqlite3 performance notes (WAL, sync API caveats): https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
- SQLite PRAGMA busy_timeout: https://www.sqlite.org/pragma.html#pragma_busy_timeout
