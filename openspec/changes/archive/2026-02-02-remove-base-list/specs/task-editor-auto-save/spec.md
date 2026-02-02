## MODIFIED Requirements

### Requirement: Full-field auto-save
在任务编辑器中，任务编辑 MUST 对所有任务字段进行自动保存，包括但不限于：title、notes、is_inbox、is_someday、project_id、section_id、area_id、scheduled_at、due_at。

#### Scenario: Edit a field and it is persisted
- **WHEN** 用户在任务编辑器中修改任意任务字段
- **THEN** 系统在无需显式点击 Save 的情况下，将变更持久化到数据库
