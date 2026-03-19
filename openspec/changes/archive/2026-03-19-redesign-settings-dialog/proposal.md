## Why

当前设置通过 `/settings` 路由占用主内容区，打断了用户在列表或项目页面中的上下文，也让“低频、快速修改后立即返回”的设置操作显得过重。现在同步配置已经进入可用阶段，需要把设置重构为更轻量、更聚焦的中央浮动界面，并明确区分通用偏好与同步配置。

## What Changes

- 将设置入口从内容区页面改为由 AppShell 管理的中央模态设置弹窗，不再依赖 `/settings` 路由承载 UI。
- 为设置弹窗增加固定顶栏与两个 tab：`常规`、`同步`。
- 将语言、主题、数据导入导出、关于等现有非同步项归并到 `常规` tab。
- 将当前 S3 同步配置、状态、操作控制整体迁移到 `同步` tab，并保持现有同步行为与安全边界不变。
- 明确定义设置弹窗的模态交互：背景锁定、支持遮罩点击关闭、支持 `Esc` 关闭、关闭后焦点返回触发按钮。
- 调整设置相关文案与测试入口，使其对齐“设置弹窗”而不是“设置页面”。

## Capabilities

### New Capabilities
- `settings-dialog`: 定义设置入口、中央模态弹窗、tab 结构、关闭语义与焦点恢复等设置容器行为。

### Modified Capabilities
- `app-language-preference`: 将语言选择器从“设置页面”迁移到“设置弹窗的常规 tab”，并保持即时生效与持久化要求。
- `app-theme-preference`: 将主题选择器从“设置页面”迁移到“设置弹窗的常规 tab”，并保持即时生效与持久化要求。
- `single-user-s3-sync`: 将同步配置与状态展示迁移到“设置弹窗的同步 tab”，并补充 tab 内的组织要求。
- `ui-localization`: 将“设置页面”相关文案要求更新为“设置弹窗 / tab”相关文案要求。

## Impact

- Affected code: `src/app/AppShell.tsx`, `src/app/AppRouter.tsx`, `src/pages/SettingsPage.tsx`, `src/features/settings/*`, `src/index.css`, `src/app/selfTest.ts`, `shared/i18n/messages.ts`
- Affected behavior: 设置入口语义、设置 UI 容器、设置关闭与焦点管理、同步配置的信息架构
- No new backend/API dependencies; existing `window.api.settings.*`, `window.api.sync.*`, `window.api.data.*` contracts remain in place
