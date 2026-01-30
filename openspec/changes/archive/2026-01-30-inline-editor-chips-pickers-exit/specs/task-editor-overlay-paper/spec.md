## MODIFIED Requirements

### Requirement: Close behavior and focus restoration
系统 MUST 支持通过键盘 `Escape` 或关闭手势收起行内编辑器，并在收起后将键盘焦点恢复到触发打开的任务行（或其标题按钮）。

系统 MUST 支持以下关闭手势：

- `Escape`
- `Cmd/Ctrl+Enter`
- 标题输入框聚焦时的 `Enter/Return`
- 点击编辑器外区域（click-away）

系统 MUST NOT 依赖显式 `Collapse`/`Close` 按钮作为唯一关闭路径。

#### Scenario: Escape closes and restores focus
- **WHEN** 行内编辑器处于展开状态且用户按下 `Escape`
- **THEN** 行内编辑器收起
- **THEN** 焦点回到先前触发打开的任务行（或其标题按钮）

#### Scenario: Click-away closes and restores focus
- **WHEN** 行内编辑器处于展开状态
- **WHEN** 用户点击编辑器外区域
- **THEN** 系统尝试收起行内编辑器（遵循 flush 语义）
- **THEN** 收起成功后焦点回到先前触发打开的任务行（或其标题按钮）

## ADDED Requirements

### Requirement: Click-away closes pickers before attempting to close the editor
当行内编辑器存在浮层 picker（例如 Tags/Schedule/Due）打开时，click-away MUST 优先关闭 picker，而不是直接关闭编辑器。

#### Scenario: Click-away first closes picker
- **WHEN** 行内编辑器展开且某个 picker 处于打开状态
- **WHEN** 用户点击编辑器外区域
- **THEN** 系统关闭 picker
- **THEN** 行内编辑器保持展开
