## Context

Milesto 的项目进度指示器由 `ProjectProgressControl` / `ProjectProgressIndicator` 渲染，统一使用 `.project-progress-control` 样式，并通过 `data-progress` 表达 `none | partial | full | done`（done 由 `project.status` 决定）。

现状：

- UI 逻辑已计算 `--ppc-angle = done/total * 360deg`（仅 partial 时设置），但 `src/index.css` 未消费该变量，导致 partial 进度无法按比例呈现。
- 现有 CSS 仅用纯色填充区分 `partial` 与 `full`，不符合 `project-progress-indicator` 规范中“饼图扇形”的要求。

约束：

- 必须保留 gap ring（外圈 border 与内填充之间可见底色的环形空隙），并支持 list/header 两种尺寸。
- Sidebar 使用 display-only 指示器（`<span>`，嵌套在链接内），不可引入额外焦点停靠点或“看起来可点击”的强交互反馈。
- 对齐 `docs/ui.md`：极简、低噪声、动效克制（120-200ms）且必须支持 reduced-motion。

## Goals / Non-Goals

**Goals:**

- 用 CSS `conic-gradient()` 将 `partial` / `full` 进度渲染为“饼图扇形”（12 点起始，顺时针填充），并复用现有 `::before` inset + gap ring 结构。
- `partial` 使用更“硬”的中性灰填充（token 化），在 12-16px 的小尺寸下更易扫读，同时保持整体克制。
- 进度变化提供顺滑动画：通过 CSS Houdini `@property --ppc-angle` 使角度可插值；`prefers-reduced-motion: reduce` 下禁用动效。
- 保持 open=100%（full）与 done（checkmark）在视觉上可区分；done 仍只在 `project.status = done` 时出现。

**Non-Goals:**

- 不追求像素级复刻 Things3（只对齐其“安静、可扫读”的信息层级）。
- 不改变任务/项目数据模型、IPC API 或进度计算逻辑。
- 不引入新依赖（例如进度环组件库、动画库）。
- 不重构导航/列表布局，仅做最小样式与必要的可访问性修正。

## Decisions

1) **渲染路线：conic-gradient + 现有 pseudo-element**

- 在 `.project-progress-control::before` 上用 `conic-gradient()` 绘制扇形，利用现有 `inset: var(--ppc-gap)` 自然形成 gap ring。
- 使用硬色标（hard color stops）生成清晰的扇形边界。
- `conic-gradient` 的起点为北（12 点）并顺时针（与规范一致），如需显式表达可使用 `from 0deg`。

2) **角度与状态映射**

- `partial`：继续由组件设置 `--ppc-angle`（deg），并在 CSS 中直接引用。
- `full`：在 CSS 侧将 `--ppc-angle` 设为 `360deg`（或 `1turn`），使 `full` 与 `partial` 共用同一渲染管线；并允许从 99%→100% 时“扫到满”。
- `none`：保持透明（空心），满足“open + zero tasks renders empty”。
- `done`：保持现有 done 样式（隐藏 border、填充为 text 色并显示 check），且不会渲染饼图扇形。

3) **配色策略（1B）**

- 新增 token：`--ppc-fill-partial`（更硬的中性灰），并在暗色模式下提供对应值。
- `full` 填充应不弱于 `partial`（可沿用 `--wash-strong` 或提供 `--ppc-fill-full`）。具体数值以视觉验收为准，避免在 Sidebar 产生过强噪声。

4) **动效策略（2 要）**

- 在全局 CSS 注册：`@property --ppc-angle { syntax: '<angle>'; inherits: true; initial-value: 0deg; }`
- 对 `.project-progress-control` 设置 `transition: --ppc-angle 180ms cubic-bezier(0.2, 0, 0, 1)`（或等价），并保留现有 border-color 的轻量 hover 过渡。
- `prefers-reduced-motion: reduce` 下禁用与 `--ppc-angle` 相关的 transition。

5) **交互态与 Sidebar 的“非按钮感”**

- 将边框 hover 强化限定到 `button.project-progress-control`（交互面）而非 `.project-progress-control`（同时适用于 span）。
- Sidebar 主要依赖行级 hover/active 的 wash 背景来表达交互，指示器本身保持安静。

## Risks / Trade-offs

- **[性能] conic-gradient 与角度动画可能触发重绘** → 保持元素尺寸极小（20/24px），只动画 `--ppc-angle` 且时长短；在长列表场景做实际 profile；reduced-motion 直接禁用。
- **[兼容] `@property` 支持差异** → 不依赖动画正确性；不支持时退化为“无动效但静态正确”的扇形渲染。
- **[视觉] conic-gradient 在 0/360 边界可能出现 seam** → 若出现细缝，采用轻微重叠（例如末端 +0.5deg）或通过 hard stops 的排列避免反走样；以实际渲染为准。
- **[样式耦合] `.project-progress-control` 同时用于 button/span** → 通过更精确的选择器隔离 hover/focus 样式，避免 Sidebar “看起来可点击”。
