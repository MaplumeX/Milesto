# Unify AreaPage project data fetching with view-based approach

## Goal

Make AreaPage 的项目条目显示完整元数据（日程、截止日期、标签），与其他视图页面（Today、Anytime、Someday、Upcoming）保持一致。

## What I already know

* AreaPage 使用 `project.listOpenByArea()` 返回 `Project[]`，缺少 `tag_preview`、`tag_count`、`tag_ids` 字段
* 其他视图页面使用 `view.listXxx()` 返回 `ViewListItem[]`（含 `ViewListProjectItem`），通过 `projectSelectColumns()` SQL 一次查出所有数据
* AreaPage 只传了 `id/title/notes/status/done_count/total_count` 给 `ProjectRow`，虽然 `Project` 类型上有 `scheduled_at`、`due_at`、`is_someday`，但被忽略了
* 进度数据通过额外的 `task.countProjectsProgress()` 调用补偿，但标签数据完全缺失
* 目前不存在 `view.listByArea` 这样的视图 API
* `ProjectRowProject` 类型的 `area_id/scheduled_at/due_at/is_someday/tag_preview/tag_count` 都是 optional，AreaPage 不传时元数据被静默隐藏

## Decision (ADR-lite)

**Context**: AreaPage 项目数据获取方式与其他视图页面不一致，缺少标签和进度数据，且日程/截止日期等可用字段未传递给渲染组件。
**Decision**: 选择最小可行方案 — 新增 `view.listByArea(areaId)` API 只返回项目（含完整元数据），任务获取保持不变，AreaPage 改用新 API。
**Consequences**: 减少改动范围，不涉及任务获取逻辑和排序方式的变更，保持 AreaPage 的字母排序。

## Requirements

1. 新增 `view.listByArea(areaId)` DB action，返回指定 area 下的项目 `ViewListItem[]`（仅 kind=project）
2. AreaPage 改用 `view.listByArea()` 替代 `project.listOpenByArea()` + `task.countProjectsProgress()`
3. AreaPage 使用 `ProjectViewRow` 渲染项目（与其他视图页面一致）
4. `ProjectRowProject` 类型的可选元数据字段改为 required，消除静默隐藏行为
5. 新增对应的 IPC handler、preload 暴露、WindowApi 类型声明、zod 输入 schema
6. 现有测试通过

## Acceptance Criteria

- [ ] AreaPage 项目条目显示日程标签（Someday / Today / 日期）
- [ ] AreaPage 项目条目显示截止日期
- [ ] AreaPage 项目条目显示标签预览
- [ ] AreaPage 项目条目显示未完成任务数
- [ ] AreaPage 不再单独调用 `task.countProjectsProgress`
- [ ] `ProjectRowProject` 的 `area_id/scheduled_at/due_at/is_someday/tag_preview/tag_count` 改为 required
- [ ] 其他页面（Today、Anytime 等）不受影响
- [ ] lint + typecheck 通过
- [ ] 现有测试通过

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes
- Rollout/rollback considered if risky

## Out of Scope

- AreaPage 任务列表的获取方式改造（保持 `task.listArea` 不变）
- 修改 AreaPage 的排序逻辑（当前按标题字母排序，暂不改动）
- 修改 `ViewListProjectItem` 的 schema 定义
- 新增 UI 交互（日程选择器、标签管理等）
- 废弃 `project.listOpenByArea` API（保留，仅 AreaPage 不再使用）

## Technical Notes

### 关键文件

* `electron/workers/db/actions/view-actions.ts` — 需新增 `view.listByArea` action，复用 `projectSelectColumns()` 和 `parseAndSortItems()`
* `electron/workers/db/actions/project-actions.ts` — `listOpenByArea` handler（lines 847-869），不再需要从 AreaPage 调用
* `electron/main.ts` — 需注册新的 IPC handler `db:view.listByArea`
* `electron/preload.ts` — 需暴露 `view.listByArea(areaId)`
* `shared/window-api.ts` — 需添加类型声明
* `shared/schemas/view-list.ts` — `ViewListItemSchema` 和输入 schema 可能需要 `ViewListByAreaInputSchema`
* `src/pages/AreaPage.tsx` — 主要改动页面，替换数据获取方式，改用 `ProjectViewRow` 或直接传 `ViewListProjectItem`
* `src/features/projects/ProjectRow.tsx` — `ProjectRowProject` 类型收紧
* `src/features/view-list/ProjectViewRow.tsx` — 可能需要调整以适配 AreaPage 的使用方式

### 数据获取方式对比

| 方面 | 当前 (project.listOpenByArea) | 目标 (view.listByArea) |
|------|-------------------------------|----------------------|
| 返回类型 | `Project[]` | `ViewListItem[]` |
| 标签数据 | 无 | 有 (tag_preview, tag_count) |
| 进度数据 | 需额外调用 | 一次查出 |
| 日程/截止 | 有但未传递 | 有且传递 |
| 排序 | 标题字母序 | rank 或保持字母序 |

### SQL 设计思路

新增的 `view.listByArea` 只返回项目（kind=project），WHERE 条件为 `p.area_id = @area_id AND p.deleted_at IS NULL AND p.status = 'open'`，复用 `projectSelectColumns()` 和项目行的 `parseAndSortItems`。不查任务行（AreaPage 的任务获取保持 `task.listArea`）。

### AreaPage 改造思路

1. `refresh()` 中将 `project.listOpenByArea(aid)` + `task.countProjectsProgress(projectIds)` 替换为 `view.listByArea(aid)`
2. 从返回的 `ViewListItem[]` 中 filter 出 `kind === 'project'` 的项目
3. 用 `ProjectViewRow` 替代直接使用 `ProjectRow`，与其他视图页面保持一致
4. `ProjectViewRow` 需要 `onComplete` 和 `onContextMenu` 支持，需要检查是否需要扩展