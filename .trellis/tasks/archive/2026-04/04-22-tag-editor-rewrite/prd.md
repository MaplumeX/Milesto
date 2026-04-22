# 重构标签编辑器：现代化 TagPicker + Inline 管理

## Goal

将现有碎片化、重复的标签编辑 UI 统一为现代化的 `TagPicker` 组件，提供流畅的搜索/新建/选择体验，并支持 inline 标签管理（改色、重命名、删除），彻底消除四处重复实现的代码。

## What I already know

* 当前没有独立的标签编辑组件，标签编辑逻辑散落在 4 处：
  - `TaskEditorPaper.tsx` inline 版（lines 1115-1197）：popover 内 checkbox 网格 + 新建输入框
  - `TaskEditorPaper.tsx` overlay 版（lines 1818-1938）：完整标签网格 + `<select>` 改色 + `prompt()` 重命名 + `confirm()` 删除 + `prompt()` 新建
  - `ProjectPage.tsx` ProjectMenu 内（lines 962-1571）：新建输入框 + checkbox 网格
  - `AreaPage.tsx` AreaMenu 内（lines 515-800）：同上
  - `use-sidebar-entity-context-menu.tsx` sidebar context menu：同上
* 现有颜色预设 8 色（None + Red/Orange/Yellow/Green/Blue/Purple/Gray），用 `<select>` 下拉选择
* Tag 模型：`{ id, title, color, created_at, updated_at, deleted_at }`
* Window API：`tag.create`, `tag.update`, `tag.delete`, `tag.list` + `task.setTags`, `project.setTags`, `area.setTags`
* 现有 `TagFilter` 组件已支持彩色 pill 展示（复用其色板逻辑）
* `TaskRow.tsx` 通过 `getTaskTagPreview()` 最多展示 2 个标签标题 + overflow

## Assumptions (temporary)

* 保持现有颜色预设 8 色不变（仅改变交互方式，从 `<select>` 改为色板网格）
* 所有使用标签选择器的场景（任务 inline/overlay、项目、Area、sidebar）统一替换
* 标签管理的重命名/改色/删除操作不再使用 `prompt()` / `confirm()`

## Decision (ADR-lite)

**Context**: 标签管理功能（改色/重命名/删除）放在哪里的权衡
**Decision**: 仅在 overlay / 页面菜单中提供完整管理功能；inline task editor 的 popover 只做选择 + 新建
**Consequences**: inline 保持轻量，管理操作引导到 overlay；组件通过 props 区分模式（`mode: 'select' | 'manage'`）

## Requirements

* 新建可复用的 `TagPicker` 组件，通过 `mode: 'select' | 'manage'` 区分两种交互级别
  - `select` 模式（inline task editor）：搜索/选择/新建标签，无管理功能
  - `manage` 模式（overlay + 页面菜单 + sidebar）：在 select 基础上增加改色/重命名/删除
* Popover 浮层风格：顶部搜索/新建输入框 + 标签列表
* 标签列表项：左侧彩色圆点 + 标题，右侧 check 图标表示选中状态
* 支持键盘导航（↑/↓ 切换焦点，Enter 切换选中/创建，Esc 关闭）
* 搜索无匹配时显示"创建「xxx」"选项，Enter 或点击一键创建并选中
* `manage` 模式下的标签管理：
  - 改色：点击圆点展开色板网格（替代 `<select>`）
  - 重命名：点击标签标题变为 inline 输入框，Enter/Blur 保存，Esc 取消
  - 删除：hover 出现 trash 图标，点击后进入确认态（显示"删除"按钮），再次点击确认删除
* 替换所有现有标签编辑代码（TaskEditorPaper inline + overlay、ProjectPage、AreaPage、sidebar context menu）
* 保持现有数据流不变（仍通过 `window.api.tag.*` 和 `*.setTags`）

## Acceptance Criteria

* [ ] `TagPicker` 组件可在所有 5 个使用点复用
* [ ] 标签选择支持搜索过滤 + 键盘导航
* [ ] 新建标签通过输入框实时完成（无 `prompt()`）
* [ ] 标签改色使用色板网格替代 `<select>`
* [ ] 标签重命名 inline 编辑替代 `prompt()`
* [ ] 标签删除带确认态替代 `confirm()`
* [ ] `npm run lint` 和 `npx tsc -p tsconfig.json` 通过
* [ ] 原有标签功能（选择、过滤、展示）无回归

## Definition of Done

* Lint / typecheck 全绿
* 无 `prompt()` / `confirm()` 遗留
* 重复标签编辑代码完全消除
* 键盘交互可用

## Out of Scope (explicit)

* 新增独立 Tags 管理页面（方案 C 的内容）
* 标签合并功能
* 修改标签颜色预设值（保持现有 8 色）
* 新增 DB Worker action（复用现有 `tag.*` API）

## Technical Notes

* 颜色预设定义于 `src/features/tasks/TaskEditorPaper.tsx:126-135`
* 受影响文件：`TaskEditorPaper.tsx`, `ProjectPage.tsx`, `AreaPage.tsx`, `use-sidebar-entity-context-menu.tsx`
* 新建组件建议位置：`src/components/TagPicker.tsx` 或 `src/features/tags/TagPicker.tsx`
* 可参考 `TagFilter.tsx` 的 pill 色板展示逻辑
