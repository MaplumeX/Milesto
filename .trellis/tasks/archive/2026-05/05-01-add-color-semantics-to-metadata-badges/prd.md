# 给元数据加颜色语义

## Goal

为三个表面的元数据显示增加颜色语义，使 schedule、due、tags 等不同类型的元数据在视觉上可区分，提升信息识别效率。

## What I already know

- **ProjectPage** (`ProjectMetaRow`): schedule icon 已用 `var(--ppc-color)`，due icon 已用 `#C76A1E` / `var(--danger-text)`，但 tag chips 文字是 `var(--muted)` 无颜色
- **TaskRow** 右侧元数据簇: 全部用 `var(--muted)` 灰色，无颜色区分。这是最需要改进的地方
- **MetaDateBadge** (TaskEditor): icon 有颜色但文字始终 `var(--text)`，icon 和文字颜色不一致
- **MetaTagChip** (TaskEditor): 文字 `var(--text)`、背景 `var(--wash)`，未使用标签的 `color` 字段
- 标签 schema 有 `color: z.string().nullable()`，TagFilter 已在使用标签颜色
- TaskListItem 的 `tag_preview` 仅返回标题字符串，无颜色数据

## Requirements

1. **TaskRow 元数据颜色**
   - Schedule: icon + value 使用 `var(--ppc-color)`
   - Due: icon + value 使用 `#C76A1E`；逾期/urgent 使用 `var(--danger-text)`
   - Tags: 本次不改（TaskListItem 缺少标签颜色数据，需 DB 层改动，超出范围）

2. **MetaDateBadge 文字颜色**
   - 文字颜色跟随 icon 颜色，保持一致性
   - 通过 CSS 实现：`color` 继承自 icon 的 `style.color`，或调整结构让文字和 icon 同色

3. **MetaTagChip 标签颜色**
   - 新增可选 `color` prop
   - 有颜色时：border 和背景使用该颜色的低透明度变体，文字使用颜色本身
   - 无颜色时：保持现有默认样式
   - TaskEditorPaper 中传入标签的 `color`

4. **ProjectPage tag chips（可选）**
   - ProjectPage 的 tag chips 使用标签颜色（需要 Project query 返回 tag color，可能涉及 DB 改动）

## Acceptance Criteria

- [ ] TaskRow 中 schedule 显示为蓝色 (`var(--ppc-color)`)
- [ ] TaskRow 中 due 显示为橙色 (`#C76A1E`)，逾期显示为红色 (`var(--danger-text)`)
- [ ] MetaDateBadge 中文字与 icon 颜色一致
- [ ] MetaTagChip 在 TaskEditor 中显示对应标签颜色
- [ ] 所有改动在亮色/暗色主题下均正常
- [ ] 不破坏现有测试

## Definition of Done

- Lint / typecheck / CI green
- 相关组件的视觉行为已手动验证

## Out of Scope

- TaskRow 的 tag pills 颜色（TaskListItem schema 缺少 tag color 数据）
- ProjectPage tag chips 颜色（需确认 project tags 查询是否返回 color）
- 新增 CSS 变量或主题 token
- 标签颜色选择器/编辑器

## Technical Notes

- **TaskRow** (`src/features/tasks/TaskRow.tsx`): 右侧 `task-row-metadata` 区域，需给 `task-row-meta-item` 增加 `data-task-row-meta-kind` 对应的 CSS 颜色规则
- **MetaDateBadge** (`src/features/tasks/MetaDateBadge.tsx`): 当前 `meta-date-badge-text` 颜色是 `var(--text)`，需改为继承/跟随 icon 颜色。方案：给 `meta-date-badge` 整体加 `color: iconColor`，然后文字继承
- **MetaTagChip** (`src/features/tasks/MetaTagChip.tsx`): 新增 `color?: string | null` prop，通过 `style` 或 CSS 类应用颜色
- **TaskEditorPaper** (`src/features/tasks/TaskEditorPaper.tsx`): 传 `tag.color` 给 `MetaTagChip`
- 逾期判断：需要确认是否有现成的 due date 逾期判断逻辑（如 `isDueUrgent` helper）
