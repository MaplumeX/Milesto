# Directory Structure

> How frontend code is organized in this project.

---

## Overview

The renderer is organized around an app shell, route pages, and domain features.
Keep route wiring in `src/app/`, route entry points in `src/pages/`, reusable domain UI in
`src/features/*`, and renderer-wide primitives in `src/components/`.

Cross-process contracts do not live in the renderer tree. Shared schemas, result types,
and the typed preload API stay in `shared/`.

---

## Directory Layout

```text
src/
├── App.tsx
├── main.tsx
├── app/          # Shell, router, bottom bar, search, app-wide UI contexts
├── assets/       # Static assets imported by the renderer
├── components/   # Small shared primitives
├── features/     # Domain modules (tasks, settings, projects, logbook, trash)
├── i18n/         # Renderer i18n bootstrap
├── lib/          # Renderer-only utilities and hooks
└── pages/        # Route entry points

shared/
├── app-error.ts
├── result.ts
├── window-api.ts
└── schemas/      # Cross-layer contracts shared by renderer/preload/main/worker
```

---

## Module Organization

- `src/app/`
  - Owns global layout, route shell, shell-level contexts, and top-level affordances.
  - Good examples: `AppShell.tsx`, `AppRouter.tsx`, `SearchPanel.tsx`.
- `src/pages/`
  - Route entry points stay thin.
  - A page usually fetches data through `window.api`, holds route-local state, and composes feature components.
- `src/features/<domain>/`
  - Holds reusable domain components, hooks, and local helpers for one business area.
  - `src/features/tasks/` is the clearest example: list, row, editor, DnD helpers, and context menus live together.
- `src/components/`
  - Only for renderer-wide primitives that are reused across domains.
  - Current example: `src/components/Checkbox.tsx`.
- `src/lib/`
  - Renderer-only helpers that are not tied to one feature.
  - Examples: date formatting, scope parsing, `useLocalToday`.
- `shared/`
  - Source of truth for boundary types and schemas.
  - Do not duplicate these contracts inside `src/`.

### Placement Rules

- Put new route pages in `src/pages/`, not in `src/features/`.
- Put domain UI next to the domain that owns it, even if the code is shared by multiple pages.
- Put shell-only concerns in `src/app/`, not in `src/features/`.
- Put cross-process schemas and API surface in `shared/`, not in renderer feature folders.

---

## Naming Conventions

- Directories use `kebab-case`.
- React component files use `PascalCase.tsx`.
- Non-component modules use `kebab-case.ts`.
- Hook files use `kebab-case` and start with `use-`.
- Shared schemas follow `<entity>.ts` plus explicit exports such as `TaskSchema` and `TaskCreateInputSchema`.

### Anti-patterns

- Do not import Electron modules directly into renderer files.
- Do not move one-off route logic into `src/app/` unless it truly affects the whole shell.
- Do not store renderer-only helper types in `shared/`; `shared/` is for contracts that cross process boundaries.

---

## Examples

### Example: root composition stays at the app boundary (`src/App.tsx`)

```tsx
<I18nextProvider i18n={i18n}>
  <HashRouter>
    <AppEventsProvider>
      <AppRouter />
    </AppEventsProvider>
  </HashRouter>
</I18nextProvider>
```

### Example: routes point to pages, not feature internals (`src/app/AppRouter.tsx`)

```tsx
<Route element={<AppShell />}>
  <Route path="/inbox" element={<InboxPage />} />
  <Route path="/today" element={<TodayPage />} />
  <Route path="/projects/:projectId" element={<ProjectPage />} />
</Route>
```

### Example: pages compose features and fetch through `window.api` (`src/pages/InboxPage.tsx`)

```tsx
const refresh = useCallback(async () => {
  const res = await window.api.task.listInbox()
  if (!res.ok) {
    setError(res.error)
    return
  }
  setTasks(res.data)
}, [])
```
