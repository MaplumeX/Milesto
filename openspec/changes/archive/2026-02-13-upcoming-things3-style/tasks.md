## 1. 数据结构改造

- [x] 1.1 修改 `formatUpcomingDayHeader`（`upcoming-labels.ts`）：返回值从 `string` 改为 `{ day: string; weekday: string }`
- [x] 1.2 修改 `UpcomingRow` 类型（`upcoming-grouping.ts`）：header 的 `label` 字段改为 `string | { day: string; weekday: string }`
- [x] 1.3 更新 `buildUpcomingRows`（`upcoming-grouping.ts`）：日分组头使用新的结构化 label
- [x] 1.4 更新 `upcoming-labels.test.ts`：`formatUpcomingDayHeader` 断言改为对象比较

## 2. 渲染层改造

- [x] 2.1 修改 `UpcomingGroupedList.tsx` header 渲染：day kind 渲染两个 span（`.upcoming-day-number` + `.upcoming-day-weekday`），month kind 渲染单文本
- [x] 2.2 修改 `UpcomingGroupedList.tsx` spacer 渲染：输出 `data-upcoming-header-kind` 属性到 spacer DOM 元素
- [x] 2.3 更新 `estimateSize`：day header → 42px，month header → 48px，day spacer → 24px，month spacer → 36px

## 3. CSS 样式

- [x] 3.1 重写 `.upcoming-header` 基础样式：去掉 glass 背景、border-bottom、text-transform，改为 transparent 背景 + 更大 padding
- [x] 3.2 新增 `.upcoming-header[data-upcoming-header-kind="day"]` 样式：无边框无背景
- [x] 3.3 新增 `.upcoming-day-number` 样式：18px，font-weight 600，color var(--text)
- [x] 3.4 新增 `.upcoming-day-weekday` 样式：12px，font-weight 400，color var(--muted)
- [x] 3.5 新增 `.upcoming-header[data-upcoming-header-kind="month"]` 样式：14px，font-weight 600，border-bottom 1px solid var(--border)
- [x] 3.6 修改 `.upcoming-spacer` 样式：按 `data-upcoming-header-kind` 区分 day 24px / month 36px
- [x] 3.7 修改 `.upcoming-date-prefix`：font-size 从 10px 调大到 12px，min-width 从 42px 调到 46px

## 4. 验证

- [x] 4.1 视觉验证：亮色/暗色主题下日标题、月标题、间距、日期前缀的显示效果
- [x] 4.2 功能验证：键盘导航（ArrowUp/Down/Enter）在新布局下仍正常工作
- [x] 4.3 虚拟滚动验证：滚动流畅，无行高跳动
