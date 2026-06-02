# Component Guidelines

> How components are built in this project.

---

## Overview

The current renderer uses plain React function components plus global CSS class names from
`src/index.css`. Although `docs/ui.md` targets a future `shadcn/ui` direction, the codebase
today is still class-based and hand-composed. Document reality first and migrate deliberately.

---

## Component Structure

- Group imports in this order: React/runtime, third-party packages, shared types, local modules.
- Keep local prop types and small helpers near the top of the file.
- Prefer function components with explicit props over indirection-heavy factories.
- Return `null` early for closed overlays and conditional branches.
- Use portals for floating UI such as dialogs, popovers, and context menus.

### Recommended Shape

1. Imports
2. Local types / constants / helper functions
3. Component export
4. Small file-local helper components only when they are tightly coupled

---

## Props Conventions

- Shared primitives may extend native element props with `Omit<...>` and add project-specific props.
- Domain components usually take explicit business props instead of forwarding a large HTML prop bag.
- Prefer narrow callbacks such as `onToggleDone(taskId, done)` over passing mutable objects around.
- Use `type` aliases for local prop shapes unless inheritance is actually useful.

### Anti-patterns

- Do not expose generic `options` objects when the call site only needs 2-3 explicit props.
- Do not pass raw `window.api` handles down as props.
- Do not let leaf presentation components own unrelated data-fetching logic.

---

## Styling Patterns

- Styling is currently done with semantic global class names and `data-*` attributes.
- Small components may use tiny local helpers such as `joinClassNames` instead of a class utility dependency.
- Avoid inline styles unless they are genuinely dynamic and layout-specific.
- Use `data-*` hooks when styling depends on semantic state rather than boolean class explosion.
- For small circular progress indicators, prefer SVG geometry over CSS `conic-gradient` plus fractional
  pixel insets. SVG viewBox coordinates avoid platform-specific subpixel rasterization offsets on Windows,
  Linux, and macOS.
- Do not animate SVG pie sectors by transitioning the path `d` value in CSS. Drive the numeric progress ratio
  from React or another state owner, and recompute a full-radius sector path for each animation frame so the
  fill does not visually shrink during path interpolation.

### Hover-only borders and clear icons (no layout shift)

When a control reveals a border, padding, or `×` icon on hover, reserve the space
at rest so the surrounding row does not shift. Three reusable techniques in this codebase:

- **Pre-reserve border space**: declare `border: 1px solid transparent` (with
  matching padding) at rest, then only swap `border-color` on `:hover`. The
  layout box already accounts for the 1px border, so hovering does not push
  siblings around. See `.meta-date-badge` and `.task-inline-meta-trigger` in
  `src/index.css`.
- **Toggle `×` via `visibility`, not `display`**: hide a clear/remove button
  with `visibility: hidden` (it still occupies its slot) and switch to
  `visibility: visible` on the parent's `:hover`. `display: none` removes the
  element from layout and causes vertical jitter when the user moves between
  hover/no-hover states. See `.meta-date-badge-clear` and `.meta-tag-chip-clear`.
- **Anchor flex children that must not stretch**: in column flex containers,
  set `align-self: flex-start` on chips/badges narrower than the container so
  they are not stretched to full width on layout recalculation.

These three pieces have caused real regressions historically (commits
`17189ee` / `12fc4ca` / `c08d179` — meta-badge layout shift, hover jitter,
flex stretch). Reuse them whenever you add hover-only affordances to a flex row.

### Current Reality

- `src/index.css` is the shared stylesheet backbone.
- Class names are semantic (`nav-item`, `palette-item`, `content-bottom-action-button`) instead of utility-first.
- Icon wrappers typically set `aria-hidden="true"` and rely on the outer control for the accessible name.

### Icon System

The project uses `lucide-react` for UI icons. All 24x24 viewBox icons should use Lucide components rather than hand-authored inline SVGs.

**Library**: `lucide-react` (tree-shakeable named imports only — never `import *`)

**Global config**: `LucideProvider` in `App.tsx` sets `size="1em"` app-wide. Individual icons can override via the `size` prop.

```tsx
// App.tsx
import { LucideProvider } from 'lucide-react'

<LucideProvider size={"1em" as unknown as number}>
  <App />
</LucideProvider>
```

> **Gotcha**: `LucideConfig.size` is typed as `number` but accepts strings at runtime. Use `as unknown as number` when passing `"1em"`.

**Import pattern**:

```tsx
// Good — tree-shakeable named import
import { Inbox, Clock, Trash2 } from 'lucide-react'

// Bad — defeats tree-shaking
import * as icons from 'lucide-react'
```

**Usage patterns in this project**:

1. **Dictionary-based** (sidebar-nav-icons, bottom-bar-icons): Lucide components are stored as `ReactNode` in lookup objects, keyed by string. Accessor functions retrieve them by key.

2. **Named re-exports** (task-metadata-icons): Lucide icons wrapped in functions accepting `{ className?: string }` for API compatibility.

3. **Direct exports** (popover-menu-icons): Named functions returning Lucide components with specific `strokeWidth` props.

**strokeWidth conventions**:
- Sidebar / bottom bar icons: `strokeWidth={1.8}`
- Popover menu icons: `strokeWidth={1.9}`
- Task metadata icons: Lucide default (2), except `ChevronDownIcon` at `strokeWidth={2.2}`

**CSS class note**: Lucide auto-adds `lucide` and `lucide-<kebab-name>` classes to every `<svg>` element. If CSS selectors target SVGs by tag name only, these extra classes are harmless. If styling relies on specific class absence, verify after migration.

**Non-24x24 icons remain custom**: Checkbox (12x10), Select (10x10), TagPicker (16x16 / 12x12), and ProjectProgressControl (arc with strokeWidth=2.4) use viewboxes incompatible with Lucide and must stay as hand-authored inline SVGs.

**Icons without Lucide equivalents**: `ConvertMenuIcon` (two overlapping rectangles + arrow) has no Lucide match and remains a custom inline SVG with a local `PopoverMenuIcon` wrapper.

### Button Component

Use the shared `Button` primitive instead of handwriting `<button>` elements with `.button` / `.button-ghost` / `.button-danger` classes.

```tsx
import { Button } from '@/components/Button'

// Good
<Button variant="ghost" onClick={handleClose}>Close</Button>
<Button variant="danger" onClick={handleDelete}>Delete</Button>

// Bad — do not hand-compose button classes
<button className="button button-ghost" onClick={handleClose}>Close</button>
```

- `variant` maps to the existing CSS classes: `default` → `.button`, `ghost` → `.button-ghost`, `danger` → `.button-danger`.
- The component is a named export at `src/components/Button.tsx`.
- For icon-only or menu-item affordances that do not fit the standard button variants, keep using `BottomBarActionButton` or `PopoverMenuItem`.

---

## Accessibility

- Icon-only buttons must provide `aria-label`.
- When the same icon-only control renders multiple times in a list (e.g., a `×`
  clear button on each tag chip), the `aria-label` must include per-instance
  context — `"Remove tag {title}"`, not a generic `"Clear"`. Otherwise screen
  reader users cannot distinguish which instance they are about to activate.
  See `MetaTagChip` for the pattern.
- Decorative icons and SVG wrappers must be `aria-hidden`.
- Dialog-like overlays must set `role="dialog"` and `aria-modal="true"`.
- Focus must be managed explicitly for shell overlays such as search and settings.
- Escape and outside-click dismissal should not bypass focus restoration expectations.

### Common Mistakes

- Do not render icon-only affordances without an accessible name.
- Do not open a portal overlay without handling `Escape`.
- Do not let focus escape modal content when the UI behaves like a dialog.

---

## Examples

### Example: shared primitive extends native props carefully (`src/components/Checkbox.tsx`)

```tsx
type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children' | 'className' | 'style'> & {
  ariaLabel?: string
  children?: ReactNode
  onCheckedChange?: (checked: boolean, event: ChangeEvent<HTMLInputElement>) => void
}
```

### Example: icon-only action keeps the label on the button (`src/app/BottomBarActionButton.tsx`)

```tsx
<button
  {...props}
  type={type}
  className={`button button-ghost content-bottom-action-button${className ? ` ${className}` : ''}`}
  aria-label={label}
>
  <span className="content-bottom-action-icon" data-bottom-bar-icon={iconKey} aria-hidden="true">
    {iconDefinition.icon}
  </span>
</button>
```

### Example: dialog semantics and focus trapping are explicit (`src/features/settings/SettingsDialog.tsx`)

```tsx
<div
  ref={dialogRef}
  className="settings-dialog"
  role="dialog"
  aria-modal="true"
  aria-labelledby={titleId}
  tabIndex={-1}
>
```
