# 让备注支持 Markdown

## Goal

为 Milesto 应用中的备注（notes）功能添加 Markdown 渲染支持。当前备注字段已存在于 Task 和 Project 的 schema 中，且 i18n 中已有 "Markdown supported" 的 placeholder 文本，但尚未实现实际的 Markdown 渲染逻辑。

## What I already know

- Task 的 `notes` 字段通过 `TaskEditorPaper.tsx` 编辑：
  - **Inline 模式**：行内 `textarea`，placeholder 为 `task.notesPlaceholder`（"Add notes…"）
  - **Detail 模式**：详情面板 `textarea`，placeholder 已是 `taskEditor.markdownPlaceholder`（"Markdown supported (stored as plain text in v0.1)."）
- Project 的 `notes` 字段通过 `ProjectPage.tsx` 编辑，使用 textarea 组件
- Area 的 schema 中有 `notes` 字段，但 `AreaPage.tsx` 没有 notes 编辑 UI
- 当前没有安装任何 Markdown 渲染库
- notes 在数据库中以纯文本 `string` 存储

## Assumptions (temporary)

- 备注仍以纯文本形式存储在数据库中，渲染只在 UI 层进行
- 需要支持 Task notes 和 Project notes；Area notes 可后续考虑
- 这是一个中等复杂度的功能，涉及多个组件的修改和一个新依赖的引入

## Research References

- [`research/markdown-libraries.md`](research/markdown-libraries.md) — 推荐 `react-markdown`（React 原生、XSS 安全、TypeScript 完善）
- [`research/ui-patterns.md`](research/ui-patterns.md) — 评估 4 种 UI 模式，推荐 **Render-on-Blur**（聚焦编辑 / 失焦渲染）

## Decision (ADR-lite)

**Context**: 用户最初选择"实时渲染（类似 Notion）"。经调研，真正的 Notion 式 WYSIWYG 需要引入 ProseMirror/Slate 等重型编辑器框架（100-500KB+），与现有简单 textarea 的交互模型冲突，且显式超出当前任务范围。

**Decision**: 采用 **Render-on-Blur** 模式作为"实时渲染"的务实实现：
- 聚焦时：显示熟悉的 `<textarea>` 纯文本编辑
- 失焦后：自动切换为 `react-markdown` 渲染的格式化视图
- 点击渲染视图即可重新进入编辑模式

这种模式在 Things 3、Apple Notes 等产品中被广泛使用，对短备注 UX 最优，与现有代码改动最小。

**技术栈**: `react-markdown` + `remark-gfm`（可选）

**Consequences**: 
- 优点：实现简单、XSS 安全、与现有 UI 无缝融合
- 风险：用户可能期望真正的内联 WYSIWYG；如后续需要可再评估 tiptap/slate

## Open Questions

- ✅ Markdown 语法范围：**基础**（bold, italic, lists, links, code blocks）— 不安装 `remark-gfm`

## Requirements

- 集成 `react-markdown` 作为 Markdown 渲染库
- Task notes（inline + detail/overlay 两种变体）支持 Render-on-Blur 模式
- Project notes 支持 Render-on-Blur 模式
- 新增共享组件 `MarkdownNotes` 封装编辑/渲染切换逻辑
- 新增 `.markdown-body` CSS 样式，与现有设计 token 一致
- 现有纯文本备注完全向后兼容（无 Markdown 语法时显示不变）
- i18n：placeholder 和提示文本支持中英文

## Acceptance Criteria

- [ ] `react-markdown` 已安装并可用
- [ ] 新增 `MarkdownNotes` 共享组件，支持 focus → textarea / blur → rendered 切换
- [ ] Task inline notes 使用 `MarkdownNotes` 替换原 `<textarea>`
- [ ] Task detail/overlay notes 使用 `MarkdownNotes` 替换原 `<textarea>`
- [ ] Project notes 使用 `MarkdownNotes` 替换原 `<textarea>`
- [ ] `src/index.css` 新增 `.markdown-body` 样式（p, ul/ol, strong, em, code, pre, a, blockquote, hr）
- [ ] 纯文本备注无 Markdown 语法时显示与之前一致
- [ ] 渲染内容 XSS 安全（`react-markdown` 默认安全）
- [ ] 不破坏现有自动调整高度、焦点管理、防抖保存逻辑
- [ ] 新增/更新 renderer 测试覆盖 `MarkdownNotes` 组件
- [ ] Lint / typecheck 通过
- [ ] `npm run dev` 中手动验证 Task 和 Project 的 notes 渲染正常

## Definition of Done

- 测试覆盖新增组件/逻辑
- Lint / typecheck 通过
- 不破坏现有备注编辑体验

## Out of Scope (explicit)

- 更改数据库 schema 或存储格式
- 所见即所得（WYSIWYG）编辑器
- 自定义 Markdown 语法扩展
- Area notes（当前无 UI）
- 图片 / 附件嵌入
- 复杂表格编辑

## Implementation Plan

1. **安装依赖** — `react-markdown`（+ 可选 `remark-gfm`）
2. **新增组件** — `src/components/MarkdownNotes.tsx`（封装编辑/渲染切换）
3. **新增样式** — `src/index.css` 添加 `.markdown-body`
4. **替换 Task notes** — `TaskEditorPaper.tsx` inline + overlay 两处 textarea
5. **替换 Project notes** — `ProjectPage.tsx` textarea
6. **测试** — 新增 `MarkdownNotes` 组件测试
7. **验证** — `npm run lint` + 手动 dev 验证

## Technical Notes

- 关键文件：
  - `src/features/tasks/TaskEditorPaper.tsx` — Task notes 编辑（inline + detail）
  - `src/pages/ProjectPage.tsx` — Project notes 编辑
  - `shared/i18n/messages.ts` — i18n 消息
  - `package.json` — 需要新增依赖
- 约束：Electron + React 18 + Vite 环境；渲染进程通过 contextBridge 与主进程通信
