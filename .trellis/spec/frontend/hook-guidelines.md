# Hook Guidelines

> How hooks are used in this project.

---

## Overview

Hooks in this codebase are small and purpose-built. There is no shared “data hook layer” yet.
Most hooks are either:

- renderer utilities in `src/lib/`
- feature controllers that manage one overlay or interaction
- context access helpers colocated with their provider

---

## Custom Hook Patterns

- Put environment/date/navigation-neutral hooks in `src/lib/`.
- Put feature-specific controller hooks inside the feature directory.
- If a hook depends on a provider, colocate the hook and provider in the same file or module pair.
- Feature hooks may return both imperative actions and rendered portal nodes when that matches the interaction model.

### Preferred Responsibilities

- One hook should own one interaction cluster.
- Timers, DOM listeners, and async cleanup belong inside the hook that created them.
- Hooks that expose context must throw a clear error when used outside the provider.

---

## Data Fetching

- The renderer does not currently use `react-query`, SWR, or Zustand.
- Data fetching usually stays in pages or feature components and goes through `window.api`.
- Use `useCallback` for refresh functions that are reused by effects and event handlers.
- When an effect performs async work, guard it with cleanup flags or clear pending timers.
- Use narrow optimistic updates only where the UX really needs them.

### Anti-patterns

- Do not add generic fetch hooks only to wrap a single `window.api` call.
- Do not leave event listeners or timers active after the hook unmounts.
- Do not hide provider requirements; fail fast with a descriptive error.

---

## Naming Conventions

- Files use `kebab-case` with a `use-` prefix: `use-local-today.ts`, `use-task-context-menu.tsx`.
- Exports use `useXxx` camelCase names.
- Context providers typically export both `Provider` and `useXxx` from the same module.

### Scope Rule

- If the hook can be reused outside one domain, put it in `src/lib/`.
- If it reaches into feature-only types or UI, keep it inside that feature.

---

## Common Mistakes

- Missing provider guards for context hooks.
- Effect cleanup that forgets to clear timers or remove listeners.
- Premature abstraction of page-local async logic into a hook before a second call site exists.

---

## Examples

### Example: time-based hook owns timer setup and cleanup (`src/lib/use-local-today.ts`)

```tsx
useEffect(() => {
  let timeoutId: number | null = null
  let isDisposed = false

  const arm = () => {
    const delayMs = msUntilNextLocalMidnight(new Date()) + 250
    timeoutId = window.setTimeout(() => {
      if (isDisposed) return
      setToday(getLocalToday())
      arm()
    }, delayMs)
  }

  arm()
  return () => {
    isDisposed = true
    if (timeoutId !== null) window.clearTimeout(timeoutId)
  }
}, [])
```

### Example: feature hook manages async UI and cleanup (`src/features/tasks/use-task-context-menu.tsx`)

```tsx
useEffect(() => {
  if (!menuState || menuState.view !== 'tags') return

  let cancelled = false
  void (async () => {
    const [detailRes, tagsRes] = await Promise.all([
      window.api.task.getDetail(menuState.task.id, menuState.scope),
      window.api.tag.list(),
    ])
    if (cancelled) return
    // ...
  })()

  return () => {
    cancelled = true
  }
}, [menuState])
```

### Example: context hooks fail fast outside their provider (`src/app/ContentScrollContext.tsx`)

```tsx
export function useContentScrollElement(): HTMLDivElement | null {
  const ref = useContext(ContentScrollContext)
  if (!ref) throw new Error('useContentScrollElement must be used within ContentScrollProvider')
  return ref.current
}
```
