## ADDED Requirements

### Requirement: Projects and areas support ordered tags
Project 与 Area MUST 支持关联多个 Tag，并且 MUST 保留用户设置的 tag 顺序。

#### Scenario: Order is defined by setTags input order
- **WHEN** 用户对某个 Project/Area 调用 `setTags` 并传入有序的 `tag_ids` 数组
- **THEN** 系统将该数组顺序视为该 Project/Area 的 tags 顺序
- **THEN** 之后通过 `getDetail` 读取时返回的 `tags` 数组顺序与该 `tag_ids` 顺序一致

### Requirement: getDetail returns tags as Tag[] in order
`project.getDetail` 与 `area.getDetail` MUST 返回聚合对象，其中包含基础实体与按顺序排列的 `tags: Tag[]`。

#### Scenario: Project detail includes ordered tags
- **WHEN** 调用 `window.api.project.getDetail(projectId)`
- **THEN** 返回值包含 `project` 与 `tags`
- **THEN** `tags` 中每个元素均为有效的 `Tag` 对象（包含 `id/title/color` 等字段）
- **THEN** `tags` 的顺序与该 Project 当前 tags 的用户顺序一致

#### Scenario: Area detail includes ordered tags
- **WHEN** 调用 `window.api.area.getDetail(areaId)`
- **THEN** 返回值包含 `area` 与 `tags`
- **THEN** `tags` 中每个元素均为有效的 `Tag` 对象
- **THEN** `tags` 的顺序与该 Area 当前 tags 的用户顺序一致

### Requirement: setTags replaces the full ordered tag list atomically
`project.setTags` 与 `area.setTags` MUST 以原子方式替换该实体的完整 tags 列表。

#### Scenario: setTags is all-or-nothing
- **WHEN** 对某个 Project/Area 调用 `setTags(tag_ids)`
- **THEN** 系统要么成功替换为新的完整列表（含顺序）
- **THEN** 要么在失败时不留下部分更新（旧列表保持不变）

### Requirement: setTags input is a unique ordered list
`setTags` 输入的 `tag_ids` MUST 被视为“有序且不重复”的列表。

#### Scenario: Duplicate tag ids are rejected
- **WHEN** `setTags` 的 `tag_ids` 包含重复的 tag id
- **THEN** 系统 MUST 拒绝该请求并返回错误
- **THEN** 系统 MUST NOT 对该实体的 tags 关系产生任何变更

### Requirement: Soft-deleted tags are not exposed by getDetail
当某个 Tag 被软删除后（`deleted_at` 非空），系统 MUST NOT 在任何 Project/Area 的 `getDetail` 结果中暴露该 Tag。

#### Scenario: Deleted tags are filtered from detail
- **WHEN** 某个 Tag 被软删除
- **THEN** 后续调用任意 `project.getDetail`/`area.getDetail` 时，返回的 `tags` 中不包含该 tag
