## Why

Area（领域）页面目前把“Projects/项目”列表渲染在任务内容区之后，并且项目条目交互/样式与任务条目不一致（点击即导航、选中高亮/聚焦语义不清晰）。这让页面信息层级倒置、降低可扫读性，也破坏了“同一种列表行=同一种交互”的一致性。

这次改动的目标是把 Area 页面打磨成更接近桌面效率工具的列表体验：标题区更可识别（标题左侧图标），项目列表成为“内容区上方的上下文”，并且项目条目与任务条目使用同一套“单击选中、双击进入”的交互。

## What Changes

- Area 页面标题左侧显示图标（与标题同一视觉组，左对齐；不影响现有右侧 `...` 菜单）。
- Area 页面“项目列表”移动到任务内容区上方（与任务在同一主滚动容器内）。
- 不再显示单独的“Projects/项目”分组标题（去掉 `sections-header/sections-title`）。
- 项目条目交互对齐任务条目：
  - 单击：仅选中/聚焦并整行高亮（不导航）。
  - 双击：进入项目（导航到 `/projects/:projectId`）。
  - 选中样式覆盖整行，包括左侧圆形 `ProjectProgressControl` 指示器。
- 为确保虚拟滚动对齐稳定：在任务列表上方插入可变高度内容后，仍需保持 `scrollMargin`/`scrollToIndex` 对齐正确（不引入嵌套滚动）。
- 更新自测（selfTest）中对 Area 项目区块的 DOM 定位方式（去除对“Projects”标题文本的依赖）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `area-page`: Area 页面项目列表的布局与项目条目的交互/视觉一致性需求发生变化（项目位于任务上方、无“项目”标题、单击选中/双击进入）。

## Impact

- 受影响的主要代码（Renderer）：
  - `src/pages/AreaPage.tsx`（标题节点、项目列表渲染与交互）
  - `src/features/tasks/TaskList.tsx`（在 header 与任务 listbox 之间支持插入 Area 项目列表；保持虚拟滚动对齐）
  - `src/index.css`（复用现有 `.task-row.is-selected` 等样式；必要时补充项目行的可点击区域样式）
  - `src/app/selfTest.ts`（Area 项目区块定位逻辑）
- 约束：必须遵循单一主滚动容器（`task-list-single-scroll`）与键盘优先（`docs/ui.md`）原则；不引入新的 IPC/数据库能力与新依赖。
