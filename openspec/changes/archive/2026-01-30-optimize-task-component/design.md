## Context

Milesto 目前的任务编辑采用“行内展开”（inline editor）模式：当 `openTaskId` 命中某条任务时，该任务行（`li.task-row.is-open`）会被替换为包含 `TaskEditorPaper`（`div.task-inline-paper`）的编辑器容器。

当前样式实现里，展开态会对 `.task-inline-paper` 进行“去皮”（border/background/shadow/padding 被清空），让编辑器视觉上与列表行完全融合。这符合既有 spec 中“不要出现第二层卡片/纸张容器感”的要求，但用户反馈希望展开时有更明确的“聚焦卡片”反馈：边框 + 轻微阴影，并在上下留出空间。

关键约束：
- 任务列表在 Inbox/Today/Upcoming 等视图使用 `@tanstack/react-virtual` + 主内容区单一滚动容器（single scroll host）。展开态高度变化会被 `measureElement` 动态测量。
- 自测 `src/app/selfTest.ts` 覆盖了：展开编辑器不应导致行重叠、编辑器应保持在视口内、滚动跳动不应过大、关闭/切换前必须 flush、关闭后必须恢复焦点。

## Goals / Non-Goals

**Goals:**
- 展开任务编辑器时显示“轻微聚焦卡片”视觉：保留/增强边框与阴影。
- 展开态在该任务上下留出空间，使其从相邻行中更易被识别。
- 适配虚拟列表动态测量：展开高度变化不引入重叠/错位，滚动稳定性维持现有基线。
- 该视觉在所有使用 inline editor 的列表一致生效（TaskList/UpcomingGroupedList/Search 结果）。

**Non-Goals:**
- 不改变打开/关闭/切换任务的交互语义（Enter/DoubleClick 打开，Esc/Cmd+Enter 关闭，close/switch 前 flush）。
- 不调整 click-away 的事件拦截策略（document pointerdown capture）或焦点恢复策略。
- 不引入新的 UI 框架或组件库；仅在现有 CSS/组件结构内完成。

## Decisions

1) 通过 CSS 调整展开态视觉，而不是改动编辑器结构
- 现有结构已经满足“同一 task row 内展开”的语义与自测覆盖。
- 视觉聚焦卡片可以通过恢复/增强 `.task-inline-paper` 的边框/阴影，以及在 `.task-row.is-open` 上增加可测量的上下 padding 实现。

2) 上下留白使用 padding（参与布局测量），避免 margin
- 虚拟列表测量高度不包含 margin；使用 margin 会出现“视觉上有间距但布局未计入”的重叠/跳动风险。
- 使用 padding 能被 `measureElement` 真实测量，并能被 `assertNoOverlap` 覆盖。

3) 调整虚拟列表展开态的 estimateSize 以贴近真实高度
- TaskList 与 UpcomingGroupedList 的展开态估算高度目前为 360px。
- 增加上下留白会使实际高度略增，可能导致“打开时先按 360 估算、测量后再修正”的跳动。
- 设计上将展开态估算值上调到更接近实际高度（以减少首次测量修正幅度），并以 selfTest 的滚动跳动阈值作为回归护栏。

4) 聚焦卡片的强调保持“轻量”
- 仅增强边框透明度与增加一层柔和的 ambient shadow；不引入强烈的 focus ring 或 modal-like 的遮罩。
- 保持 Notes 等内部输入仍为无边框/无底色风格，避免视觉噪音。

## Risks / Trade-offs

- [虚拟列表打开时滚动跳动变大] → 通过更新 estimateSize 贴近实际、并依赖 selfTest 的阈值断言回归。
- [卡片感与既有 spec 冲突] → 本 change 会通过 delta spec 修改 `task-inline-editor` 的相关要求，明确允许“轻微聚焦卡片”。
- [跨页面不一致] → 统一在共享样式（`src/index.css`）与共享 class（`.task-row.is-open` / `.task-inline-paper`）上实现，确保 TaskList/Upcoming/Search 一致。
