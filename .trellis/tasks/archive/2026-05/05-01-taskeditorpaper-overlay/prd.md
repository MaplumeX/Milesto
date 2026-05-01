# 删除 TaskEditorPaper overlay 死代码

## Goal

`TaskEditorPaper` 组件的 `variant` prop 支持 `'overlay'` 和 `'inline'` 两种模式，但全代码库中唯一调用方 `TaskInlineEditorRow` 始终传 `variant="inline"`。`'overlay'` 分支（约 330 行代码）以及配套 CSS 从未被执行，属于历史遗留死代码。本任务将其彻底删除以简化维护。

## Requirements

1. **删除 `TaskEditorPaper.tsx` 中的 overlay 逻辑**
   - 移除 `TaskEditorVariant` 类型和 `variant` prop
   - 移除 `variant` 相关的所有条件分支（`variant === 'inline'` / `variant !== 'inline'`）
   - 移除 overlay 分支的完整 JSX（header、detail-meta、detail-field、detail-grid、detail-actions 等）
   - 内联分支变为唯一代码路径，去除冗余条件
   - `Checklist` 子组件：移除 `variant` prop，删除 `variant === 'overlay'` 条件文本
   - 清理因此变为未使用的 import / state / effects

2. **删除调用方的 `variant` 传递**
   - `TaskInlineEditorRow.tsx` 中移除 `variant="inline"` prop

3. **删除配套 CSS**
   - `src/index.css` 中删除所有 `.overlay-paper*` 相关规则（含 `@keyframes overlay-paper-in`）

4. **更新测试**
   - `tests/unit/editor-paper-theme.test.ts` 删除对 `.overlay-paper` 的断言

## Acceptance Criteria

- [ ] `TaskEditorPaper` 不再接受 `variant` prop，组件行为与之前 `inline` 模式完全一致
- [ ] `npm run lint` 通过
- [ ] `npm run test` 通过（含 `editor-paper-theme.test.ts`）
- [ ] 全代码库中不再有 `'overlay'` 字符串（作为 TaskEditorPaper variant）
- [ ] 全代码库中不再有 `.overlay-paper` CSS 类

## Definition of Done

- Lint / typecheck / tests green
- 无功能变化（纯删除死代码）

## Out of Scope

- 修改 inline 编辑器的任何行为或样式
- 重命名 `TaskEditorPaper` 或 `TaskInlineEditorRow`
- 删除其他未使用的 CSS（非 overlay 相关）
