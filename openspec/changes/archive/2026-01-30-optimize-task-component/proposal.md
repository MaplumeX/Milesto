## Why

当前任务行内编辑器（inline editor）在展开态会“去皮”并与列表行完全融为一体：边框/阴影/背景被移除，展开后缺少明确的视觉聚焦与上下呼吸感。

这会让用户在长列表里更难快速定位“我正在编辑哪一条”，也降低了展开态与非展开态的层级反馈。

## What Changes

- 行内编辑器展开态改为“轻微聚焦卡片”视觉：保留/增强边框与阴影，并在展开时为该行上下留出空间。
- 不改变打开/关闭/自动保存/flush/焦点恢复等交互语义；仅调整展开态的视觉呈现与布局间距。
- 避免使用会破坏虚拟列表测量的样式（例如 margin），确保动态高度与滚动稳定性维持现有基线。

## Capabilities

### New Capabilities

<!-- none -->

### Modified Capabilities

- `task-inline-editor`: 放宽/调整“展开态必须完全与 task row 融合、不能出现第二层卡片感”的视觉要求，使其支持“轻微聚焦卡片”（border + shadow + vertical spacing）的展开态表现。

## Impact

- 样式：`src/index.css` 中与 `.task-row.is-open` / `.task-inline-paper` 相关的展开态规则。
- 列表布局：虚拟列表条目展开高度的估算值可能需要与新增上下留白对齐（`src/features/tasks/TaskList.tsx`、`src/features/tasks/UpcomingGroupedList.tsx`）。
- 回归护栏：`src/app/selfTest.ts` 覆盖了“行不重叠 / 编辑器在视口内 / 滚动跳动阈值”等稳定性断言；视觉改动必须确保这些断言仍成立。
