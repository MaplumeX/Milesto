## 1. 扁平化 Bottom Bar DOM

- [x] 1.1 在 `src/app/AppShell.tsx` 中移除 `.content-bottom-left` 容器，并将 bottom bar 内按钮作为 `.content-bottom-bar` 的直接 children
- [x] 1.2 将 `data-content-bottom-actions="true"` 挂到 `.content-bottom-bar` 本身（而不是 actions wrapper）
- [x] 1.3 在 `src/app/ContentBottomBarActions.tsx` 中移除 `.content-bottom-action-group` wrapper 与相关 data attribute，改为直接返回三个按钮（保留 popover portal）

## 2. 统一 Bottom Bar 样式

- [x] 2.1 将原 `.content-bottom-left` / `.content-bottom-action-group` 的布局规则合并到 `.content-bottom-bar`（`display:flex`、`align-items:center`、`gap:8px` 等）
- [x] 2.2 删除不再使用的 CSS 选择器（至少包括 `.content-bottom-left` 与 `.content-bottom-action-group`；若 `.content-bottom-right` 未使用则一并清理）
- [ ] 2.3 快速目检交互样式：hover/focus-visible 边框、背景与阴影效果保持不变（仍由 `.content-bottom-bar .button` 规则驱动）

## 3. 自测适配

- [x] 3.1 更新 `src/app/selfTest.ts`：`bottomBarActions` 不再通过 `bottomBar.querySelector(...)` 获取后代容器，而是直接使用 `bottomBar`（或改为全局查询）以适配 data attribute 迁移
- [x] 3.2 确认自测仍覆盖：无选中 task 时 Schedule/Move disabled；选中 task 后 enabled；Search 打开 SearchPanel 并聚焦输入框

## 4. 校验

- [x] 4.1 运行 `npx tsc -p tsconfig.json` 确保类型检查通过
- [ ] 4.2 手动冒烟：在 Inbox 与 Project 页面验证 bottom bar 按钮可见性与 popover anchor/关闭/焦点恢复行为
