## Context

Milesto 当前的“搜索”入口通过自定义事件 `milesto:ui.openCommandPalette` 打开 `src/app/CommandPalette.tsx`。
该组件把三类行为混在一起：

- 任务搜索（调用 `window.api.task.search`）
- 视图跳转命令（Today/Inbox/Upcoming/...）
- “输入即新建任务”（回车在无结果时创建 Inbox 任务）

这导致用户把它感知为“命名/创建面板”，而不是专用的“搜索面板”。

搜索后端目前在 DB Worker 中执行（`electron/workers/db/actions/task-actions.ts` 的 `task.search`），核心 SQL 为 `tasks_fts MATCH @query`（FTS5）。现状对“部分匹配”的支持不足。

本变更要求：移除命令面板与快捷键入口，改为居中遮罩弹窗 SearchPanel，并将搜索语义升级为“前缀/部分匹配”。

约束与已有实现可复用点：

- 现有 CSS 已有居中遮罩弹窗样式：`.palette-overlay` / `.palette` / `.palette-input` / `.palette-item`（`src/index.css`）
- 现有 `CommandPalette` 已实现 debounce 搜索、结果列表、高亮索引与 `jumpToTask()` 的跳转规则，可直接复用核心交互逻辑。

## Goals / Non-Goals

**Goals:**

- 用 SearchPanel（居中遮罩弹窗）替换 CommandPalette：只做“搜索 + 选择跳转”。
- 底部栏 Search 点击打开 SearchPanel；不保留任何快捷键入口（不监听 `Cmd/Ctrl+K`）。
- `Enter` 选择高亮结果：跳转到任务所在列表/项目并关闭面板。
- 搜索实现“前缀/部分匹配”：用户输入被转换为安全的 FTS5 prefix query；不暴露 FTS5 的高级语法给用户。
- 保留现有路由页 `src/pages/SearchPage.tsx`（`/search`），但不作为主要入口。

**Non-Goals:**

- 不实现新的命令体系/命令注册表；不替代 PRD 中的“命令面板能力”。
- 不新增外部依赖（例如 Fuse.js / cmdk）。
- 不改动数据库 schema/migrations（仅调整 query 构造与 UI 入口）。

## Decisions

1) **以 SearchPanel 取代 CommandPalette（同类 UI 复用样式）**

- 选择：新增 `SearchPanel` 组件（推荐放 `src/app/SearchPanel.tsx`），使用 `createPortal(..., document.body)` 渲染居中遮罩弹窗。
- 理由：现有 `.palette-overlay` / `.palette` 已满足视觉与层级需求（`z-index: 50`），最小化 CSS churn。
- 替代：复用 `TaskEditorPaper` 的 overlay-paper 模式。放弃原因：该模式是内容区内的绝对定位 overlay（`z-index: 30`，避开底部栏），不如 palette 适合全局搜索。

2) **事件命名：从 openCommandPalette 改为 openSearchPanel**

- 选择：将触发事件从 `milesto:ui.openCommandPalette` 改为 `milesto:ui.openSearchPanel`。
- 理由：语义清晰，避免历史命名误导；也便于完全删除旧组件与其副作用。
- 影响：`ContentBottomBarActions` dispatch 事件；`SearchPanel` 监听事件并打开。

3) **键盘交互只保留面板内的基础导航，不提供全局快捷键**

- 选择：移除 `CommandPalette` 内的全局 `window.addEventListener('keydown'...)`（`Cmd/Ctrl+K` 切换逻辑）。
- 理由：需求明确“不需要快捷键入口”；减少全局监听对其它输入场景的干扰。
- 面板内：
  - `Escape` 关闭
  - `ArrowUp/ArrowDown` 移动高亮
  - `Enter` 执行“选择并跳转”

4) **关闭方式：Escape + 点击遮罩 (outside click)**

- 选择：SearchPanel 支持点击遮罩关闭（`CommandPalette` 目前只有 ESC/按键关闭）。
- 理由：符合“搜索面板”而非“命令执行面板”的预期；同时满足鼠标用户。
- 细节：点击面板内部不关闭；关闭时清空 query/results/highlight。

5) **跳转规则复用现有 jumpToTask 逻辑**

- 选择：沿用 `CommandPalette` 的 `jumpToTask(item)` 路由判定：
  - done -> `/logbook`
  - scheduled_at == today -> `/today`
  - scheduled_at > today -> `/upcoming`
  - project_id -> `/projects/:id`
  - is_inbox -> `/inbox`
  - is_someday -> `/someday`
  - else -> `/anytime`
- 理由：现有行为已覆盖主要入口，避免引入新规则导致回归。

6) **FTS5 前缀/部分匹配在 DB Worker 侧实现（统一语义）**

- 选择：在 `task.search` action 内将 `parsed.data.query` 转为安全的 prefix query，再传给 `tasks_fts MATCH @query`。
- 理由：SearchPanel 与 SearchPage 共用 `window.api.task.search`；语义应统一，且 DB Worker 是正确的边界。
- 构造算法（关键点）：
  - 按空白拆分 token
  - token 内 `"` 转义为 `""`
  - 每个 token 输出为 `"<token>"*`（注意 `*` 必须在双引号外，符合 FTS5 prefix query 语法）
  - tokens 以空格 join（FTS5 隐式 AND）
- 结果：用户输入 `mil pro` 命中 `milesto project` 等前缀匹配；不允许用户通过输入 `AND/OR/NOT/title:` 注入查询语法。

## Risks / Trade-offs

- **[与 PRD/tech-framework 不一致：移除命令面板与 Cmd/Ctrl+K]** → Mitigation：在 specs 中明确“本变更刻意偏离文档”，并在后续 PR 同步更新 `docs/prd/01-v0.1-mvp.md` 与 `docs/tech-framework.md`（或新增 ADR/注释说明）。
- **[改变 search 语义可能影响少数用户预期]**（例如有人依赖 FTS5 高级语法） → Mitigation：将 query 视为纯文本搜索是更安全的默认；若未来需要高级语法，可另行提供“高级模式”开关。
- **[短前缀可能性能较差]**（如单字符前缀命中项多） → Mitigation：保留 debounce（120-150ms）与 LIMIT 200；必要时可在 UI 层引入最小长度门槛（后续再评估）。
- **[多处 Escape/全局捕获监听冲突]**（底部栏 popover、项目菜单等也监听 Escape） → Mitigation：SearchPanel 打开时优先在自身 input 的 onKeyDown 里 `preventDefault/stopPropagation` 处理 Escape；必要时在打开时加捕获监听确保先关闭 SearchPanel。
