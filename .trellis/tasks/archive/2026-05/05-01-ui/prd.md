# 优化设置界面UI设计

## Goal
优化 Milesto 设置界面的视觉设计和交互体验，使其更加精致、一致，并符合现代 macOS 桌面应用的审美标准（类似 Things 3 的克制简洁风格）。

## What I already know

- 设置界面由 `SettingsDialog`（模态对话框，双 tab）和 `SettingsPage`（独立页面，仅 General）两个入口组成
- 当前有两个面板：`GeneralSettingsPanel`（语言、主题、字体大小、数据、关于）和 `SyncSettingsPanel`（同步状态、服务器配置）
- 现有样式已采用 Things 3 风格的极简列表布局：section title 为大写小字，rows 为左右对齐的标签+控件
- 对话框有圆角、毛玻璃头部、tab 切换、focus trap、Escape 关闭等基础交互
- 使用 CSS 变量支持 light/dark 主题
- 字体大小滑块有自定义的 default marker 指示
- `SettingsPage` 没有任何外部引用，仅自身导出；AppShell 已使用 `SettingsDialog` 作为唯一设置入口；AppRouter 中无 `/settings` 路由

## Requirements

### 1. 移除 SettingsPage，统一使用 SettingsDialog 作为设置入口
- 删除 `src/pages/SettingsPage.tsx`
- 删除 `src/index.css` 中 `.settings-page-stack` 样式规则

### 2. Tab 视觉升级（方案 C：极简文字高亮）
- 保持文字 tab 的基础形式，移除当前的 `border-radius: 8px 8px 0 0` 和底部边框变体
- Active tab：文字加粗（font-weight: 600），增加微妙的底部指示条（2px accent color 或 text color）
- Hover tab：文字颜色从 muted 过渡到 text，背景保持透明（不引入 wash/wash-strong 背景）
- Tab 之间的间距适当拉开（gap 从 4px 增大到 8–12px）
- Tab 区域整体更简洁，去掉底部边框或改为极淡的分隔线

### 3. Row 间距和分隔线优化
- `.settings-row` 的 padding 从 `5px 0` 适当增大到 `8–10px 0`
- `.settings-row + .settings-row` 的 border-top 颜色使用 `color-mix(in srgb, var(--border) 60%, transparent)` 使其更柔和
- `.settings-section + .settings-section` 的间距从 `10px` 适当增大到 `16–20px`，让 section 之间更透气
- 保持标签和控件的水平对齐关系

## Acceptance Criteria

- [x] `SettingsPage.tsx` 已删除，无编译错误
- [x] `.settings-page-stack` CSS 规则已删除
- [x] Tab 样式：active 有底部指示条+加粗文字，hover 有颜色过渡
- [x] Tab 区域底部边框变柔和
- [x] Row 间距更透气（padding 从 5px 增大到 8px）
- [x] 分隔线更柔和（color-mix 55% opacity）
- [x] Section 之间间距增大（从 10px 到 18px）
- [x] Light/Dark 主题下均表现良好（使用 CSS 变量 + color-mix）
- [x] 设置对话框的打开/关闭/切换 tab 交互正常
- [x] Focus trap 和 Escape 关闭不受样式改动影响

## Definition of Done

- Lint / typecheck / CI green
- 视觉改动通过肉眼确认（启动 dev server 验证）
- 相关 i18n 文案无缺失

## Out of Scope

- 新增设置功能项（如快捷键设置、通知设置等）
- 设置对话框改为侧边栏导航布局
- 面板内部控件样式大改（Select、Button、Slider 等保持原样）
- 毛玻璃头部效果改动

## Decision (ADR-lite)

**Context**: Tab 视觉升级有三种可选方案（pill 胶囊、滑动指示器、极简文字高亮）
**Decision**: 选择方案 C（极简文字高亮），保持与 Things 3 整体克制简洁风格一致
**Consequences**: 改动最小，风险最低，与现有设计语言最协调

## Technical Notes

- `src/features/settings/SettingsDialog.tsx` — 模态对话框入口
- `src/pages/SettingsPage.tsx` — 待删除的独立页面入口
- `src/features/settings/GeneralSettingsPanel.tsx` — 通用设置面板
- `src/features/settings/SyncSettingsPanel.tsx` — 同步设置面板
- `src/index.css` — 所有设置相关样式（约 2649–3010 行）
- 使用 CSS 变量：--paper, --panel, --border, --text, --muted, --accent, --scrim, --glass, --wash 等
