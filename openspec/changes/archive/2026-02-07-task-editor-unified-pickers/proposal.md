## Why

当前行内任务编辑器（Schedule/Due）的弹出层内部使用 `input[type="date"]` 并触发原生日期选择器（`showPicker()`），导致出现“面板 + 系统日历面板”的割裂体验；Tags 弹出层仅支持勾选，缺少快速新建入口。

这在高频整理任务时造成额外认知切换与操作摩擦，且原生日期选择器在不同平台上的表现不一致。

## What Changes

- 行内编辑器的 `Schedule` / `Due` picker 改为在同一个 popover 内直接渲染日历（calendar + 快捷按钮同层），不再依赖原生 `input[type="date"]` 的系统面板。
- `Schedule` picker 保留并内聚快捷操作：`Someday` / `Today` / `Clear`（与日历同一容器）。
- `Due` picker 改为同层日历选择，并保留 `Clear`。
- `Tags` picker 在面板顶部增加输入框：仅支持“输入 + 回车创建新 tag”，不做过滤/搜索；创建成功后自动选中。
- 新增第三方依赖：`react-day-picker`（用于嵌入式日历，周一为一周起始）。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `task-inline-editor`: Schedule/Due picker 的呈现方式从“popover + 原生日历面板”改为“单一 popover 内嵌日历”；Tags picker 增加快速创建输入框。

## Impact

- Renderer UI：主要影响 `src/features/tasks/TaskEditorPaper.tsx`（inline picker 渲染、焦点管理、关闭逻辑）与相关样式（popover 尺寸/布局）。
- 依赖：新增 `react-day-picker`（及其依赖链）并引入对应样式资源；需按 `docs/standards.md` / `docs/redlines.md` 补充新增依赖的用途与风险说明。
- 测试与回归：`src/app/selfTest.ts` 依赖 `.task-inline-popover` 和按钮文案（例如 `Someday`），需要保持兼容或更新自测。
- IPC/DB：不引入新的 IPC 通道；复用现有 `window.api.tag.create` / `window.api.task.update` / `window.api.task.setTags`。
