# State Management

> How state is managed in this project.

---

## Overview

Current reality:

- No Zustand store yet
- No React Query cache yet
- Most state lives in the page or feature component that owns the interaction
- Cross-page coordination uses a small number of React contexts
- Persisted application state is loaded through `window.api` and then stored locally

---

## State Categories

### Local UI State

- Default choice for form drafts, open/close state, hover/highlight, drag state, and inline editing.
- Examples: `SearchPanel.tsx`, `ProjectPage.tsx`, `TaskList.tsx`.

### App-Wide Ephemeral Coordination

- Use React context only when multiple distant branches need the same transient state.
- Current contexts:
  - `AppEventsContext` for revision bumps and optimistic task titles
  - `TaskSelectionContext` for task selection/open editor coordination
  - `ContentScrollContext` for the shared scroll host

### Persisted State

- Settings and DB-backed state are not stored in a client cache library.
- Load them via `window.api`, then update local state and refresh after mutations.

### Route State

- Routing uses `HashRouter`.
- Route params and query strings are part of state ownership when they change what data is shown.

---

## When to Use Global State

Promote state to context only if all of these are true:

- More than one distant subtree needs it
- Passing it through props would make ownership less clear
- The state is still UI coordination, not a backend cache

Keep it local when:

- Only one page or one feature uses it
- The value is a short-lived draft
- Reloading from the source of truth is simpler than building a client cache layer

### Anti-patterns

- Do not add a global store to avoid passing one or two props.
- Do not mix persisted DB entities and ephemeral UI selection into the same object.
- Do not keep stale copies of backend data after mutations; refresh or rebump the owning page.

---

## Server State

- Treat DB and settings data as external state accessed through `window.api`.
- Fetch imperatively in pages and feature controllers.
- Refresh after successful mutations instead of inventing a client-side normalization layer.
- Use narrow optimistic updates only where latency is visible and rollback is simple.

---

## Common Mistakes

- Creating a new shared store for state that only one route owns.
- Forgetting to refresh after mutations, leaving the UI with stale lists.
- Using context for static helpers that should just be imported.

---

## Examples

### Example: route pages own refresh loops (`src/pages/InboxPage.tsx`)

```tsx
const refresh = useCallback(async () => {
  const res = await window.api.task.listInbox()
  if (!res.ok) {
    setError(res.error)
    return
  }
  setTasks(res.data)
}, [])

useEffect(() => {
  void revision
  void refresh()
}, [refresh, revision])
```

### Example: app-wide coordination stays small and explicit (`src/app/AppEventsContext.tsx`)

```tsx
const [revision, setRevision] = useState(0)
const bumpRevision = useCallback(() => setRevision((v) => v + 1), [])

const [optimisticTaskTitleById, setOptimisticTaskTitleById] = useState<Record<string, OptimisticTaskTitle>>({})
```

### Example: derived local state is recomputed with `useMemo` (`src/features/tasks/TaskList.tsx`)

```tsx
const orderedTasks = useMemo(() => {
  if (orderedTaskIds.length === 0) return tasksWithOptimisticTitles
  const byId = new Map<string, TaskListItem>()
  for (const t of tasksWithOptimisticTitles) byId.set(t.id, t)
  // ...
}, [orderedTaskIds, tasksWithOptimisticTitles])
```
