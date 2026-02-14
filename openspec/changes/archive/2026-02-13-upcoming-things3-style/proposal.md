## Why

Upcoming 页面（即 Plan page）的视觉风格偏"功能列表"：10px 全大写分组头 + glass 背景 + 窄间距，缺乏时间线的节奏感和呼吸感。对标 Things 3 的 Upcoming 视图，需要用排版层级和留白来建立信息层次，而非依赖背景色和边框装饰。这与项目 `ui.md` 中"信息层级靠排版、间距、对比度建立"的设计原则一致。

## What Changes

- 日分组头从单字符串标签改为结构化的"大号日期数字 + 小号星期"双元素排版，去掉 glass 背景和 border-bottom
- 月分组头改为更大字号 + 底部细线样式，与日标题形成明确的层级区分
- 分组间距从 14px 统一值改为日间距 24px / 月间距 36px 的差异化间距
- 月份任务行的日期前缀从 10px 调大到 12px
- Virtualizer 的 estimateSize 同步更新以匹配新的行高

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `plan-page`: 日/月分组头的视觉样式变更，间距增大，日标题数据结构从单 string 改为结构化对象

## Impact

- `upcoming-labels.ts` — `formatUpcomingDayHeader` 返回值从 `string` 改为 `{ day: string; weekday: string }`
- `upcoming-grouping.ts` — `UpcomingRow` header 类型需要适配新的 label 结构
- `UpcomingGroupedList.tsx` — header 渲染逻辑、estimateSize 高度值
- `index.css` — `.upcoming-header`、`.upcoming-spacer`、`.upcoming-date-prefix` 样式重写
- `tests/unit/upcoming-labels.test.ts` — 断言更新
