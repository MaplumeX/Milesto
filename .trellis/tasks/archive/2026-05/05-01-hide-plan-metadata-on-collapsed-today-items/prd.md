# 今天界面：未展开条目隐藏计划元数据

## Goal

在 Today（今天）界面，未展开的任务条目（collapsed task rows）不再显示计划相关的元数据，减少视觉冗余。Today 页面上的所有任务本质上都已经是"今天"计划的，因此在折叠状态下显示"今天"等计划日期信息没有额外价值。

## What I already know

- Today 页面使用 `ViewList` 渲染任务列表，通过 `AnimatedTaskSlot` 控制展开/折叠动画
- 折叠状态由 `TaskRow` 渲染，元数据区（`task-row-metadata`）包含三类信息：
  - **Schedule** (`task-row-meta-item--schedule`)：计划日期，如"今天"、"明天"、"Someday"
  - **Due** (`task-row-meta-item--due`)：截止日期
  - **Tags** (`task-row-meta-item--tags`)：标签
- 展开状态由 `TaskInlineEditorRow` + `TaskEditorPaper` 渲染，编辑器内通过 `task-inline-chip--plan` 展示 schedule 信息
- `ViewList` 已掌握 `openTaskId`（通过 `useTaskSelection`），知道哪个任务处于展开状态
- 相关文件路径：
  - `src/pages/TodayPage.tsx` — Today 页面入口
  - `src/features/view-list/ViewList.tsx` — 通用列表组件
  - `src/features/tasks/TaskRow.tsx` — 折叠状态的任务行
  - `src/features/tasks/AnimatedTaskSlot.tsx` — 展开/折叠动画容器

## Assumptions (temporary)

- "计划元数据"主要指 schedule（计划日期）信息，不包括 due date 和 tags
- 仅在 Today 页面生效，其他页面（Upcoming、Anytime 等）保持现状
- 展开状态（内联编辑器）不受此影响，仍可正常查看/编辑 schedule

## Open Questions

- [x] 已确认：仅隐藏 schedule（计划日期），due date 和 tags 继续显示
- [x] 已确认：仅在 Today 页面生效

## Requirements

- Today 页面的折叠任务行不显示 schedule/plan 元数据
- 展开状态（内联编辑器）不受影响
- Due date 和 tags 在折叠行继续正常显示
- 其他页面不受影响

## Acceptance Criteria

- [ ] Today 页面折叠任务行不再显示 `CalendarIcon` + schedule preview
- [ ] Today 页面展开的任务行（内联编辑器）仍可正常查看/编辑 schedule
- [ ] Due date 和 tags 在折叠行仍正常显示
- [ ] Upcoming、Inbox、Anytime 等其他页面不受影响
- [ ] 无视觉回归（行高、间距保持合理）
- [ ] 现有测试通过

## Definition of Done

- 实现代码通过 lint / typecheck
- 如有需要，更新/添加相关测试
- 手动验证 Today 页面的折叠/展开行为正确

## Out of Scope (explicit)

- 修改其他页面的元数据显示逻辑
- 修改展开状态（内联编辑器）的内容
- 修改任务数据的存储或查询逻辑

## Technical Notes

- 实现思路：给 `ViewList` 添加一个可选 prop（如 `hideTaskScheduleWhenCollapsed`），由 `TodayPage` 传入 `true`；通过 `SortableViewRow` → `TaskRow` 的 prop drilling 传递；在 `TaskRow` 中条件渲染 schedule preview
- 或者给 `TaskRow` 添加更通用的 `showSchedule` prop（默认 true），由上层视图按需关闭
- `AnimatedTaskSlot` 已经处理了展开/折叠的切换，`TaskRow` 始终只渲染折叠状态的内容，因此不需要额外的展开状态判断
