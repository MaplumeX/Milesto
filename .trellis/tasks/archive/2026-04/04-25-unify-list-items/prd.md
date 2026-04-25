# brainstorm: unify task and project list item components

## Goal

用户观察到任务条目和项目条目在代码库中由多个不统一的实现组成，希望统一为共享组件，减少重复并保证行为一致。

## What I already know

### 任务条目现状
- `TaskRow`（`src/features/tasks/TaskRow.tsx`）已经是一个统一组件，被 Today、Inbox、Upcoming、Anytime、Someday、Logbook、Trash、Project 页面复用。
- 不同场景仅通过 props 区分（如 `titlePrefix`、`showProjectAffiliation`、`onRestore` 等）。
- 共享子组件：`Checkbox`、`TaskProjectAffiliation`、`task-metadata-icons.tsx`。
- 有统一的 context menu（`useTaskContextMenu`）。
- 有统一的 inline 编辑器（`TaskInlineEditorRow` + `AnimatedTaskSlot`）。

### 项目条目现状（多处实现，未统一）

| 实现 | 文件 | 说明 |
|---|---|---|
| `ProjectViewRow` | `src/features/view-list/ProjectViewRow.tsx` | 在 Today/Anytime/Someday/Upcoming 的 task-style 列表中，已长得像 `TaskRow`（共享 `task-row-inner` / `task-title-button` / metadata classes），用 `ProjectProgressControl` 代替 `Checkbox`。 |
| 手写行 | `src/pages/AreaPage.tsx` ~L248–321 | 直接在页面里用 `<li className="task-row">` 渲染项目进度+标题按钮，无 context menu、无 DnD。 |
| 手写行 | `src/features/trash/TrashList.tsx` ~L137–160 | 同上，手写 `task-row` + 标题按钮。 |
| `SortableSidebarProjectNavItem` | `src/app/AppShell.tsx` ~L1813 | 侧边栏项目行，使用 `NavLink`，DOM 结构完全不同（`nav-item nav-project-row`），与 `ProjectViewRow` 不共享。 |
| `SortableSidebarAreaGroup` | `src/app/AppShell.tsx` ~L1979 | 区域分组行，结构与项目行相似但不同。 |
| Palette item | `src/app/SearchPanel.tsx` ~L195 | 项目搜索结果，使用通用 `palette-item` 样式，不是 row。 |

### 关键发现
- **没有统一的 `Row`/`ListItem` 原子组件**：列表行由共享 CSS class（`task-row`、`task-row-inner`、`task-title-button`、`task-row-metadata`）和部分共享子组件拼成，但没有提取出可组合的 primitive。
- **行为不一致**：
  - `TaskRow` 有 context menu，`ProjectViewRow` / AreaPage 手写 / TrashList 手写项目行 **没有** context menu。
  - `ProjectViewRow` 有 selection（在 `ViewList` 中），但 AreaPage 手写的项目行和 TrashList 的项目行使用不同的选择状态。
  - 侧边栏项目行使用 route-based active 状态，与列表 selection 模型不同。
- **DnD 模式不同**：
  - 列表内 DnD（task/project 在 ViewList/TaskList）是单容器排序（`@dnd-kit/sortable`），共用类似的 wrapper 模式。
  - 侧边栏 DnD 是多容器模型（area + project 可跨容器拖拽），结构不同。
- `ProjectViewRow` 缺少 context menu（是一个已知的行为缺口）。

## Assumptions (temporary)

- 目标不是把侧边栏项目行改成 `task-row-inner` 样式（侧边栏语义不同），而是把"任务式列表中的项目行"统一成共享组件。
- `AreaPage` 和 `TrashList` 中的手写项目行可以替换为统一的 `ProjectRow` 组件。
- 统一后，项目行的 context menu 应该补齐（至少支持基本操作：打开、编辑、归档/删除、移动到区域）。

## Decision

**范围**：选项 A — 只统一"任务式列表中的项目行"。
- 把 `ProjectViewRow`、AreaPage 手写、TrashList 手写合并为统一的 `ProjectRow` 组件。
- `TaskRow` 和 `ProjectRow` 保持平行独立，共用 CSS class 和部分子组件。
- 侧边栏项目行和 Search palette 项目项不纳入本次重构。

## Open Questions

1. ~~Project context menu~~ ✅ **确定补上**：项目行统一后支持 context menu，操作项与侧边栏项目行对齐。
2. ~~Inline editing~~ ✅ **确定不加**：项目行保持现状，通过 Enter/双击打开详情页编辑，不引入 inline editor。
3. ~~Selection & DnD 对齐~~ ✅ **确定补齐**：selection + DnD 都要补上，项目行行为与 `TaskRow` 对齐。

## Requirements

1. 创建统一的 `ProjectRow` 组件，替代所有任务式列表中的项目行实现。
2. `AreaPage` 和 `TrashList` 中的手写项目行替换为 `ProjectRow`。
3. `ProjectViewRow` 重构为基于 `ProjectRow`（或直接合并）。
4. `ProjectRow` 支持 context menu，操作项与侧边栏项目行对齐（编辑、归档、删除、移到区域等）。
5. `ProjectRow` 支持 selection（键盘上下选中、Enter 打开）。
6. `ProjectRow` 支持 DnD 拖拽排序（单容器 `@dnd-kit/sortable`）。
7. `ProjectRow` 保持现有视觉风格（`ProjectProgressControl` 代替 `Checkbox`、标题按钮、metadata 区域）。
8. 不引入 inline editor；项目行通过 Enter/双击打开详情页编辑。

## Acceptance Criteria

- [x] `src/features/projects/ProjectRow.tsx` 新组件存在，被 `ProjectViewRow`、`AreaPage`、`TrashList` 引用。
- [x] `AreaPage.tsx` 中手写项目行被删除，替换为 `ProjectRow`。
- [x] `TrashList.tsx` 中手写项目行被删除，替换为 `ProjectRow`。
- [x] `ProjectViewRow.tsx` 被重写为 `ProjectRow` 的薄包装。
- [x] 项目行支持 context menu（`useProjectContextMenu`）。
- [x] `ViewList` 中的项目行支持 selection（键盘导航）。
- [x] `AreaPage` 中的项目行支持 selection。
- [x] `TrashList` 中的项目行支持 selection。
- [x] `ViewList` 中的项目行支持 DnD 拖拽排序。
- [ ] `AreaPage` / `TrashList` 中的项目行支持 DnD（需要后端支持 area 内项目排序和 trash 条目排序，超出本次范围）。
- [x] 原有 `TaskRow` 行为不回归。
- [x] Lint / typecheck 通过。
- [x] Tests 无新增失败（既有 `upcoming-grouped-list` 失败与本次改动无关）。

## Definition of Done (team quality bar)

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope

- 侧边栏 DOM 重构（`SortableSidebarProjectNavItem` 的 `NavLink` 结构保持不变）。
- Search palette 的项目条目重构（`SearchPanel.tsx`）。
- `TaskRow` 和 `ProjectRow` 进一步抽到 `ListRow` primitive（未来演进方向）。
- 项目行 inline 编辑器（超出本次范围）。

## Technical Notes

- 关键文件锚点：
  - `src/features/tasks/TaskRow.tsx`
  - `src/features/view-list/ProjectViewRow.tsx`
  - `src/pages/AreaPage.tsx` ~L248–321
  - `src/features/trash/TrashList.tsx` ~L137–160
  - `src/app/AppShell.tsx` ~L1813 (sidebar project row)
- 共享子组件：`src/components/Checkbox.tsx`、`src/features/projects/ProjectProgressControl.tsx`、`src/features/tasks/task-metadata-icons.tsx`
- Context menus：`src/features/tasks/use-task-context-menu.tsx`、`src/app/use-sidebar-entity-context-menu.tsx`
