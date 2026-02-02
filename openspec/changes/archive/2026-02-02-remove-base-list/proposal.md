## Why

当前任务的三种基础归属（Inbox/Anytime/Someday）通过持久化字段 `base_list` 表达，导致：
- 归属语义与“派生视图”（Today/Upcoming/Project）混杂，规则难以扩展（例如 Someday 复用 Schedule 显示位）。
- 代码链路跨 DB schema / IPC / UI，重构成本高且容易产生不一致。

我们希望用更直接的布尔标记表达“明确归属”（Inbox / Someday），并把 Anytime 收敛为可解释的派生筛选。

## What Changes

- **BREAKING**：彻底删除 `base_list` 字段（DB schema、shared zod schemas、IPC payload、window.api、UI）。
- 新增任务字段：
  - `is_inbox: boolean`：仅在 Inbox 视图创建时默认 true；一旦设置 project / scheduled / someday 则自动清 false。
  - `is_someday: boolean`：Someday 归属标记；允许 project_id；不允许 scheduled_at。
- 重新定义视图：
  - Inbox：`is_inbox=true` 的 open tasks。
  - Someday：`is_someday=true` 的 open tasks（允许 project_id）。
  - Anytime：派生视图（open 且 `scheduled_at IS NULL` 且 `is_inbox=false` 且 `is_someday=false`），允许 project_id。
- Schedule 编辑 UI 支持三态：None / Date / Someday。
  - 选择 Someday 时 `is_someday=true` 且 `scheduled_at=null`。
  - 选择 Date 时 `scheduled_at=<date>` 且 `is_someday=false`。
- Command Palette / 导航优先级：当任务有 `project_id` 时默认跳转 Project（优先于 Anytime）；done/today/upcoming 仍优先。
- 导入导出格式随 TaskSchema 变化：导出 task 记录删除 `base_list`，新增 `is_inbox` / `is_someday`。
  - 本变更不要求兼容旧 DB（开发阶段会清库），但导入导出 schema_version 仍需保持一致性。

## Capabilities

### New Capabilities
- `task-bucket-flags`: 任务归属与视图规则：`is_inbox` / `is_someday` 语义、不变量、Inbox/Anytime/Someday 的筛选定义，以及 Schedule 三态（Someday 占用 schedule 显示位）。

### Modified Capabilities
- `task-editor-auto-save`: 自动保存字段列表从包含 `base_list` 调整为包含 `is_inbox` / `is_someday`。
- `task-inline-editor`: Schedule 的“有值”判断从仅 `scheduled_at` 扩展为（`scheduled_at` 或 `is_someday`），并在 picker 中提供 Someday 选项。

## Impact

- DB：`tasks` 表结构与索引；相关查询（listBase 以及任何依赖 base_list 的筛选）。
- Shared schemas：`BaseListSchema`、Task/TaskListItem/相关输入 schema。
- IPC + preload：`db:task.listBase` 与 window.api.task.listBase 需要被新 API 替代。
- Renderer：/inbox /anytime /someday 页面、创建任务默认值、任务编辑器 Schedule UI、CommandPalette 跳转逻辑。
- Data transfer：export/import 读取/写入的 TaskSchema 变更。
