## ADDED Requirements

### Requirement: Overlay checklist interaction matches the inline checklist model
Overlay 任务编辑器中的 checklist 交互 MUST 与行内编辑器保持一致，采用“行内输入驱动”的创建与编辑流。

系统 MUST 支持在 checklist 为空时通过点击 checklist 区域直接创建空行并进入编辑；系统 MUST NOT 依赖独立的新增输入框或显式删除按钮。

#### Scenario: Click empty checklist area creates focused row
- **WHEN** 用户打开 Overlay 任务编辑器且 checklist 为空
- **WHEN** 用户点击 checklist 区域的新增入口
- **THEN** 系统创建一条空 checklist 行
- **THEN** 焦点移动到该行标题输入框

#### Scenario: Enter submits current row and creates next row
- **WHEN** 用户在 Overlay checklist 的某行标题输入框中编辑非空内容
- **WHEN** 用户按下 `Enter`
- **THEN** 系统提交当前行变更
- **THEN** 系统在其后创建一条空 checklist 行并聚焦该行输入框

#### Scenario: Submitting empty title removes row
- **WHEN** 用户将 Overlay checklist 某行标题清空并提交（`Enter` 或失焦）
- **THEN** 系统移除该 checklist 行

#### Scenario: Overlay checklist has no standalone Add/Delete controls
- **WHEN** 用户查看 Overlay checklist UI
- **THEN** UI 不显示独立 `Add` 输入框
- **THEN** UI 不显示显式 `Delete` 按钮
