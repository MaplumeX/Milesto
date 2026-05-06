# fix: ArrowUp from completed toggle skips group and jumps to task

## Goal

修复项目页面中，从已完成切换按钮按 ArrowUp 时焦点跳到上次选中的任务而非最近项（可能是分组标题）的键盘导航 bug。

## What I already know

* Bug 位置：`ProjectPage.tsx:730-732`，ArrowUp handler 只调用 `setFocusRegion('active')` 未定位选中行
* 对比 ArrowDown 从 toggle 进入已完成列表时用了 `setInitialFocusIndex(0)` 正确定位，所以 ArrowUp 也需要类似机制
* `ProjectGroupedList.tsx:1091-1094` 的 `selectedTaskId` effect 总是将选中行恢复为任务，从不选中分组
* `ProjectDoneTaskList.tsx:299-312` 已有 `initialFocusIndex` 机制可参考
* 列表行数组 `rows` 同时包含 `group` 行和 `task` 行，最后一行可能是分组标题

## Assumptions (temporary)

* `initialFocusIndex` 用 `-1` 表示"选中最后一行"是合理的约定
* 不需要修改 `ProjectDoneTaskList` 的逻辑

## Open Questions

* (none — 方案明确)

## Requirements

* 从已完成切换按钮按 ArrowUp 时，焦点应回到活动列表的**最后一行**（分组或任务）
* 复用 `initialFocusIndex` 机制，传入特殊值 `-1` 表示"选中最后一行"

## Acceptance Criteria

* [ ] 从已完成按钮按 ArrowUp，焦点回到活动列表最后一行
* [ ] 若最后一行是分组标题，焦点落在分组标题而非跳到任务
* [ ] ArrowDown 从 toggle 进入已完成列表的行为不变
* [ ] 其他键盘导航路径不受影响

## Definition of Done

* 手动测试通过上述场景
* Lint / typecheck 通过

## Out of Scope

* Area 页面的类似问题（如有）
* 其他键盘导航优化

## Technical Approach

1. 给 `ProjectGroupedList` 添加 `initialFocusIndex` prop
2. 在 `ProjectGroupedList` 的 focusRegion 过渡 effect 中，当 `initialFocusIndex === -1` 时选中 `rows.length - 1` 那一行
3. 在 `ProjectPage.tsx` 的 ArrowUp handler 中，`setInitialFocusIndex(-1)` 后再 `setFocusRegion('active')`
4. 进入 active 区域后清除 `initialFocusIndex`，避免残留

### 涉及文件

* `src/pages/ProjectPage.tsx` — ArrowUp handler + 传递 initialFocusIndex prop
* `src/features/tasks/ProjectGroupedList.tsx` — 添加 initialFocusIndex prop + focusRegion effect 处理
