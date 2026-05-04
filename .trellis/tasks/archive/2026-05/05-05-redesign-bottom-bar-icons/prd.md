# 重绘底栏按钮图标

## Goal

使用 Lucide 图标库替换底栏 8 个自定义内联 SVG 图标，统一视觉风格，提高可维护性。

## Requirements

* 安装 `lucide-react` 依赖
* 用 Lucide 图标组件替换 `src/app/bottom-bar-icons.tsx` 中全部 8 个内联 SVG
* 图标映射：task→CirclePlus, project→FolderPlus, section→ListPlus, schedule→Calendar, move→ArrowRightLeft, search→Search, delete→Trash2, more→Ellipsis
* 使用 Lucide 默认 strokeWidth=2
* 保持 `BottomBarIconKey` 类型和 `getBottomBarIconDefinition()` 接口不变，`BottomBarActionButton` 无需修改
* 保持与深色/浅色主题兼容（currentColor）

## Acceptance Criteria

* [ ] 8 个图标全部替换为 Lucide 组件
* [ ] `BottomBarActionButton` 组件无需修改即可正常渲染
* [ ] 在深色和浅色主题下均显示正常
* [ ] 各图标语义清晰、无歧义
* [ ] 无 lint/typecheck 错误

## Definition of Done

* Lint / typecheck / CI green
* 视觉验证（dev 模式下检查）

## Decision (ADR-lite)

**Context**: 底栏图标为手绘内联 SVG，风格不统一且维护成本高
**Decision**: 引入 lucide-react，用 Lucide 图标替换全部 8 个底栏图标，strokeWidth 使用默认 2
**Consequences**: 新增一个 npm 依赖（tree-shaking 后约 5-6KB gzipped）；底栏图标描边略粗于侧边栏（2 vs 1.8），视觉差异极小；侧边栏图标可后续迁移

## Out of Scope

* 侧边栏图标迁移到 Lucide
* 图标尺寸/布局变化
* 底栏功能逻辑变更
* `BottomBarActionButton` 组件重构

## Research References

* [`research/lucide-icon-mapping.md`](research/lucide-icon-mapping.md) — 8 个图标的 Lucide 映射、包信息、tree-shaking 详情

## Technical Notes

* 图标定义文件：`src/app/bottom-bar-icons.tsx`
* 图标渲染组件：`src/app/BottomBarActionButton.tsx`
* CSS 样式：`src/index.css`（`.content-bottom-action-icon`）
* Lucide 图标组件接受 `size`、`strokeWidth`、`color` 等 props，渲染为 `<svg>`
