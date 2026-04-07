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

### Current Reality

- `src/index.css` is the shared stylesheet backbone.
- Class names are semantic (`nav-item`, `palette-item`, `content-bottom-action-button`) instead of utility-first.
- Icon wrappers typically set `aria-hidden="true"` and rely on the outer control for the accessible name.

---

## Accessibility

- Icon-only buttons must provide `aria-label`.
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
