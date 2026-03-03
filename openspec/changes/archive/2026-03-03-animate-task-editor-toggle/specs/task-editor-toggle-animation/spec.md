## ADDED Requirements

### Requirement: Editor open animates with spring height expansion and content fade-in
当用户触发打开内联编辑器时，系统 MUST 以 spring 动画展开容器高度（从 TaskRow 行高到编辑器实际内容高度），同时编辑器内容 MUST 以 opacity 0→1 和 scale 0.98→1.0 渐现。

#### Scenario: Open editor triggers spring expand animation
- **WHEN** 用户对某条任务触发"打开编辑"（Return 或双击）
- **THEN** 该任务行的容器高度以 spring 动画从行高展开到编辑器内容高度
- **THEN** 编辑器内容以 opacity 0→1 和 scale 0.98→1.0 渐现
- **THEN** 下方列表行随高度变化逐帧平滑下移

### Requirement: Editor close animates with content fade-out and spring height collapse
当用户关闭内联编辑器时，编辑器内容 MUST 先以 opacity 1→0 和 scale 1.0→0.98 快速淡出，然后容器高度 MUST 以 spring 动画收起到 TaskRow 行高。

#### Scenario: Close editor triggers fade-out then spring collapse animation
- **WHEN** 用户关闭内联编辑器（Escape、Cmd/Ctrl+Enter 或其他关闭触发）
- **THEN** 编辑器内容以 opacity 1→0 和 scale 1.0→0.98 淡出（约 100ms）
- **THEN** 容器高度以 spring 动画从当前高度收起到行高
- **THEN** 下方列表行随高度变化逐帧平滑上移
- **THEN** 动画完成后编辑器组件卸载，TaskRow 恢复显示

### Requirement: Animation syncs with virtualizer on every frame
动画期间容器高度变化 MUST 逐帧通知虚拟列表重新测量该行高度，确保后续行的位置实时更新而非一帧跳变。

#### Scenario: Subsequent virtual rows move smoothly during animation
- **WHEN** 编辑器展开/收起动画正在播放
- **THEN** 虚拟列表中该行之后的所有可见行 MUST 随着容器高度变化逐帧更新位置
- **THEN** 不出现行重叠或位置跳变

### Requirement: Exit animation prevents user interaction
退出动画播放期间，编辑器容器 MUST 禁止用户交互（pointer-events: none），防止在淡出过程中触发意外操作。

#### Scenario: Click during exit animation is ignored
- **WHEN** 编辑器正在播放退出动画
- **WHEN** 用户尝试点击编辑器内的元素
- **THEN** 系统不响应该点击

### Requirement: Animation respects prefers-reduced-motion
当系统 `prefers-reduced-motion` 设置为 `reduce` 时，编辑器打开/关闭 MUST 跳过所有动画，直接切换到最终状态（等同于当前的瞬间条件渲染行为）。

#### Scenario: Reduced motion skips all animation
- **WHEN** 系统 `prefers-reduced-motion` 为 `reduce`
- **WHEN** 用户打开或关闭内联编辑器
- **THEN** 编辑器直接切换到最终状态，无过渡动画

### Requirement: AnimatedTaskSlot is reused across all list types
所有使用内联编辑器的列表组件（TaskList、ProjectGroupedList、UpcomingGroupedList、LogbookGroupedList、SearchPage）MUST 使用统一的 `AnimatedTaskSlot` 组件来管理编辑器的展开/收起动画，MUST NOT 在各列表中各自实现动画逻辑。

#### Scenario: All five list components use AnimatedTaskSlot
- **WHEN** 开发者检查任意列表组件中内联编辑器的渲染逻辑
- **THEN** 该组件使用 `AnimatedTaskSlot` 而非自行条件渲染 TaskRow/TaskInlineEditorRow
