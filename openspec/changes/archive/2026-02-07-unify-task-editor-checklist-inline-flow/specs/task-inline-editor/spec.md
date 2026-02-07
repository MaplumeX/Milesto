## MODIFIED Requirements

### Requirement: Checklist button focuses add-item input
当 checklist 为空且用户点击 `Checklist` 按钮时，系统 MUST 创建一条空 checklist 行并立即进入编辑状态。

系统 MUST 将焦点置于该新行的标题输入框，且 MUST NOT 依赖独立的“新增输入区域”。

#### Scenario: Click Checklist creates and focuses first checklist row
- **WHEN** 任务展开且 checklist 为空
- **WHEN** 用户点击 `Checklist` 按钮
- **THEN** 系统创建一条空 checklist 行并显示标题输入框
- **THEN** 焦点移动到该行标题输入框
- **THEN** UI 不显示独立的 checklist 新增输入框

### Requirement: Checklist section collapses when it becomes empty
当 checklist 的最后一项被删除后，系统 MUST 自动收起 checklist 区域，并重新显示 `Checklist` 按钮作为再次新增入口。

#### Scenario: Clearing and submitting the last item collapses checklist
- **WHEN** 任务展开且 checklist 仅剩最后一项
- **WHEN** 用户将该项标题清空并提交（`Enter` 或失焦）
- **THEN** 系统删除该 checklist 项
- **THEN** checklist 区域被自动收起
- **THEN** Action Bar 重新显示 `Checklist` 按钮

## ADDED Requirements

### Requirement: Checklist rows are edited inline without separate add or delete controls
行内编辑器中的 checklist MUST 采用“每行可编辑”的结构：每项包含完成勾选与标题输入框。

系统 MUST NOT 渲染独立的 `Add` 输入框、`Add` 按钮或显式 `Delete` 按钮；标题编辑 MUST NOT 通过 `prompt` 弹窗完成。

#### Scenario: Checklist renders row-level inputs only
- **WHEN** 用户打开任务行内编辑器并查看 checklist
- **THEN** 每个 checklist 项以行内输入框形式可直接编辑标题
- **THEN** UI 不显示 `Add` 按钮与 `Delete` 按钮
- **THEN** 标题编辑不会触发浏览器 `prompt`

### Requirement: Enter submits current checklist row and creates next row
在 checklist 标题输入框中按下 `Enter`（非输入法组合态）时，系统 MUST 提交当前行，并在其后创建下一条空行继续编辑。

#### Scenario: Enter on non-empty row creates next editable row
- **WHEN** 用户正在编辑一个非空 checklist 项标题
- **WHEN** 用户按下 `Enter`
- **THEN** 系统持久化当前行变更
- **THEN** 系统在其后创建一条空 checklist 行
- **THEN** 焦点移动到新行标题输入框

#### Scenario: Enter during IME composition does not submit
- **WHEN** 用户正在使用输入法组合输入 checklist 标题
- **WHEN** 用户按下 `Enter` 用于候选确认
- **THEN** 系统不会提交当前 checklist 行
- **THEN** 系统不会创建下一条 checklist 行

### Requirement: Submitting an empty checklist title removes that row
当 checklist 标题在提交时为空时，系统 MUST 视为删除该行。

对已持久化项，系统 MUST 调用删除语义并从列表移除；对仅本地临时项，系统 MUST 直接丢弃且 MUST NOT 创建空标题持久化记录。

#### Scenario: Submit empty title deletes persisted row
- **WHEN** 某 checklist 项已存在于持久化数据中
- **WHEN** 用户将其标题清空并提交（`Enter` 或失焦）
- **THEN** 系统删除该 checklist 项并从 UI 移除

#### Scenario: Submit empty title discards temporary row
- **WHEN** 某 checklist 行为未持久化的临时空行
- **WHEN** 用户提交空标题（`Enter` 或失焦）
- **THEN** 系统直接移除该临时行
- **THEN** 系统不会产生新的空标题 checklist 记录
