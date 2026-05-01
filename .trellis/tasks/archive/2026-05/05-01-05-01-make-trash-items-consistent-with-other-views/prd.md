# Make Trash Items Consistent with Other Views

## Goal

让废纸篓中的任务和项目条目在视觉、信息密度和交互上与其他视图完全一致，同时统一数据结构和列表组件，减少重复代码。

## What I already know

* TrashList 是独立组件，使用 `<ul>` 渲染，没有虚拟化
* TrashEntry schema 只包含 `kind`, `id`, `title`, `deleted_at`, `open_task_count`，缺少 notes、schedule、due、tags、project affiliation、status 等字段
* TaskRow 在 Trash 中接收硬编码的 synthetic task 对象，所有富字段被置为空值
* ProjectRow 在 Trash 中 `showOpenCount={false}`，`done_count=0`
* 无右键上下文菜单、无 TagFilter、无拖拽排序
* TaskInlineEditorRow 的 `scope="trash"` 打开编辑器时能加载完整数据，但行视图无法显示

## Assumptions

* 废纸篓不需要拖拽排序（删除顺序无业务意义）
* 废纸篓不需要 TagFilter（条目数量通常不多）

## Decisions

* **元数据范围**：全部字段 — note icon + schedule + due + tags + project affiliation（与其他视图完全一致）
* **数据结构统一**：TrashEntry 直接复用 `ViewListTaskItemSchema` 和 `ViewListProjectItemSchema`，消除 synthetic object 构造
* **列表组件复用**：TrashList 废弃，TrashPage 改用 ViewList（传 `listId=undefined` 禁用拖拽）
* **进度圆 + 右键菜单**：纳入范围，与 ViewList 一致 — 项目行用 ProjectViewRow（含进度圆 + 完成按钮），任务和项目均支持右键上下文菜单

### Decision: 统一数据结构（ADR-lite）

**Context**: TrashEntry 独立 schema 只携带 id/title/deleted_at，导致 TrashList 需要构造 synthetic task 对象且所有富字段置空，与其他视图不一致。

**Decision**: 废除独立的 TrashTaskEntry/TrashProjectEntry schema，Trash 列表直接复用 `ViewListTaskItemSchema`（= TaskListItemSchema + kind）和 `ViewListProjectItemSchema`。DB 查询 JOIN 相同字段（tags、project_title 等），TrashList 直接把 schema 数据传给 TaskRow/ProjectRow，不再构造 synthetic 对象。

**Consequences**:
- 优点：schema 统一，渲染逻辑零差异，未来新增字段自动同步
- 代价：trash DB 查询需多 JOIN tags + project_title（条目少，性能可忽略）
- `open_task_count` → 改用 `total_count - done_count`（ViewListProjectItem 已有这两个字段）
- TrashEntrySchema 作为 `ViewListItemSchema` 的别名导出，保持 API 命名清晰

### Decision: 复用 ViewList 组件（ADR-lite）

**Context**: TrashList 是独立组件，缺少虚拟化、完整键盘导航、乐观更新等，与 ViewList 重复大量逻辑。

**Decision**: TrashPage 改用 ViewList 组件，通过 props 控制差异：
- `listId` 不传 → 禁用拖拽排序
- 上下文菜单：与 ViewList 一致，使用 useTaskContextMenu / useProjectContextMenu，但 `scope="trash"` 控制菜单项内容
- 项目行：使用 ProjectViewRow（含 ProjectProgressControl 进度圆 + 完成按钮），与 Today/Anytime/Someday 完全一致
- TaskInlineEditorRow 传 `scope="trash"`

**Consequences**:
- 优点：虚拟化、键盘导航、乐观更新、进度圆、右键菜单全部自动获得；删除 ~150 行重复代码
- 代价：ViewList 需支持 `scope` prop 传递给 useTaskContextMenu 和 TaskInlineEditorRow；进度圆需 DB 返回 total_count/done_count（ViewListProjectItem 已有）
- 未来 Logbook 等视图也可类似复用

## Requirements

* `shared/schemas/trash.ts` 重构：TrashEntrySchema → ViewListItemSchema 别名
* DB trash-actions 查询扩展：JOIN tags + project_title + task count，返回与 ViewList 相同的字段集
* ViewList 支持 `scope` prop，传递给 useTaskContextMenu 和 TaskInlineEditorRow
* TrashList 组件废弃，TrashPage 改用 ViewList
* window.api 层适配：trash.list 返回 ViewListItem[] 而非 TrashEntry[]

## Acceptance Criteria

* [ ] Trash 中任务行显示 note icon（如有笔记）
* [ ] Trash 中任务行显示 schedule / due date
* [ ] Trash 中任务行显示 tag preview
* [ ] Trash 中任务行显示 project affiliation
* [ ] Trash 中项目行显示进度圆（ProjectProgressControl）+ open count
* [ ] Trash 中项目行支持完成操作
* [ ] 任务行右键菜单可用（scope="trash" 上下文）
* [ ] 项目行右键菜单可用
* [ ] 虚拟化滚动正常工作
* [ ] 键盘导航：方向键、Space 切换完成、Enter 打开
* [ ] 其他视图不受影响
* [ ] schema 变更向后兼容：`TrashEntrySchema` 仍作为类型别名导出

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green

## Out of Scope

* 拖拽排序（删除顺序无业务意义）
* TagFilter bar

## Technical Notes

* 关键文件：`shared/schemas/trash.ts`、`electron/workers/db/actions/trash-actions.ts`、`src/features/trash/TrashList.tsx`、`src/pages/TrashPage.tsx`、`src/features/view-list/ViewList.tsx`
* 复用 schema：`shared/schemas/view-list.ts`（ViewListTaskItemSchema、ViewListProjectItemSchema）、`shared/schemas/task-list.ts`（TaskListItemSchema）
* DB 查询需 JOIN：`task_tags`（tag_preview/tag_count/tag_ids）、`projects`（project_title）
* ViewListProjectItem 已有 `total_count` + `done_count`，`open_task_count = total_count - done_count`
* ViewList `scope` prop 传递链：ViewList → useTaskContextMenu({ scope }) / useProjectContextMenu → TaskInlineEditorRow({ scope })
* 项目进度圆数据源：ViewListProjectItem.total_count / done_count → ProjectProgressControl