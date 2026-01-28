# Milesto 项目规范（应当遵循）

本文件定义 Milesto 的工程与协作规范（What we do）。
“禁止事项（红线）”请见 `docs/redlines.md`（What we must not do）。

适用范围：仓库内所有代码、配置、文档与发布产物。

## 1. 术语与规范级别

- 必须：不满足即视为不合规，原则上不得合并。
- 建议：强烈推荐的默认做法；如不采纳需要说明原因与替代方案。

## 2. 文档分层与单一事实来源

- 必须：产品范围以 `docs/prd/*` 的 In Scope / Out of Scope 为准；实现范围变更必须先改 PRD，再改代码。
- 必须：架构与工程约束以 `docs/tech-framework.md` 为准；实现阶段的偏离必须走例外流程。
- 必须：所有“绝对禁止”的内容以 `docs/redlines.md` 为准；该文件优先级最高。

## 3. 架构规范（Electron 三层 + DB Worker）

来源：`docs/tech-framework.md`。

- 必须：Electron 按 Main / Preload / Renderer 分层，职责边界清晰。
- 必须：数据库访问放在独立 DB Worker（`worker_threads`）中执行。
- 必须：Renderer 只通过 `window.api.*` 调用业务能力；不直接触达主进程或数据库。

建议的目录与边界（实现时可以调整，但边界不应变化）：

- `main/`：窗口生命周期、应用菜单/托盘、DB Worker 管理、IPC 网关
- `preload/`：`contextBridge` 暴露最小业务 API（`window.api`）
- `renderer/`：React UI、路由、状态管理
- `workers/db/`：SQLite 连接、migrations、CRUD、事务、导入导出

## 4. Electron 安全与运行时基线

该部分为“应当遵循”的工程化落地要求；更严格的禁止事项见 `docs/redlines.md`。

- 必须：启用 `contextIsolation` 且禁用 `nodeIntegration`。
- 必须：禁用 remote（不使用 `@electron/remote`）。
- 必须：启用 CSP，并确保至少禁用 `unsafe-eval`。
- 必须：主进程处理 IPC 时校验 sender/来源窗口；仅允许来自受信任页面的请求。

## 5. IPC 设计规范

来源：`docs/tech-framework.md`「IPC 设计规范」。

- 必须：通道按域命名（例如 `db:*`、`settings:*`、`fs:*`、`app:*`），命名可读、可追踪。
- 必须：只使用请求-响应模型：`ipcMain.handle` / `ipcRenderer.invoke`。
- 必须：所有 IPC payload 与返回值都要做 schema 校验（文档建议使用 `zod`）。
- 必须：失败统一返回结构化错误（`code/message/details?`），UI 只依赖 `code/message`。
- 建议：对所有 DB/文件类操作设置超时与可恢复策略（超时、worker 崩溃等必须可被观测）。

## 6. 数据库规范（SQLite + better-sqlite3）

来源：`docs/tech-framework.md`「DB Worker」「SQLite 与迁移策略」。

- 必须：DB Worker 持有唯一 SQLite 连接，按队列串行处理写请求，避免并发写锁问题。
- 必须：所有写操作使用事务；导入/批量写入必须在事务内完成，失败全量回滚。
- 必须：数据库文件位于用户数据目录（`app.getPath("userData")`），且不进入 asar。
- 建议：连接建立后、执行迁移前设置 pragma 基线：
  - `journal_mode = WAL`
  - `foreign_keys = ON`
  - `busy_timeout = 5000`（按需要调整）

迁移与版本化：

- 必须：迁移文件在生产环境可读取（`process.resourcesPath`）且可重复执行。
- 必须：导入/导出包含 `schema_version`、`app_version`、`exported_at` 等元信息。

## 7. Sync-ready 数据约束

来源：`docs/tech-framework.md`「同步就绪（Sync-ready）原则」。

- 必须：核心对象 ID 使用 UUID（建议 UUIDv7）。
- 必须：预留软删除字段 `deleted_at`；未来同步/导入合并以软删除为基础。
- 必须：`updated_at` 在任何变更时可靠更新，作为冲突检测基础。

## 8. 性能规范（对齐 PRD 指标）

来源：`docs/prd/00-overview.md` 与 `docs/tech-framework.md`。

- 必须：对齐核心性能指标：10k 任务规模下搜索首屏 < 200ms；冷启动到可交互目标 < 1s。
- 必须：列表页只取必要字段；大文本（如 `notes`）按需加载。
- 必须：任务列表默认使用虚拟滚动（10k 规模必需）。
- 建议：搜索优先采用 SQLite FTS5，避免 `LIKE` 方案后期迁移成本。

## 9. 隐私与数据治理

来源：`docs/prd/00-overview.md` 与 `docs/tech-framework.md`。

- 必须：默认不收集行为数据；如未来需要遥测/分析，必须采用显式 opt-in，并提供关闭入口。
- 必须：同步传输最低要求为 HTTPS/WebDAV TLS；敏感日志仅本地可见。
- 必须：同步冲突必须可见、可手动处理；禁止 silent merge。

## 10. 范围管理（按版本执行）

来源：`docs/prd/*`。

- 必须：实现内容不得越过当前版本 PRD 的 Out of Scope。
- 必须：任何跨版本需求（例如在 v0.1 做同步）必须先更新 PRD 并说明取舍、风险与影响。

## 11. 工程化与质量门禁

来源：`docs/tech-framework.md`。

- 必须：TypeScript 开启 `strict`。
- 必须：提交前通过 lint/typecheck/test（具体脚本以实现阶段的 `package.json` 为准）。
- 建议：引入 Git hooks（例如 husky + lint-staged）在本地提前拦截常见问题。
- 建议：CI 采用三平台矩阵（macOS/Windows/Linux），并按 `install -> lint -> typecheck -> test -> build -> dist` 链路执行。

## 12. 依赖与许可证

- 必须：新增依赖前说明用途、替代方案、体积影响与安全风险（供应链）。
- 必须：确保依赖许可证与项目目标兼容；不引入来源不明或许可证不清晰的资源。
- 建议：避免并存同类库（例如 Drizzle 与 Kysely 二选一）。

## 12.1 UI 与交互实现规范（建议）

来源：`docs/tech-framework.md`「路由与窗口策略」「UI 与交互」。

- 必须：路由优先使用 `HashRouter`，避免 `file://` 场景下刷新/深链路由的路径问题。
- 建议：路由组织遵循 `AppShell`（布局）+ `pages/*`（路由页）+ `features/*`（业务域），避免“页面逻辑散落各处”。
- 建议：表单采用 `react-hook-form` + `zod` 做输入校验与错误提示，校验规则尽量与 IPC schema 复用/对齐。
- 建议：交互遵循“键盘优先 + 低摩擦”原则：常用动作尽量在 1-2 次键盘交互内完成（与 PRD 指标一致）。

## 12.2 状态管理与数据流（建议）

来源：`docs/tech-framework.md`「状态与数据」。

- 建议：全局状态使用 `zustand`，避免把短生命周期 UI 状态塞进全局 store。
- 建议：涉及缓存/并发/重试的异步数据，优先采用 `@tanstack/react-query`（如引入）。
- 必须：跨进程/跨模块的数据边界以 `window.api` 为准；Renderer 内不要越界访问“主进程细节”。

## 12.3 错误处理与日志（必须）

来源：`docs/tech-framework.md`「统一错误结构」与 `docs/redlines.md`。

- 必须：所有跨边界失败都使用统一 `AppError`（`code/message/details?`）。
- 必须：用户可见的错误信息只使用 `code/message`；`details` 仅用于本地日志与排障。
- 必须：日志中不得包含密钥/凭据/个人数据；如需要定位问题，使用脱敏策略。

## 13. 代码评审与 PR 规范

- 必须：PR 说明“为什么改（动机/问题）”而不只写“改了什么”。
- 必须：PR 包含验证方式（本地运行、测试点、回归点）。
- 必须：涉及数据模型/IPC/导入导出/同步等关键路径时，PR 必须同时更新对应文档。

PR 检查清单（建议直接复制到 PR 描述）：

```text
- [ ] 未触犯 docs/redlines.md
- [ ] 变更符合当前版本 PRD 的 In Scope/Out of Scope
- [ ] IPC 通道命名与校验符合 docs/tech-framework.md
- [ ] 写操作具备事务性；导入失败可回滚
- [ ] 性能风险已评估（10k 搜索、列表虚拟滚动、冷启动）
- [ ] 隐私：无默认 telemetry；无敏感信息进日志/仓库
```

## 14. 决策记录（ADR，建议）

当出现“会影响未来 2-3 个版本”的决策（例如存储层、同步模式、搜索实现），建议用 ADR 记录：

- 建议：新增 `docs/adr/NNNN-title.md`，包含：背景、决策、备选方案、取舍、后续工作。

## 15. 测试策略（建议）

来源：`docs/tech-framework.md`「测试」。

- 建议：单元测试优先用 Vitest，覆盖 renderer/main/service 的关键路径。
- 建议：涉及数据一致性（事务/迁移/导入回滚）与 IPC schema 的变更，必须配套测试用例。
- 建议：关键流程的 e2e 可用 Playwright（Electron）补齐（例如导入/导出、搜索、排序持久化）。

## 16. 代码风格规范（必须）

目标：让代码在多人协作下保持一致、可读、可自动化修正。

- 必须：格式化以工具配置为准（Prettier/ESLint/EditorConfig 等）；配置存在时，配置优先于本段文本。
- 必须：提交前保持“零噪声”diff：不要在同一个 PR 里混入无关的全文件格式化。
- 必须：TypeScript 不得为了“临时能跑”降低类型质量（例如随意扩大类型范围、用不必要的 `unknown`/`any` 绕过约束）；跨进程/跨层边界必须有明确的 schema。
- 必须：异步代码显式 `await` + 明确错误处理路径；不要吞错误；日志要可追踪（但不得泄露敏感信息）。
- 必须：React 组件保持“数据获取/状态”与“纯渲染”分离，避免在渲染期做重计算或读大字段。
- 建议：一个文件只做一件事（一个组件/一个 domain 模块/一个 IPC handler 集合），避免“巨型文件”。
- 建议：导入顺序保持稳定：
  - Node/Electron 内置与第三方依赖在前
  - 本地模块在后
  - 类型导入（`import type`）单独分组

## 17. 命名规范（必须）

命名原则：语义优先、避免缩写、可搜索、可预测。

### 17.1 通用命名

- 必须：变量/函数使用 `camelCase`；类型/枚举/类使用 `PascalCase`。
- 必须：布尔值使用 `is/has/can/should` 前缀（例如 `isLoading`、`hasError`）。
- 必须：事件处理函数使用 `handleXxx`（例如 `handleSubmit`、`handleKeyDown`）。
- 必须：异步函数用动词开头并表达副作用（例如 `fetchTasks`、`loadProject`、`saveSettings`）。
- 建议：常量（跨文件/跨模块公开的常量）使用 `UPPER_SNAKE_CASE`。

### 17.2 文件与目录命名

- 必须：目录使用 `kebab-case`（例如 `db-worker`、`task-detail`）。
- 必须：React 组件文件使用 `PascalCase.tsx`（例如 `TaskList.tsx`）。
- 必须：非组件模块（工具、领域逻辑、schema）使用 `kebab-case.ts`（例如 `task-schema.ts`、`ipc-channels.ts`）。
- 建议：测试文件与源文件同名，后缀明确（例如 `task-schema.test.ts`）。

### 17.3 IPC 与跨进程接口命名

来源：`docs/tech-framework.md`「IPC 设计规范」。

- 必须：IPC 通道按域命名：`db:*`、`settings:*`、`fs:*`、`app:*`。
- 必须：通道名表达“做什么”，而不是“怎么做”。示例：
  - `db:task.create`
  - `db:task.search`
  - `settings:get`
  - `app:openExternal`
- 必须：Preload 暴露的 API 使用 `window.api.<domain>.<verb>` 的业务级方法形态（例如 `window.api.task.create()`），不得暴露原始 `ipcRenderer` 原语。

### 17.4 DB Worker action 命名

来源：`docs/tech-framework.md`「DB Worker 通信协议」。

- 必须：DB Worker 的 `action` 使用 `domain.verb`（或 `domain.verb.detail`）的点分格式，示例：
  - `task.create`
  - `task.search`
  - `project.list`
- 必须：action 名是稳定 API；新增/变更必须同步更新文档与测试。

### 17.5 错误码命名

来源：`docs/tech-framework.md`「统一错误结构」。

- 必须：`AppError.code` 使用可枚举、可搜索的稳定字符串；推荐 `SCOPE_CODE` 或 `scope:code`，例如：
  - `IPC_INVALID_SENDER`
  - `DB_TIMEOUT`
  - `DB_CONSTRAINT`
  - `VALIDATION_FAILED`
- 必须：`message` 面向用户可读；`details` 面向排障（但必须可脱敏）。
