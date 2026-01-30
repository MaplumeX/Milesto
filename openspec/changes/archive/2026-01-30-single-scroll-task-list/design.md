## Context

Milesto 的内容区已经有明确的主滚动容器：`src/index.css` 中 `.content-scroll { overflow: auto; }`，由 `src/app/AppShell.tsx` 渲染。

当前任务列表组件（`src/features/tasks/TaskList.tsx` 与 `src/features/tasks/UpcomingGroupedList.tsx`）在页面内容内部又引入了第二个滚动容器：`.task-scroll { overflow: auto; max-height: 60vh; ... }`。

这带来了：
- 嵌套滚动导致的滚轮/触控板“滚动目标不确定”，用户感觉列表被一个独立容器包裹。
- 与 `docs/ui.md` 的布局原则冲突：内容区应有且只有一个主要滚动容器。

技术背景：任务列表使用 `@tanstack/react-virtual`（v3.13.18）进行虚拟化，并支持动态高度（行内编辑器展开后高度变化，使用 `measureElement` 测量）。

## Goals / Non-Goals

**Goals:**
- 在任务列表相关页面中只保留一个主要滚动容器：`.content-scroll`。
- 任务列表本身不再创建独立滚动区域（不再 `overflow:auto` / `max-height`），滚动统一由 `.content-scroll` 承担。
- 虚拟列表仍然基于 `.content-scroll` 正确计算可见范围，`scrollToIndex` 行为准确。
- 保持现有键盘导航（ArrowUp/Down/Enter/Space）与行内编辑器的稳定性（动态高度不重叠、不抖动）。

**Non-Goals:**
- 不改变页面 header 的行为（本 change 明确为“跟随滚动”，不做 sticky）。
- 不引入新的 UI 框架或大规模样式重做（只为消除嵌套滚动提供必要改动）。
- 不修改 IPC/DB/数据模型。

## Decisions

1) **将虚拟列表 scroll element 统一切到 `.content-scroll`**

- 方案：在 AppShell 层获取 `.content-scroll` 的 DOM 引用，并通过一个轻量的 React Context 向下提供（例如 `ScrollContainerContext`）。任务列表组件通过 hook 取到 scroll element，并在 `useVirtualizer({ getScrollElement })` 中返回它。
- 备选：在任务列表内部 `document.querySelector('.content-scroll')`。
- 取舍：Context 方式更稳定、可测试、对布局变化更不脆弱；避免多滚动容器或结构调整时的误选。

2) **保留 `.task-scroll` 作为语义/交互容器，但移除其滚动职责**

- `.task-scroll` 仍可承担 `role="listbox"`、`tabIndex`、`onKeyDown` 等键盘交互收口（现有实现依赖它作为事件入口）。
- 通过 CSS 移除 `.task-scroll` 的 `overflow` / `max-height`，让滚动自然落到 `.content-scroll`。

3) **用 `scrollMargin` 修正“列表起点在 header 之后”的偏移**

- 问题：当 scroll element 变为 `.content-scroll` 后，列表的第 0 个虚拟 item 并不是从 scrollTop=0 开始渲染（前面有 `.page-header` 与 `.page` padding）。如果不修正，range 计算与 `scrollToIndex` 会出现对齐偏差。
- 方案：使用 TanStack Virtual v3 的 `scrollMargin`，其值为“列表内容起点相对 scroll container 的静态偏移”。实现上用 DOM 测量计算：
  - `scrollMargin = (listRootRect.top - scrollRect.top) + scrollElement.scrollTop`
  - 其中 `listRootRect` 为列表根元素（例如 `.task-scroll` 或其内部 wrapper）的 `getBoundingClientRect()`。
  - 在布局可能变化时（首次 mount、窗口 resize、内容区尺寸变化）重新计算。

4) **滚动锚点策略：避免动态高度变化导致跳动**

- 当前 `.task-scroll` 设置了 `overflow-anchor: none`。当 `.task-scroll` 不再是滚动容器后，这个设置不再生效。
- 为了保持行内编辑器动态高度变化时的稳定性，将 `overflow-anchor: none` 迁移到 `.content-scroll`（或等价的主滚动容器）更符合意图。

## Risks / Trade-offs

- **[scrollMargin 计算不准]** → 可能导致 `scrollToIndex` 对齐偏差或键盘导航滚动异常。
  - Mitigation：用稳定的公式（rect + scrollTop），并在 resize/布局变化时重新计算；加入自测覆盖关键行为。

- **[动态高度 + 主滚动]** → 行内编辑器高度变化可能更容易触发浏览器滚动锚点/回流导致的跳动。
  - Mitigation：把 `overflow-anchor: none` 放到主滚动容器；继续使用 `measureElement` 并确保测量绑定在正确的 item 元素上。

- **[实现面扩大]** → 引入 Context 需要跨模块改动（AppShell + 列表组件）。
  - Mitigation：Context 尽量小（只暴露一个 `getScrollElement` 或 DOM ref），避免把更多布局细节外泄。
