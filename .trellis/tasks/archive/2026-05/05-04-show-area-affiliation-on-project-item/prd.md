# 项目条目显示所属领域

## Goal

让项目条目（ProjectRow）像任务条目显示所属项目一样，显示其所属领域的名称，帮助用户在 Anytime/Someday/Today/Upcoming 等视图中识别项目的领域归属。

## What I already know

- 任务通过 `TaskProjectAffiliation` 组件显示所属项目名称，有 `showProjectAffiliation` 控制
- 任务在项目页面中 `showProjectAffiliation=false`（已在该项目内，无需重复）
- 项目条目 `ProjectRow` 类型 `ProjectRowProject` 有 `area_id` 但无 `area_title`，UI 从不显示领域
- DB 查询 `projectSelectColumns()` 只取 `p.area_id`，未 JOIN areas 表获取 title
- Schema `ViewListProjectItemSchema` 只定义了 `area_id`，无 `area_title`
- 整个项目中 `area_title` / `area_name` 完全不存在
- `ProjectViewRow` 是 `ProjectRow` 的薄包装，被 `ViewList`、`UpcomingViewGroupedList`、`AreaPage` 使用
- 项目出现在 Anytime、Someday、Today、Upcoming、Trash、Area 页面

## Requirements

- 在 `ViewListProjectItemSchema` 和 `ProjectRowProject` 类型中添加 `area_title` 可选字段
- DB 查询 `projectSelectColumns()` LEFT JOIN areas 表，获取 `a.title AS area_title`
- 前端 `ProjectRow` 组件中在 `task-title-stack` 内渲染领域归属，参照 `TaskProjectAffiliation` 模式
- 在领域页面（AreaPage）中，项目条目应隐藏领域归属（类似任务在项目页面中隐藏项目归属）
- 领域归属的视觉样式复用 `task-project-affiliation` CSS class

## Decision (ADR-lite)

**Context**: 需要决定 AreaPage 中项目条目是否显示领域归属，以及视觉样式
**Decision**: AreaPage 中隐藏领域归属（与任务在项目页面隐藏项目归属一致）；复用 `task-project-affiliation` CSS class
**Consequences**: 保持 UI 一致性，减少视觉噪音

## Acceptance Criteria

- [ ] 在 Anytime/Someday/Today/Upcoming/Trash 页面中，项目条目显示所属领域名称
- [ ] 在 AreaPage 中，项目条目不显示领域归属
- [ ] 没有 area_id 的项目不显示领域归属
- [ ] 数据库查询正确 LEFT JOIN areas 表获取 area_title
- [ ] 类型检查通过

## Definition of Done

- Lint / typecheck 通过
- 手动验证各视图中项目条目显示正确

## Out of Scope

- 侧边栏项目导航项显示领域归属（侧边栏已有领域分组，无需重复）
- 创建独立的 `ProjectAreaAffiliation` 组件（直接复用样式，逻辑简单不需要独立组件）

## Technical Notes

- 参考 TaskProjectAffiliation 的实现模式（`src/features/tasks/TaskProjectAffiliation.tsx`）
- DB action 文件：`electron/workers/db/actions/view-actions.ts` 第 107-143 行 `projectSelectColumns()`
- Schema 文件：`shared/schemas/view-list.ts` 第 19-39 行
- ProjectRow 类型：`src/features/projects/ProjectRow.tsx` 第 8-21 行
- ProjectViewRow 包装：`src/features/view-list/ProjectViewRow.tsx`
- AreaPage 使用 ProjectViewRow：`src/pages/AreaPage.tsx` 第 363 行
