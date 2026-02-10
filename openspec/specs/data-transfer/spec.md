# data-transfer Specification

## Purpose
TBD - created by archiving change project-area-tags. Update Purpose after archive.
## Requirements
### Requirement: Export schema_version 3 includes project and area tag relations
数据导出 MUST 输出 `schema_version: 3`，并包含 Project/Area 的 tag 关系数据，且保留顺序。

#### Scenario: Export includes ordered project_tags and area_tags
- **WHEN** 用户触发数据导出
- **THEN** 导出对象包含 `schema_version: 3`
- **THEN** 导出对象包含 `project_tags` 与 `area_tags`
- **THEN** `project_tags`/`area_tags` 的每条关系包含 `*_id`、`tag_id` 与 `position`

### Requirement: Export excludes relations to deleted entities or deleted tags
导出时系统 MUST NOT 输出指向已删除实体（Project/Area）或已软删除 Tag 的关系行，避免产生悬空引用。

#### Scenario: Export filters deleted tags and deleted projects/areas
- **WHEN** 某些 Project/Area 被删除，或某些 Tag 被软删除
- **THEN** 导出数据的 `project_tags`/`area_tags` 中不包含指向这些实体/标签的关系行

### Requirement: Import supports schema_version 2 and 3
数据导入 MUST 兼容 `schema_version: 2` 与 `schema_version: 3`。

#### Scenario: Importing v2 results in empty project/area tag relations
- **WHEN** 用户导入 `schema_version: 2` 的数据
- **THEN** 系统成功导入 tasks/projects/areas/tags/task_tags 等 v2 字段
- **THEN** Project/Area 的 tags 关系被视为不存在（等价于空列表）

#### Scenario: Importing v3 preserves project/area tag order
- **WHEN** 用户导入 `schema_version: 3` 的数据
- **THEN** 系统导入 `project_tags` 与 `area_tags` 并写入 position
- **THEN** 后续 `project.getDetail`/`area.getDetail` 返回的 `tags` 顺序与导入数据中的顺序一致

### Requirement: Import overwrite is transactional
导入（overwrite 模式）MUST 是事务性的：任何外键/校验失败都必须回滚，不允许部分导入。

#### Scenario: Foreign key failure rolls back all changes
- **WHEN** 导入数据包含无效的外键引用（例如关系行引用了不存在的 tag/project/area）
- **THEN** 导入 MUST 失败并返回错误
- **THEN** 数据库 MUST 保持导入前的状态（无部分写入）

