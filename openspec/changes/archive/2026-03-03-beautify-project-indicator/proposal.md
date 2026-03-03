## Why

目前项目进度指示器没有按实际完成度渲染（partial 只是整块填充），导致“扫一眼看进度”的价值缺失，也与 Things3 的 Progress Pie 观感不一致。

此外，UI 已经计算了 `--ppc-angle`（done/total * 360deg），但样式层未消费该变量，属于明显的实现断层。

## What Changes

- 将 open 项目的 `partial` / `full` 进度以“饼图扇形”渲染（12 点起始、顺时针填充），并保留外圈与内填充之间的 gap ring。
- `partial` 填充使用更“硬”的中性灰（仍保持极简、低噪声），提升小尺寸下的可读性。
- 进度变化支持顺滑动画：使用 CSS Houdini `@property --ppc-angle` 让角度可插值；在 `prefers-reduced-motion` 下禁用动效。
- Sidebar 仍为 display-only 指示器，不引入额外焦点停靠点；交互态（hover/focus/pressed）保持克制，避免让 Sidebar 的指示器看起来像可点击控件。

## Capabilities

### New Capabilities

<!-- None -->

### Modified Capabilities

- `project-progress-indicator`: 明确并落实“按完成度渲染饼图扇形”的要求；补充“进度变化动效（可降级）”与 `partial` 填充对比度的 UI 行为约束；确保 Sidebar 仍为展示态且不增加焦点停靠点。

## Impact

- Affected UI surfaces: Sidebar open projects list, Area page projects list, Logbook completed projects list, Project page header.
- Affected code (expected): `src/index.css`, `src/features/projects/ProjectProgressControl.tsx`（必要时仅做最小改动以适配样式/可访问性）。
- Dependencies: no new dependencies.
- Platform considerations: `@property` 支持不完整时需优雅降级为无动效；保持 reduced-motion 兼容；注意长列表下的绘制/重绘成本。
