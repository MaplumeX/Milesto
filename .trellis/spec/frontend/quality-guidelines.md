# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

Frontend quality in Milesto is not just “does it render”.
Every change should preserve four things:

1. renderer/main/preload boundaries
2. accessibility for keyboard-first flows
3. list/search performance
4. strict typing plus real tests

---

## Forbidden Patterns

- Importing `ipcRenderer`, Electron modules, or database code directly into `src/`
- Rendering long task lists without virtualization
- Showing raw backend/internal details to the user instead of `code` and `message`
- Shipping icon-only controls without an accessible name
- Weakening types with `any` or blind assertions just to satisfy the compiler

---

## Required Patterns

- Use `window.api.*` for all privileged or persisted actions.
- Keep visible error UI to `AppError.code` and `AppError.message`.
- Use dialog semantics and explicit keyboard handling for overlays.
- Preserve the single main content scroller so virtualized lists can reuse it.
- Keep imports and naming aligned with `docs/standards.md`.
- Run lint and typecheck before finishing a frontend task.

---

## Testing Requirements

- Add renderer tests for interactive UI behavior, keyboard handling, dialog behavior, and accessible names.
- Add shared/unit tests for schema invariants and helper modules.
- Mock `window.api` with the `WindowApi` type instead of inventing loose mock objects.
- Wrap shell/page tests with the same providers and router context the app uses in production.

---

## Code Review Checklist

- Boundary: does renderer code stay behind `window.api`?
- Accessibility: are `aria-label`, dialog roles, focus handling, and keyboard flows correct?
- Performance: does list/search work respect virtualization and avoid heavy render-time work?
- State ownership: is state local by default and promoted only when justified?
- Types: are shared contracts imported from `shared/` instead of redefined?
- Tests: is the change covered at the right layer?

---

## Examples

### Example: long task lists are virtualized (`src/features/tasks/TaskList.tsx`)

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

const contentScrollRef = useContentScrollRef()
const [scrollMargin, setScrollMargin] = useState(0)
```

### Example: visible error UI stays on `code` and `message` (`src/pages/InboxPage.tsx`)

```tsx
function ErrorBanner({ error }: { error: AppError }) {
  return (
    <div className="error">
      <div className="error-code">{error.code}</div>
      <div>{error.message}</div>
    </div>
  )
}
```

### Example: renderer tests assert accessibility and routing behavior (`tests/renderer/app-shell-bottom-bar.test.tsx`)

```tsx
function expectIconOnlyButton(name: string) {
  const button = screen.getByRole('button', { name })
  expect(button.textContent).toBe('')
  expect(button.querySelector('svg')).not.toBeNull()
}
```
