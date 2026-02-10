## Why

目前 Milesto 的 tags 仅支持 Task（`tags` + `task_tags`），Project 与 Area 不能关联 tags，导致：
- 无法在项目/领域层面做一致的标签标注与后续筛选/组织。
- 导入/导出无法携带 Project/Area 的 tag 关系，数据无法完整 round-trip。

## What Changes

- 为 Project 与 Area 增加“多选 tags（有序）”能力：同一 Project/Area 可关联多个 Tag，并保留用户设置的顺序。
- 新增 DB join 表：`project_tags`、`area_tags`（包含 `position` 用于排序持久化）。
- 新增 Window API / IPC：
  - `window.api.project.getDetail(id)` / `window.api.project.setTags(projectId, tagIds)`
  - `window.api.area.getDetail(id)` / `window.api.area.setTags(areaId, tagIds)`
- Detail 返回直接包含 `tags: Tag[]`（按用户顺序），便于渲染侧直接展示 tag title/color。
- 扩展数据导入/导出格式：升级为 `schema_version: 3`，新增 `project_tags` / `area_tags`（包含 `position`），并保持对 v2 导入的兼容。

## Capabilities

### New Capabilities
- `project-area-tags`: Project/Area 的有序 tags 关联、读取（detail）与写入（setTags）的行为契约
- `data-transfer`: 数据导入/导出的 schema_version=3 与 project/area tag 关系的 round-trip 规则

### Modified Capabilities

<!-- none -->

## Impact

- DB：`electron/workers/db/db-bootstrap.ts` 新增迁移与表结构；`db.resetAllData` 与 import overwrite 需要清理/写入新 join 表。
- Schemas：新增 `ProjectDetail`/`AreaDetail` schema；导入/导出 schema 需要支持 v3（并兼容 v2）。
- IPC：`electron/main.ts` / `electron/preload.ts` / `shared/window-api.ts` 增加新端点。
- DB Worker actions：`project-actions.ts` / `area-actions.ts` 增加 `getDetail` 与 `setTags` 实现。
- 测试：更新/新增 DB import/export 覆盖（v2/v3 兼容与事务性）。
