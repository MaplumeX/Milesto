## Context

Upcoming 页面（代码中称 Plan page）当前使用扁平化的分组头样式：10px 全大写标签 + `var(--glass-strong)` 背景 + `border-bottom`。视觉层级依赖装饰（背景、边框），而非排版。参照 Things 3 的 Upcoming 视图风格，需要转向纯排版驱动的层级建立方式。

当前实现：
- `formatUpcomingDayHeader()` 返回 `string`（如 `"2.14 周五"`）
- `UpcomingGroupedList.tsx` 将 header 作为单文本节点渲染
- `.upcoming-header` CSS 对 day/month 不做视觉区分
- spacer 统一 14px

## Goals / Non-Goals

**Goals:**
- 日分组头用"大号日期数字 + 小号星期"建立排版层级，去掉装饰性背景和边框
- 月分组头与日分组头形成明确的层级区分（更大字号 + 底部细线）
- 增大分组间距，日间距 24px / 月间距 36px，建立时间线的呼吸感
- 月份日期前缀调大到 12px，与整体比例协调
- 保持暗色主题兼容（全部使用 CSS 变量）

**Non-Goals:**
- 不改变分组逻辑（7天+5月的窗口策略不变）
- 不改变任务行样式（checkbox、行高、选中态等）
- 不增加时间线竖线等额外装饰元素
- 不添加"明天"/"后天"相对日期标签
- 不改变键盘导航行为

## Decisions

### Decision 1: `formatUpcomingDayHeader` 返回结构化对象

**选择**: 返回 `{ day: string; weekday: string }` 替代 `string`

**原因**: 日期数字和星期需要不同的字号/颜色/字重，必须作为独立 DOM 元素渲染。返回结构化对象让渲染层能分别应用样式。

**替代方案**: 在渲染层拆分 string — 需要正则匹配不同 locale 格式，脆弱且不优雅。

### Decision 2: 月标题保持 string 返回值

**选择**: `formatUpcomingMonthHeader` 继续返回 `string`

**原因**: 月标题不需要内部元素的差异化样式（不像日标题需要拆分日期/星期），通过 `data-upcoming-header-kind="month"` 在 CSS 中区分即可。

### Decision 3: 通过 CSS attribute selector 区分日/月分组样式

**选择**: 使用已有的 `data-upcoming-header-kind` 属性 + CSS `[data-upcoming-header-kind="day"]` / `[data-upcoming-header-kind="month"]` 选择器

**原因**: HTML 已经标记了 `data-upcoming-header-kind`，无需新增 class 或修改 DOM 结构。

### Decision 4: UpcomingRow header 类型使用 union 区分 label 结构

**选择**: header 的 `label` 字段改为 `string | { day: string; weekday: string }`，day kind 使用对象，month kind 使用 string

**替代方案**: 拆成两个独立 header 类型 — 增加了 row 类型数量但无实质收益。

### Decision 5: spacer 高度通过 CSS + attribute selector 控制

**选择**: 为 spacer 元素也加上 `data-upcoming-header-kind` 标记，CSS 中按 kind 区分高度

**原因**: spacer 已有 `kind` 字段，只需在渲染时输出到 DOM。避免在 TS 中硬编码不同 spacer 高度常量。但 virtualizer 的 `estimateSize` 仍需区分，因为它在 CSS 渲染前就需要高度估算。

## Risks / Trade-offs

- **[Risk] estimateSize 与实际 CSS 高度不一致** → 更新 estimateSize 中 header/spacer 的返回值，并配合 `measureElement` 做实际测量修正。当前已使用 `measureElement`，风险可控。
- **[Risk] 测试断言需要同步更新** → `upcoming-labels.test.ts` 中 `formatUpcomingDayHeader` 的断言需要从 string 比较改为对象比较。
- **[Trade-off] 大间距在任务密集时需要更多滚动** → 通过更清晰的视觉节奏补偿，用户定位特定日期更快。
