## MODIFIED Requirements

### Requirement: Save state is visible
任务编辑器 MUST 采用“成功静默、失败可见”的保存反馈策略。

- 自动保存成功时，UI MUST NOT 展示持续性的保存状态文本（例如 `Saving` / `Saved` / `Unsaved`）。
- 自动保存失败时，UI MUST 明确展示错误状态，并提供可执行的重试路径。

#### Scenario: Successful auto-save remains silent
- **WHEN** 用户在任务编辑器中修改任意任务字段且自动保存成功
- **THEN** UI 不显示 `Saving` / `Saved` / `Unsaved`（或等价持续状态文案）

#### Scenario: Save failure remains visible and actionable
- **WHEN** 自动保存失败
- **THEN** UI 显示错误状态（或等价错误提示）
- **THEN** 用户可以触发重试
