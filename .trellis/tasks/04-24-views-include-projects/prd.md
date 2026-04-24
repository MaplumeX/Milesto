# brainstorm: views include projects

## Goal

让“今天 / 某天 / 等等”这类时间或清单视图不仅展示任务，也能展示符合相同筛选条件的项目，减少用户必须从侧边栏或项目页单独查找项目的割裂感。

## What I already know

* 用户希望新开一个任务，先做设计方案。
* 当前 `TodayPage`、`AnytimePage`、`SomedayPage` 使用 `TaskList`，数据来源分别是 `window.api.task.listToday`、`listAnytime`、`listSomeday`。
* 当前 `UpcomingPage` 使用 `UpcomingGroupedList`，数据来源是 `window.api.task.listUpcoming`。
* 当前上述列表 API 都只返回 `TaskListItem[]`，没有项目条目。
* 项目已有 `scheduled_at`、`is_someday`、`due_at`、`status`、`deleted_at` 等字段，和任务 bucket 语义基本对齐。
* 项目列表渲染已有 `ProjectProgressIndicator`，侧边栏也已有项目进度计数 API `task.countProjectsProgress` 可复用。

## Assumptions (temporary)

* “今天”对应 `scheduled_at = today` 的开放项目。
* “某天”对应 `is_someday = true` 的开放项目。
* “等等这些视图”优先覆盖 `TodayPage`、`UpcomingPage`、`AnytimePage`、`SomedayPage`；是否包含 `InboxPage` 需要确认。
* 项目双击或键盘 Enter 后进入 `/projects/:projectId`，不在这些视图里展开项目任务。
* 项目仍保持项目身份，不伪装成任务，因此不支持任务 checkbox；项目完成入口沿用项目进度圆环。

## Open Questions

* 无。

## Requirements (evolving)

* MVP 覆盖 `TodayPage`、`UpcomingPage`、`AnytimePage`、`SomedayPage`。
* 列表视图必须在同一个列表里混排任务和项目，不使用“任务区 / 项目区”这类专门分组。
* 项目条目在列表里尽量保持任务行的同等视觉密度和层级，不额外加“Project/项目”标签。
* 项目条目可保留项目自身必要 affordance，例如进度圆环、单击聚焦、双击/Enter 进入项目页。
* 今天、随时、某天视图使用统一手动排序：任务和项目都能在同一个列表中拖到任意位置。
* 项目行左侧保留项目进度圆环，点击圆环沿用现有项目完成逻辑：需要确认，并会批量完成项目内开放任务。
* 项目条目遵循各视图现有筛选语义：日期、某天、未删除、开放状态。
* 标签筛选同时作用于任务和项目：选中标签后，命中任一选中标签的任务或项目都显示。
* 当项目本身和它的子任务都命中同一视图时，项目和任务都作为独立行显示。
* 单击项目条目只聚焦/选中；双击项目条目或选中后按 Enter 进入项目详情页。
* 不破坏现有任务列表排序、拖拽、快捷键、标签筛选行为。

## Acceptance Criteria (evolving)

* [ ] 今天视图能在同一列表中混排展示计划为今天的开放项目和今天任务。
* [ ] 某天视图能在同一列表中混排展示 `is_someday=true` 的开放项目和某天任务。
* [ ] 随时视图能在同一列表中混排展示未计划且非某天的开放项目和任务。
* [ ] 未来视图能按日期分组，并在每个日期组内混排展示未来计划项目和未来任务。
* [ ] 项目条目单击后仅聚焦/选中，不导航。
* [ ] 项目条目双击或选中后按 Enter 导航到项目页。
* [ ] 项目行左侧进度圆环可触发现有项目完成确认流程。
* [ ] 今天、随时、某天视图的手动排序能同时持久化任务和项目的相对顺序。
* [ ] 标签筛选选中某个标签时，同时保留匹配该标签的任务和项目。
* [ ] 同一项目及其子任务同时命中视图条件时，二者都作为独立行显示。
* [ ] 任务现有勾选、打开、拖拽排序和标签筛选不回退。
* [ ] 数据层 schema 能区分任务条目和项目条目，避免 UI 依赖字段猜测类型。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不在混合视图里内联编辑项目标题、笔记或项目任务。
* 不把项目拖拽排序写入任务的 `list_positions`。
* 不改变项目页本身的任务分组和完成逻辑。
* 不覆盖 `InboxPage`，除非后续单独定义项目进入 Inbox 的语义。
* 不改变任务 bucket 归属规则。

## Technical Notes

* `src/pages/TodayPage.tsx`、`src/pages/AnytimePage.tsx`、`src/pages/SomedayPage.tsx` 当前只维护 `TaskListItem[]` state。
* `src/pages/UpcomingPage.tsx` 当前按任务 `scheduled_at` 分组。
* `src/features/tasks/TaskList.tsx` 强绑定任务交互：选择任务、打开任务编辑器、勾选任务、拖拽任务排序。
* `electron/workers/db/actions/task-actions.ts` 的 `task.listToday/listAnytime/listSomeday/listUpcoming` 只查询 `tasks`。
* `electron/workers/db/actions/project-actions.ts` 和 `sidebar-actions.ts` 已有项目查询模式，可扩展项目列表 API 或新建通用视图 API。
* `shared/schemas/project.ts` 已定义项目字段；`shared/schemas/task-list.ts` 是当前任务列表 schema。
* 当前 `list_positions` schema 是 `(list_id, task_id, rank, updated_at)` 且 `task_id` 外键指向 `tasks`，不能直接持久化项目位置。
* 混合实体手动排序需要新表或迁移排序表。为降低破坏面，推荐新增混合视图排序表而不是改造任务专用 `list_positions`。
* 项目已有 `project_tags`、`project.setTags` 和 `project.getDetail` 标签能力；当前列表页 `TagFilter` 只从任务 `tag_ids` 派生可选标签。

## Candidate Approaches

### Approach A: New mixed view model (Recommended)

* 新增 `ViewListItem = TaskViewItem | ProjectViewItem` 判别联合类型，例如 `kind: 'task' | 'project'`。
* 新增视图级 API（如 `view.listToday/listAnytime/listSomeday/listUpcoming`）或清单 API，后端分别查询任务和项目后合并排序。
* 新增 `MixedEntityList`/`ViewList` 组件，复用 `TaskRow` 渲染任务，新增视觉密度接近任务行的 `ProjectRow` 渲染项目。
* 同一列表内不显示实体类型分隔标题；项目不额外显示“项目”标签。
* 新增 `view_positions` 表持久化混合排序，例如 `(list_id, entity_type, entity_id, rank, updated_at)`，其中 `entity_type` 为 `task` 或 `project`。
* 迁移/初始化策略：首次使用混合视图时，把对应 `list_positions` 中已有任务顺序映射到 `view_positions`，未排序任务/项目按现有默认排序追加。
* 新增 `view.reorderBatch(listId, orderedItems)`，只用于今天、随时、某天这类混合视图；项目页、Inbox、项目分组内任务排序继续使用现有 `task.reorderBatch`。
* 优点：类型清晰，任务与项目职责分离，避免污染任务 API；后续可扩展 area/header 等实体。
* 缺点：需要新增 schema、API、组件、排序表、导入导出/同步兼容和测试，改动面中等。

### Approach B: Extend task list items with optional project shape

* 在现有 `TaskListItem` 基础上加入项目字段或用 nullable 字段塞进项目数据。
* 现有页面继续使用 `TaskList`，内部判断条目类型。
* 优点：短期改动少。
* 缺点：违反单一职责，任务交互和项目交互容易混杂；schema 语义变差，后续维护成本高。

### Approach C: UI-side parallel loading and local merge

* 页面同时调用任务 API 和项目 API，在 React 层合并成混合列表。
* 优点：不需要立即改动 IPC/DB 合同太多。
* 缺点：排序一致性、分页/虚拟列表、标签筛选、错误处理会分散在多个页面，重复逻辑较多。

## Preliminary Recommendation

推荐 Approach A：新增判别联合的视图模型和专用混合列表。它最符合 KISS/SOLID：任务列表继续只处理任务，混合视图负责混合实体，项目行只处理项目导航和状态展示。按用户补充要求，混合列表不做任务/项目分区，仅在同一列表中自然混排。

## Decisions

* MVP 覆盖：今天、未来、随时、某天。
* 展示形态：任务和项目显示在同一个列表里，不做专门分区或类型标题。
* 排序规则：今天、随时、某天采用统一手动排序，任务和项目都能拖到任意位置。
* 项目完成交互：项目行左侧保留项目进度圆环，点击后走现有项目完成确认和批量完成逻辑。
* 标签筛选：任务和项目都参与筛选，筛选命中规则一致为“拥有任一选中标签”。
* 命中去重：项目和任务不互相隐藏；即使项目和项目内任务都命中，也都显示为独立行。

## Technical Approach

* 数据模型：新增混合视图条目 schema，使用 `kind` 做判别联合，避免用可空字段猜测实体类型。
* 数据查询：新增视图 API，从 `tasks` 和 `projects` 分别查询开放、未删除、符合 bucket 的实体，再按 `view_positions.rank` 合并排序。
* 排序持久化：新增 `view_positions`，不要修改现有 `list_positions` 任务专用合同，避免影响项目页分组任务排序和既有导入导出。
* UI 组件：新增混合列表组件，保留任务原有交互；项目行使用相同列表行密度，单击聚焦，双击/Enter 导航到项目页。
* 项目完成：项目行使用 `ProjectProgressControl`，完成行为复用 `project.complete` 和现有确认文案/批量完成语义。
* 标签筛选：混合视图条目包含 `tag_ids` 和轻量 tag preview；`TagFilter` 的可选标签从任务与项目合并计算。
* 未来视图：按 `scheduled_at` 分组，每个日期桶内用同一混合行模型排序；跨日期拖拽不作为 MVP。

## Implementation Plan (small PRs)

* PR1: 新增混合视图 schema、`view_positions` 表、视图查询 API 和 DB 测试。
* PR2: 新增混合列表/项目行组件，接入今天、随时、某天视图及统一拖拽排序。
* PR3: 接入未来视图日期分组、标签筛选、项目进度完成入口和 renderer 测试。
