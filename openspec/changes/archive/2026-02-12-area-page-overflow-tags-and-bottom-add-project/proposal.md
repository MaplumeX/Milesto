## Why

目前领域（Area）页面的标题栏动作分散为多个按钮（重命名/删除/添加项目），导致标题区噪声较高，也与 Project 页面“单一溢出菜单承载元操作”的交互模式不一致。

同时，领域相关的低频元操作（管理标签、删除领域）更适合收敛在 `...` 菜单内；而“添加项目”作为常用创建动作，放在全局底部栏（Content Bottom Bar）更符合当前应用的入口分层。

## What Changes

- 领域页面标题栏移除当前的显式动作按钮（重命名/删除/添加项目），改为单一 `...`（设置）按钮。
- `...` 菜单提供：
  - 管理领域标签：可创建新标签、勾选/取消领域关联标签，并持久化领域的有序 tags 关系。
  - 删除领域：确认后删除领域，并导航至 `/today`，避免停留在已删除资源的路由。
- Content Bottom Bar 在用户位于 `/areas/:areaId` 且未打开任务编辑器时，额外提供 `+ 项目` 按钮：
  - 点击创建一个归属到该领域的新项目，并导航到新项目页并立即进入标题编辑（`?editTitle=1`）。

## Capabilities

### New Capabilities
- `area-page`: 领域页面的标题栏溢出菜单（标签管理/删除领域）与领域页专属底栏动作（+ 项目）的行为契约

### Modified Capabilities

<!-- none -->

## Impact

- Renderer：`src/pages/AreaPage.tsx`（标题栏动作收敛、标签管理入口、删除后导航）；可能复用/参考 `src/pages/ProjectPage.tsx` 的溢出菜单交互与 tags 子视图模式。
- Renderer Shell：`src/app/AppShell.tsx`（底栏在 Area 路由下增加 `+ 项目` 动作）。
- i18n：`shared/i18n/messages.ts` 可能需要补充 Area 菜单相关文案/aria label（对齐 Project 菜单已有键）。
- 依赖既有能力：领域 tags 的读取/写入走 `window.api.area.getDetail` / `window.api.area.setTags`（由 `project-area-tags` 能力约束）。
