## Context

Milesto 已有“第一类标签”模型：`tags` 表存储 tag 元信息（title/color），`task_tags` 作为 join 表实现 Task 的多选 tags。当前 Project/Area 没有 tags 关联能力，且数据导入/导出格式（`schema_version: 2`）不包含 Project/Area 的 tag 关系。

约束：
- IPC 边界使用 `window.api`（preload 暴露）+ `ipcMain.handle`/`ipcRenderer.invoke`（请求-响应），并在 Main/DB Worker 侧用 Zod 做输入/输出校验。
- SQLite 迁移使用 `PRAGMA user_version`，并尽量通过 `CREATE TABLE IF NOT EXISTS` / 幂等语句演进。
- tags 支持软删除（`deleted_at`），读取侧需避免把已删除 tag 暴露给 UI。

## Goals / Non-Goals

**Goals:**
- Project 与 Area 支持多选 tags，并保留用户设置的顺序（顺序语义以 `setTags(tagIds)` 的数组顺序为准）。
- 新增 `project.getDetail`/`area.getDetail`，返回聚合对象并直接包含 `tags: Tag[]`（按用户顺序）。
- 新增 `project.setTags`/`area.setTags`，原子地替换 tag 关系（事务内 delete+insert），并校验输入。
- 数据导入/导出升级到 `schema_version: 3`，新增 `project_tags`/`area_tags`（带 `position`）并支持从 v2 导入。

**Non-Goals:**
- 不在本变更中引入“按 tag 视图/筛选/统计”或全局 tag 管理 UI 的扩展（仅提供数据能力与 API 契约）。
- 不改变现有 Task 的 tags 行为与 UI。

## Decisions

### 1) 使用 join 表而不是在 projects/areas 表内存 JSON

Decision:
- 复用现有 `tags` 表；新增 join 表 `project_tags` 与 `area_tags` 存储多对多关系。

Rationale:
- 与现有 Task tags 模型一致（`task_tags`），避免在同一系统内混用 JSON/关系两套存储。
- 允许复用 Tag 的 title/color，并保持 referential integrity（外键）。

Alternatives considered:
- `tag_ids` JSON 列：写入简单但约束弱、查询复杂且与现有模式不一致。

### 2) 通过 position 持久化“用户顺序”

Decision:
- join 表包含 `position INTEGER NOT NULL`，`getDetail` 读取时按 `position ASC` 排序。
- `setTags(tagIds)` 写入时按数组顺序写 position（建议采用 `(index + 1) * 1000` 的步进）。

Rationale:
- 仅靠 `created_at` 无法可靠表达顺序（同一批次写入时间戳可能相同）。
- 步进 position 便于未来插入中间位置（若后续需要拖拽排序）。

Notes:
- 可加 `UNIQUE (entity_id, position)`（如 `UNIQUE (project_id, position)`）以防止位置冲突；本变更的 `setTags` 通过“先删后插”可自然满足该约束。

### 3) 新增 *Detail 返回聚合对象，不污染基础实体 schema

Decision:
- 保持 `ProjectSchema`/`AreaSchema` 仍代表基础实体（表行）。
- 新增 `ProjectDetailSchema = { project: Project, tags: Tag[] }` 与 `AreaDetailSchema = { area: Area, tags: Tag[] }`。

Rationale:
- 当前多处查询对 projects/areas 使用显式列清单；把 tags 混进基础 schema 会迫使所有查询升级为聚合查询，改动面大。
- 与现有 `task.getDetail` 的聚合 DTO 模式一致。

### 4) setTags 语义：有序、去重、原子替换

Decision:
- `setTags` 接受 `tag_ids: string[]`，并将其视为“有序且不重复”的列表。
- 若输入包含重复 id，直接返回校验失败（不进行部分去重），保证语义明确。
- DB 操作在事务内完成：删除旧关系后按顺序插入新关系。

Rationale:
- 保序语义对 UI 很关键；允许重复会使 position/结果不确定。
- 原子替换与现有 `task.setTags` 保持一致。

### 5) 软删除 tag 的处理：读取/导出过滤

Decision:
- `getDetail` 查询 tags 时必须过滤 `tags.deleted_at IS NULL`。
- 导出 `project_tags/area_tags` 时只导出同时满足：project/area 未删除、tag 未删除的关系行。

Rationale:
- 避免 UI 展示已删除 tag。
- 避免导出产生悬空引用（v3 文件中 tag 不存在）。

### 6) 数据导入/导出：schema_version=3，导入兼容 v2

Decision:
- 导出始终输出 `schema_version: 3`。
- 导入支持 v2 与 v3：v2 缺省 `project_tags/area_tags`，按空集合处理。

Rationale:
- v2 格式不包含新关系，必须升级版本以保证可验证性与 round-trip。
- 兼容 v2 避免用户旧备份文件无法导入。

## Risks / Trade-offs

- [更多 join 表带来的查询复杂度] → Mitigation: 仅在 `getDetail` 路径聚合 tags；列表接口不强制 join。
- [顺序一致性风险（position 冲突/重复 tag id）] → Mitigation: 输入校验禁止重复；join 表可加 UNIQUE(entity_id, position)；写入采用事务+先删后插。
- [导入文件存在悬空引用导致失败] → Mitigation: 依赖外键与事务性 importOverwrite；在导出端过滤 deleted entities/tags 降低自家文件风险。
- [schema_version 升级造成兼容问题] → Mitigation: 导入端支持 v2/v3 union schema；导出端仅输出 v3。

## Migration Plan

1) DB 迁移（user_version v4）：创建 `project_tags`、`area_tags` 表（含 `position`）。
2) 新增 schemas：`ProjectDetail`/`AreaDetail`；新增 `setTags` 输入 schema。
3) 新增 DB actions：实现 `project.getDetail`/`project.setTags` 与 `area.getDetail`/`area.setTags`。
4) IPC 暴露：在 `shared/window-api.ts`、`electron/preload.ts`、`electron/main.ts` 注册新端点并做 Zod 校验。
5) 数据导入/导出升级：
   - 导出输出 v3 并包含 `project_tags/area_tags`（带 position）
   - 导入支持 v2/v3；v2 视为空；v3 写入 join 表并保持 position
6) 测试：新增/更新 import/export 的 v2/v3 兼容与事务回滚覆盖。

Rollback:
- 代码回滚可保留新表（向前兼容）；旧版本应用不使用新表不会受影响。

## Open Questions

- 是否需要在 ProjectPage/AreaPage 增加编辑 UI（复用 Task tags picker）以便功能可见/可用？（当前设计只提供数据能力与 API）。
- 是否需要新增“按 tag 查询 Projects/Areas”的列表接口（例如 future `project.listByTag`）？
