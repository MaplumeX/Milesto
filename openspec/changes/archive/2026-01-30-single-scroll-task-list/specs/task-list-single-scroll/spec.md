## ADDED Requirements

### Requirement: Task list views use a single main scroll container
任务列表视图（例如 Inbox/Today/Upcoming 等）在内容区 MUST 只有一个主要滚动容器。

任务列表本身 MUST NOT 创建独立滚动区域（例如在列表外壳上启用独立的 `overflow: auto` 以及固定高度限制从而产生第二个滚动条）。

#### Scenario: Wheel/trackpad scroll does not get trapped inside the task list
- **WHEN** 用户将鼠标悬停在任务列表区域并使用滚轮/触控板滚动
- **THEN** 页面内容区发生滚动（主滚动容器滚动）
- **THEN** 任务列表区域不会出现单独的滚动条或“滚不动页面只能滚列表”的行为

### Requirement: Virtualized task list scroll-to-item works with a non-list scroll container
当任务列表使用虚拟滚动时，即使滚动容器位于列表外层（主内容区滚动），系统 MUST 仍能正确计算可见范围并将指定条目滚动到可见位置（例如通过键盘导航或页面内跳转按钮触发）。

#### Scenario: Keyboard navigation keeps the selected task visible
- **WHEN** 列表获得焦点且存在可选中的任务条目
- **WHEN** 用户按下 `ArrowDown` 或 `ArrowUp`
- **THEN** 当前选中任务随按键更新
- **THEN** 系统将主滚动容器滚动到使选中任务保持可见（不会出现选中项跑到视口外）

### Requirement: Layout above the list does not break scroll alignment
任务列表上方通常存在页面 header（标题、按钮、元信息等）。这些内容位于列表之前时，系统 MUST 保证“滚动到条目”的对齐正确，不会因为 header/padding 等导致条目对齐偏移。

#### Scenario: Scroll-to-index aligns the target item as expected
- **WHEN** 用户触发“跳转到某一位置”的操作（例如 Upcoming 页面中的 Today/Next Week/Next Month）
- **THEN** 主滚动容器滚动后，目标分组 header 或目标任务条目出现在预期的位置（例如 align start）
- **THEN** 不会出现明显的偏移误差（例如被 header 高度抵消导致“跳过”或“对不齐”）
