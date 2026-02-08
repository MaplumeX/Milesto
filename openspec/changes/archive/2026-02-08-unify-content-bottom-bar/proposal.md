## Why

当前 content bottom bar 在结构与样式上人为拆成了多层容器（`content-bottom-left` + `content-bottom-action-group`），导致：
- 布局规则分散（gap/align/font/color 分别在不同容器上），增加后续 UI 迭代的认知与维护成本
- 自动化/自测选择器依赖“中间容器”，结构调整时更容易破坏测试

本变更将 bottom bar 扁平化成单一按钮序列，减少特殊分组并统一可测性挂点。

## What Changes

- 移除 `content-bottom-left` 容器（不再区分 left），bottom bar 直接承载所有按钮
- 移除 `content-bottom-action-group` 容器（不再专门有 group）
- 将 `data-content-bottom-actions="true"` 迁移到 `.content-bottom-bar` 本身，作为稳定的自测锚点
- 统一 bottom bar 内按钮间距为原 action group 的 `8px`
- 更新 `selfTest` 中对 bottom bar actions 的定位方式以匹配新结构

## Capabilities

### New Capabilities

<!-- None -->

### Modified Capabilities

- `content-bottom-bar-actions`: 不再要求存在独立的 “action group” 容器；Schedule/Move/Search 仍由全局 content bottom bar 提供，但结构与可测性挂点（data attribute）发生变化

## Impact

- UI 结构：`src/app/AppShell.tsx`、`src/app/ContentBottomBarActions.tsx`
- 样式：`src/index.css`（合并/迁移原有布局规则，删除不再使用的选择器）
- 自测：`src/app/selfTest.ts`（bottom bar actions 选择器从“后代容器”迁移为“bottom bar 自身”）

