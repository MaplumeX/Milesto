## Context

Milesto 现有废纸篓能力已经覆盖软删除项目/任务根条目的列出、恢复、永久删除与清空，但 Renderer 侧实现仍然是独立的 `TrashPage + TrashList` 管理页。当前废纸篓条目只能被选中并触发恢复/彻底删除，不能像普通任务列表或项目页一样继续进入和编辑。

这次变更会跨越多个层次：

- Renderer：废纸篓列表、任务行内编辑器、项目页、全局底部栏
- Shared contracts：detail/update/create 输入模型需要显式支持 `trash` 作用域
- DB actions：现有 `task.*` / `project.*` 详情与保存逻辑默认只允许 `deleted_at IS NULL`

现有软删除模型仍然是对的：对象保留实体行，通过 `deleted_at` / `purged_at` 控制可见性与恢复性。问题不在于数据模型，而在于“删除态对象缺少工作视图”。

## Goals / Non-Goals

**Goals:**

- 让 `/trash` 看起来像正常工作列表，而不是带行内动作按钮的管理页。
- 保持废纸篓中的项目和任务混合排序，并让用户把“打开条目”作为默认操作。
- 允许删除态任务直接打开现有行内编辑器并继续编辑，且不自动恢复。
- 允许删除态项目进入现有项目详情页并继续编辑，且不自动恢复。
- 支持删除态项目中的新建任务/新建分组，并让新建内容默认仍属于删除态项目树。
- 明确 trash mode 下哪些动作可用、哪些动作第一版先隐藏，避免和 active 语义互相污染。

**Non-Goals:**

- 这次不实现废纸篓右键菜单，只为后续菜单留出稳定入口。
- 这次不新增独立的 trash 专用项目页或 task editor 副本。
- 这次不放开 trash mode 下的任务/项目跨容器移动。
- 这次不改变 active 模式下的软删除、恢复或清空语义。

## Decisions

### Decision: 用显式 `scope=trash` 复用现有详情与编辑链路，而不是复制一套 Trash 专版页面

任务与项目继续复用现有主工作流组件：

- 任务：`TaskSelection` + `TaskInlineEditorRow` + `TaskEditorPaper`
- 项目：`ProjectPage`

但跨 IPC / DB 边界时显式传入 `scope: 'trash'`，只在该作用域下允许访问 `deleted_at IS NOT NULL AND purged_at IS NULL` 的对象。

原因：

- 用户要的是“正常进入和编辑”，不是新造一套废纸篓专属详情 UI。
- 复用现有组件能保持视觉、键盘与保存体验一致。
- 显式 scope 能把 active 与 trash 的语义隔离开，避免“普通详情接口被静默放宽”。

备选方案：

- 静默放宽现有 `getDetail/update`：改动看似小，但会把 active / trash 语义混在一起，后续难维护。
- 新建独立 Trash 专版详情页：隔离最好，但会显著重复逻辑与 UI，不符合 DRY。

### Decision: 删除态项目直接复用 `/projects/:id`，用查询参数切换到 trash scope

删除态项目的进入路径采用 `/projects/:projectId?scope=trash`，不新增 `/trash/projects/:id` 平行路由。

原因：

- 用户明确要“正常进入项目页”，而不是在 Trash 下看另一个详情页。
- 现有项目页路由、底部栏与选中逻辑都围绕 `/projects/:id` 建立，扩展 query 参数比复制路由更稳。
- 这样可以把 trash mode 视为项目页的一种上下文，而不是另一种页面类型。

备选方案：

- `/trash/projects/:id`：能隔离路由，但会引入一套平行详情页心智与更多分支判断。

### Decision: 废纸篓主列表采用“open-first”交互，移除行内恢复/彻底删除按钮

`/trash` 主列表只强调“打开条目”：

- 单击选中
- `Enter` / 双击打开
- 任务在列表内联展开编辑
- 项目进入 `?scope=trash` 的项目页

行内 `恢复/彻底删除` 按钮从主列表移除，后续由右键菜单承载；顶部仅保留 `清空废纸篓`。

原因：

- 用户明确拒绝“管理页味道”和行内操作按钮。
- 这能让废纸篓更接近普通任务/项目工作视图。
- 右键菜单会是更自然的次级动作承载位置。

备选方案：

- 保留现有按钮：可发现性高，但会持续把页面拉回管理页风格。
- 悬停 `...` 菜单：也能工作，但仍然会强调“操作入口”而不是“打开条目”。

### Decision: 删除态对象允许内容编辑，但第一版收紧结构性动作

trash mode 第一版允许的动作：

- 编辑标题、备注、计划/截止、标签、完成状态、checklist
- 删除态项目里新建任务与分组
- 删除态项目内排序与分组重命名

第一版暂不暴露：

- 任务 Move
- 任务再次 Delete
- 项目 Move 到 Area
- 项目再次 Delete
- `/trash` 顶层页面的新增任务入口

原因：

- 这些结构性动作当前都默认按 active surfaces 和 active destinations 设计，直接开放会让 trash 语义变模糊。
- 先把“正常进入和编辑”落稳，再设计右键菜单与更复杂的结构操作，符合 YAGNI。

备选方案：

- 一次性开放所有动作：功能更全，但状态组合会急剧膨胀，风险高。

### Decision: 删除态项目中的新建子项直接以删除态写入

当项目页处于 `scope=trash` 且目标项目仍为 recoverable deleted project 时：

- `task.create` 新建的任务默认写入该项目，并带非空 `deleted_at`
- `project.createSection` 新建的分组默认带非空 `deleted_at`

这些新建子项不会触发项目自动恢复。

原因：

- 用户明确要求删除态项目中可以继续新建，同时新建内容也应留在废纸篓。
- 现有项目恢复/清空逻辑已经按 `project_id + deleted_at IS NOT NULL + purged_at IS NULL` 聚合子项，不依赖和项目相同的删除时间戳，兼容这条新语义。

备选方案：

- 新建即自动恢复项目：最简单，但违背用户要求。
- 禁止新建：能降低复杂度，但同样违背用户要求。

## Risks / Trade-offs

- [删除态与活跃态共用同一批详情接口] → 通过显式 `scope` 参数隔离语义，默认值保持 `active`。
- [项目页 trash mode 会触碰较多 active-only 查询] → 明确列出需要支持 `scope=trash` 的 `getDetail/listProject/listProjectDone/countProjectDone/listSections/createSection/update/create` 链路，并配套测试。
- [删除态任务的底部栏动作变少，短期内会显得“不完整”] → 第一版优先稳定“打开并编辑”，恢复/彻底删除留给后续右键菜单统一承载。
- [删除态项目里继续新建内容会放大恢复/清空语义范围] → 依赖现有按项目树收敛的恢复/清空 SQL，并新增“删除后创建的子项仍参与恢复/清空”的测试。

## Migration Plan

1. 扩展共享 schema 与 `window.api` 输入模型，支持可选 `scope: 'active' | 'trash'`。
2. 让 DB actions 在默认 `active` 语义不变的前提下，增量支持 `trash` 作用域的 detail/update/create/list 行为。
3. 将 `/trash` 列表调整为 open-first 工作列表，并移除行内恢复/彻底删除按钮。
4. 为项目页增加 `?scope=trash` 支持，接通删除态项目的详情、编辑、新建子项与动作收紧逻辑。
5. 补充 DB-level 与 renderer/self-test 覆盖，再进入实现。

## Open Questions

- 无。当前产品边界已足够支持实现阶段拆分任务。
