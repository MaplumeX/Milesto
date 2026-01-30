## Why

当前任务列表视图存在“嵌套滚动”：内容区主容器 `.content-scroll` 已经滚动，但列表内部的 `.task-scroll` 又设置了 `overflow: auto` 和 `max-height`，形成第二个滚动区域。

这会带来两类问题：
- 交互体验：触控板/滚轮的滚动目标不明确，用户感知为“列表被一个独立盒子包住”；嵌套滚动也更容易产生滚动捕获、滚动锚点跳动等不稳定行为。
- 规范一致性：与 `docs/ui.md` 中“内容区主要滚动容器清晰且唯一，避免嵌套滚动”的要求不一致。

## What Changes

- 移除任务列表的独立滚动容器行为：`.task-scroll` 不再承担滚动（不再 `overflow: auto` / `max-height: 60vh`）。
- 将虚拟列表的滚动宿主切换为内容区唯一滚动容器（`.content-scroll`），并保持现有虚拟化/动态高度测量逻辑可用。
- 使用 TanStack Virtual v3 的 `scrollMargin`（以及必要时的 padding 选项）来修正“列表在页面 header 之后开始渲染”导致的偏移，确保 `scrollToIndex` 与可见范围计算准确。
- 页面 header 跟随滚动（不做 sticky），保持现有信息架构和视觉层级。

## Capabilities

### New Capabilities
- `task-list-single-scroll`: 任务列表视图使用唯一主滚动容器进行滚动与虚拟化，避免嵌套滚动，同时保持键盘导航与行内编辑动态高度稳定。

### Modified Capabilities

<!-- none -->

## Impact

- Renderer
  - 样式：`src/index.css`（`.task-scroll` 与可能的滚动锚点策略）
  - 列表组件：`src/features/tasks/TaskList.tsx`、`src/features/tasks/UpcomingGroupedList.tsx`
  - 布局/滚动容器：`src/app/AppShell.tsx`（`.content-scroll` ref 暴露方式）
  - 自测脚本：`src/app/selfTest.ts`（确保选择器/滚动断言仍正确）
- 不涉及：IPC/DB schema、跨进程协议、数据模型变更
