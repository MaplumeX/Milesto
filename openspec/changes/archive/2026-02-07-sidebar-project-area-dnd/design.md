## Context

- Sidebar 当前在 `src/app/AppShell.tsx` 内实现：通过 `window.api.area.list()` + `window.api.project.listOpen()` 拉取数据，在 renderer 内按 `project.area_id` 分组渲染。
- 现有 Sidebar 的排序逻辑来自 DB 查询：`area.list` / `project.listOpen` 都是 `ORDER BY title COLLATE NOCASE ASC`（字母序）。
- 仓库已使用 `@dnd-kit`（见 `src/features/tasks/TaskList.tsx`、`src/features/tasks/ProjectGroupedList.tsx`），并且已经实现了：
  - 单容器排序（TaskList：持久化到 `list_positions`）
  - 多容器 + 跨容器移动（ProjectGroupedList：拖拽中草稿重排、drop 后持久化，出错回滚）

约束（红线/标准）：
- Renderer 只能调用 `window.api.*`；Preload 不得暴露高危原语；IPC 必须 request/response + schema 校验；DB 写入必须事务（`docs/redlines.md`、`docs/standards.md`）。
- 若支持拖拽排序，必须提供键盘等价（`docs/ui.md`）。

## Goals / Non-Goals

**Goals:**
- Sidebar 支持：
  - Areas 拖拽重排（持久化）。
  - Projects 在同一 Area（含未归属组）内拖拽重排（持久化）。
  - Projects 跨 Area（含未归属组）拖拽移动，改变所属（更新 `projects.area_id`），并可插入到目标列表任意位置（持久化）。
- 默认行为向后兼容：从未使用过手动排序的用户，仍按现有字母序显示。
- 键盘等价：至少支持同组（Area 列表 / 单个 Area 下 Project 列表 / 未归属 Project 列表）上移/下移重排，并触发同样的持久化。
- 失败可恢复：持久化失败时 UI 回滚到拖拽前状态，并展示统一错误结构（code/message）。

**Non-Goals:**
- 不改变 Area 页面 / Project 页面里 Project 列表的展示顺序（这些页面目前是字母序或各自规则）；本变更聚焦 Sidebar 导航顺序。
- 不支持 2 层以上的嵌套（例如 Area 下再分组）；仅处理 Area -> Project 两级。
- 不在本变更中引入新的 DnD 库或额外重型依赖。

## Decisions

### 1) 顺序持久化：在 `areas` / `projects` 表新增可空 `position`

选择：为 `areas` 与 `projects` 增加 `position INTEGER NULL`。
- `areas.position`：全局 Area 顺序。
- `projects.position`：Project 在其所属作用域内的顺序；作用域由 `projects.area_id` 决定（`NULL` 表示未归属组）。

理由：
- Sidebar 的排序上下文天然唯一（不像 task 在 Today/Project/Area 等多列表需要独立顺序），不需要复用 `list_positions`。
- 和现有 `project_sections.position`、`task_checklist_items.position` 的“实体表内 position + 1000 步长”模式一致。

关键点：position 允许 `NULL`，用于向后兼容字母序。

### 2) Lazy 初始化（避免 mixed ordering）

风险：如果只给被拖拽的少数条目写 position，会出现“部分有 position、部分 NULL”的混合排序，导致列表看起来跳。

策略：首次对某个作用域进行“手动排序相关写入”（reorder 或 move）时：
- 若该作用域内存在任意 `position IS NULL`，先按当前字母序把该作用域所有条目的 position 写满（例如 1000, 2000, 3000...）。
- 再应用这次拖拽结果。

作用域：
- Areas：整个 areas 表（未删除）。
- Projects：按 `area_id` 分组分别初始化（包括 `area_id IS NULL` 的未归属组）。

### 3) Read API：为 Sidebar 引入专用 list 接口（避免影响其它 UI）

注意：`window.api.area.list()` / `window.api.project.listOpen()` 目前也被 ProjectPage/TaskEditor 的下拉选择等使用，它们预期字母序更合理。

决策：新增 Sidebar 专用 API，不改变现有 list 的排序语义：
- `window.api.sidebar.listModel()`（推荐，返回 `{ areas, openProjects }`，且顺序已按 sidebar 规则排序）
  - 或者拆成 `window.api.area.listForSidebar()` + `window.api.project.listOpenForSidebar()`。

推荐单一 `sidebar.listModel()`：减少 renderer 端组合逻辑分叉，并让 DB 层统一处理排序策略（position + title fallback）。

### 4) Write API：用 DB Worker 单事务实现“跨 Area 移动 + 两侧重排”

跨 Area move 需要原子性：更新 `projects.area_id` 并同时更新“来源列表/目标列表”的 positions。

决策：新增 DB worker action（经 preload 暴露为业务级 window.api）：
- `sidebar.reorderAreas({ ordered_area_ids })`
- `sidebar.reorderProjects({ area_id: string | null, ordered_project_ids })`
- `sidebar.moveProject({ project_id, from_area_id, to_area_id, from_ordered_project_ids, to_ordered_project_ids })`

要求：
- 全部写入必须在一个 transaction 内完成。
- payload/返回值必须用 zod schema 校验（沿用现有模式）。

### 5) Renderer：复用 `ProjectGroupedList` 的多容器 DnD 模式

插入点：将 `DndContext` 放到 `src/app/AppShell.tsx` 的 `<nav className="nav">` 附近，确保拖拽行为被限制在 sidebar，同时利用 `.nav` 的滚动容器实现可预期的 auto-scroll。

实现模式：
- Containers：
  - 未归属组：`sidebar:unassigned`
  - 每个 Area：`sidebar:area:<areaId>`
- Items：
  - Area draggable id：`area:<areaId>`（用于 area 重排）
  - Project draggable id：`project:<projectId>`（用于 project 重排/跨 area move）
- `onDragOver`：维护草稿顺序（用 ref + signature 去重），提供稳定的拖拽中插入反馈。
- `onDragEnd`：根据 from/to container 分支调用对应持久化 API；失败则回滚快照。
- Collision：复用 `pointerWithin` 优先 + `closestCenter` fallback，并对 header/tail dropzone 提升优先级（对齐 `src/features/tasks/ProjectGroupedList.tsx`）。
- Overlay：使用 `DragOverlay`，并在原列表中隐藏 active item（避免双影子/布局抖动）。

### 6) 键盘等价：沿用 “Cmd/Ctrl + Shift + ArrowUp/Down”

沿用 `TaskList.tsx` 中的键盘重排 chord，应用到 Sidebar 的：
- Area list
- Project list（按当前聚焦的那一组：unassigned 或某个 area）

跨组移动的键盘等价（把 project 移到另一个 area）属于增强项，可先不做；如需要，可加一个“Move to Area…” 的命令/菜单作为键盘路径。

## Risks / Trade-offs

- [混合 NULL/非 NULL position 导致排序跳变] → 通过 lazy 初始化“作用域内一次性写满 position”规避。
- [新增排序字段会影响导入/导出一致性] → position 需要纳入导入/导出；为兼容旧导出文件，字段应为可选/可空（避免强制 bump schema_version）。
- [API 过多导致 surface area 增加] → 将 Sidebar 相关读写集中在 `window.api.sidebar.*`，避免污染 `area.*` / `project.*` 的既有语义。
- [拖拽与点击导航冲突] → 采用 dnd-kit sensor activationConstraint（distance）减少误触；drag handle/activator 选择需避免影响 NavLink 点击。
- [数据一致性] → moveProject 必须单事务，且必须更新 `updated_at`（sync-ready 约束）。

## Migration Plan

1) DB schema 迁移：
- 将 SQLite `user_version` 从 1 升到 2。
- `ALTER TABLE areas ADD COLUMN position INTEGER;`
- `ALTER TABLE projects ADD COLUMN position INTEGER;`
- 增加索引（建议）：
  - `idx_areas_position` on `(position)`
  - `idx_projects_area_position` on `(area_id, position)`

2) 保持默认字母序：新列默认 NULL，不进行全量回填。

3) 在写接口里做 lazy 初始化：第一次 reorder/move 时为对应作用域回填 position。

4) 回滚策略：
- 若需要回滚到不支持 position 的版本：新列留在 DB 中不会影响旧代码（旧查询不引用该列）；用户数据无需清空。

## Open Questions

- 是否需要支持“按字母序/按手动序”的显式切换（设置项）？当前设计默认：未启用手动排序前是字母序；一旦启用后永远手动序。
- 键盘跨 Area move 是否为 v0.1 必须？若是，需要定义可发现的键盘交互（例如 Command Palette 动作）。
