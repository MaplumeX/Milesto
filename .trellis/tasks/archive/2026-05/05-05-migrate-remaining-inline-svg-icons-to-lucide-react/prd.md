# PRD: Migrate Remaining Inline SVG Icons to Lucide

## Summary
将项目中所有剩余的内联 SVG 图标迁移到 lucide-react，与已完成的 bottom-bar-icons 迁移保持一致。消除自定义 SVG 代码，统一图标来源。

## Motivation
- 底部导航栏图标已完成 Lucide 迁移（见 bottom-bar-icons.tsx），其余 30+ 个内联 SVG 图标仍为手写
- 统一图标库减少维护成本，获得一致的视觉风格和尺寸控制
- Lucide 图标支持 `size`、`strokeWidth`、`className` 等 props，比内联 SVG 更灵活

## Scope

### 高优先级 — 独立图标文件（影响全局）
1. **sidebar-nav-icons.tsx** — 7 个侧边栏导航图标
   - inbox → `Inbox`
   - today → `Clock`
   - upcoming → `Calendar`
   - anytime → `Globe`
   - someday → `ArrowUpFromLine`
   - logbook → `BookOpen`
   - trash → `Trash2`

2. **popover-menu-icons.tsx** — 11 个弹出菜单图标
   - BackMenuIcon → `ChevronLeft`
   - CancelMenuIcon → `CircleX`
   - ConvertMenuIcon → `ArrowRightLeft`
   - DeleteMenuIcon → `Trash2`
   - DoneMenuIcon → `CircleCheck`
   - DueMenuIcon → `Clock`
   - MoveMenuIcon → `ArrowRightLeft`
   - OpenMenuIcon → `ExternalLink`
   - RenameMenuIcon → `Pencil`
   - RestoreMenuIcon → `RotateCcw`
   - ScheduleMenuIcon → `Calendar`
   - TagMenuIcon → `Tag`

3. **task-metadata-icons.tsx** — 8 个任务元数据图标
   - CalendarIcon → `Calendar`
   - ClockIcon → `Clock`
   - TagIcon → `Tag`
   - ChevronDownIcon → `ChevronDown`
   - SunIcon → `Sun`
   - TodayIcon → `CalendarCheck`
   - NoteIcon → `FileText`
   - CircleXIcon → `CircleX`

### 中优先级 — 组件内局部图标
4. **AppShell.tsx** — SidebarFolderIcon → `Folder`, SidebarChevronIcon → `ChevronDown`
5. **AreaPage.tsx** — AreaTitleIcon → `Folder`（与 AppShell 重复）
6. **ChatPanel.tsx** — ChatIcon → `MessageSquare`
7. **TagPicker.tsx** — search/check/plus 内联 SVG → `Search`/`Check`/`Plus`
8. **ProjectProgressControl.tsx** — CheckIcon → `Check`, XIcon → `X`（进度环 SVG 保持不变，为数据驱动）

### 低优先级 — 小型/嵌入式图标（谨慎处理）
9. **Checkbox.tsx** — check/x 标记（尺寸很小 12×10，替换需验证视觉效果）
10. **Select.tsx** — chevron/check（嵌入 Radix Select 组件，尺寸很小 10×6 / 10×8）
11. **ChatMessages.tsx** — Spinner（带旋转动画的 SVG，可用 Lucide `Loader2` + CSS `animation: spin` 替代）
12. **Unicode 字符** — `×`/`✎`/`⚠`/`✓` 等文本字符可替换为 Lucide 小图标

## Design Decisions
- 遵循 bottom-bar-icons.tsx 已有的模式：从 lucide-react 导入图标组件，通过 props 控制大小和样式
- 保留各图标文件的结构（sidebar-nav-icons.tsx / popover-menu-icons.tsx / task-metadata-icons.tsx），仅替换内部实现
- 删除 `PopoverMenuIcon` 包裹组件，直接使用 Lucide 组件
- 保留 `toneClassName` 等自定义逻辑不变
- strokeWidth 默认值：Lucide 默认 2，侧边栏之前用 1.8，菜单之前用 1.9 —— 统一使用 Lucide 默认值，如有视觉偏差再微调

## Out of Scope
- ProjectProgressControl 的进度环 SVG（数据驱动的动态路径，不是图标）
- CSS 渲染的停止图标（chat-composer-stop-icon）
