# 优化按钮设计

## Goal

将 Milesto 应用中的手写 `<button>` 元素统一替换为组件化的 `<Button>`，提升代码一致性、可维护性和开发体验。

## What I already know

- 当前没有统一的 Button 组件，所有按钮都是原生 `<button>` 手动拼接 class
- 仅存在 3 个 CSS class：`.button`、`.button-ghost`、`.button-danger`
- Ghost 按钮占绝对主导（~49 处），`.button` 用于主行动（~7 处），`.button-danger` 仅 1 处条件使用
- 无尺寸变体、无加载状态、无 IconButton 抽象
- 样式全部写在 `src/index.css`（~3300 行）单文件中，无 CSS Modules / styled-components / Tailwind
- 使用 CSS 自定义属性（design tokens）做主题切换，light/dark 通过 `prefers-color-scheme` 切换
- 已有 `BottomBarActionButton`（图标按钮）和 `PopoverMenuItem`（菜单项）两个专用组件

## Assumptions (temporary)

- 用户希望提升按钮系统的一致性（而非仅改一两个页面）
- 可能希望引入组件化抽象来替代手写 `<button>`
- 可能关注视觉层级（primary / secondary / ghost / danger 的区分）

## Open Questions

- [x] 方向：组件化重构（已确认）
- [x] 替换范围：所有使用 `.button` / `.button-ghost` / `.button-danger` class 的按钮（约 57 处）
- [x] 专用组件（BottomBarActionButton、PopoverMenuItem）不纳入统一
- [x] variant 体系：`default` / `ghost` / `danger`（保守映射，无新增变体）
- [x] 视觉保持现有样式，不做变更

## Requirements

1. 在 `src/components/` 下创建 `Button.tsx`，导出一个统一的 `<Button>` 组件
2. `<Button>` API：
   - `variant?: 'default' | 'ghost' | 'danger'` — 对应现有 `.button` / `.button-ghost` / `.button-danger`
   - 透传标准 `React.ButtonHTMLAttributes<HTMLButtonElement>`（`onClick`、`disabled`、`type`、`className` 等）
   - `className` 支持外部覆盖和合并
3. 全量替换：将所有手写 `<button className="button ...">` 替换为 `<Button variant="...">`
4. 保持现有 CSS class 和样式不变（`index.css` 中的 `.button`、`.button-ghost`、`.button-danger` 继续保留，由 `<Button>` 内部引用）
5. 不修改 `BottomBarActionButton`、`PopoverMenuItem` 等特殊按钮组件

## Acceptance Criteria

- [ ] `src/components/Button.tsx` 组件存在且 API 符合上述要求
- [ ] 全站所有使用 `.button` / `.button-ghost` / `.button-danger` 的手写 `<button>` 已替换为 `<Button>`
- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过（TypeScript 编译无错误）
- [ ] 视觉无回归：各变体的默认态、hover 态、disabled 态与替换前一致

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes

## Out of Scope

- 新增 variant（如 primary、secondary、outline 等）
- 新增 size 变体
- 新增 loading 状态
- 修改现有 CSS 样式或设计 token
- 重构 `BottomBarActionButton`、`PopoverMenuItem` 等特殊按钮组件
- 替换未使用 `.button` / `.button-ghost` / `.button-danger` 的其他 `<button>` 元素（如 `nav-item-button`、`search-scope-pill` 等）

## Technical Approach

- 组件封装：`Button.tsx` 内部根据 `variant` 拼接 `className`，如 `className={clsx('button', variant === 'ghost' && 'button-ghost', variant === 'danger' && 'button-danger', className)}`
- 使用 `clsx`（项目已有依赖）合并 className
- 默认 `type="button"`（与现有代码一致）
- 保持 CSS 不变，只做 JSX 层面的替换

## Technical Notes

- `src/index.css:1646` — `.button` 定义
- `src/index.css:1664` — `.button-ghost` 定义
- `src/index.css:3293` — `.button-danger` 定义
- `src/app/BottomBarActionButton.tsx` — 不改动
- `src/components/PopoverMenuItem.tsx` — 不改动
- 约 57 处需要替换的手写按钮（grep `className.*button`）

## Implementation Plan

1. **创建 `<Button>` 组件** — `src/components/Button.tsx`
2. **批量替换** — 逐文件替换手写 `<button>` 为 `<Button>`
3. **验证** — lint + type-check + 人工检查关键页面
