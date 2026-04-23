# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Milesto is an Electron desktop task-management application (similar to Things/OmniFocus) built with React 18, TypeScript, Vite, and better-sqlite3. It uses a custom IPC architecture with a dedicated DB Worker Thread for all SQLite operations.

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development (Vite dev server + Electron) |
| `npm run build` | Full production build: `tsc && vite build && electron-builder` |
| `npm run lint` | Run ESLint on `.ts` and `.tsx` files |
| `npm run test` | Run tests via Electron Node runtime (`ELECTRON_RUN_AS_NODE=1`) |
| `npm run test:watch` | Test watch mode |
| `npm run test:db` | Run DB-specific tests (separate Vitest config) |
| `npm run preview` | Vite preview server |

### Running a Single Test

Tests execute inside the Electron Node runtime, not standard Node:

```bash
# Single file
npx vitest run tests/renderer/Checkbox.test.tsx

# Single test (watch mode)
npx vitest tests/renderer/Checkbox.test.tsx

# With Electron runtime (matches CI)
npm run test -- tests/renderer/Checkbox.test.tsx
```

### Self-Test (End-to-End Smoke Tests)

The app has built-in self-tests that run inside the Electron renderer:

```bash
# Full self-test suite
MILESTO_SELF_TEST=1 npm run dev

# Specific suite (search|project|sidebar|trash)
MILESTO_SELF_TEST=1 MILESTO_SELF_TEST_SUITE=search npm run dev
```

Self-test mode uses an isolated `userData` directory under `.tmp/milesto-selftest/`. Tests report to stdout and exit with code 0/1.

## Architecture

### Three-Layer Communication Stack

```
Renderer (React)          Main Process (Node)         DB Worker Thread (Node)
     |                            |                              |
     |  window.api.xxx()          |                              |
     |  → contextBridge           |                              |
     |----------------------------→ ipcMain.handle()             |
     |                            |                              |
     |                            |  dbWorker.request(action)    |
     |                            |  → Worker.postMessage()      |
     |                            |----------------------------→|
     |                            |                              |  better-sqlite3
     |                            |                              |  (synchronous)
     |                            |←----------------------------|
     |←---------------------------|  Result<T> (ok | err)        |
```

1. **Renderer → Main**: `preload.ts` exposes `window.api` via `contextBridge`. Do NOT expose `ipcRenderer` directly.
2. **Main → DB Worker**: `DbWorkerClient` spawns a Node `Worker` thread. All DB operations run off the main thread.
3. **DB Worker → SQLite**: `better-sqlite3` runs synchronously inside the worker. The worker parses requests via zod (`DbWorkerRequestSchema`) and dispatches to action handlers.

### IPC and Data Flow Conventions

- **All API calls return `Result<T>`** (`shared/result.ts`). Always check `.ok` before accessing `.data`. Errors are typed as `AppError` with `code`, `message`, and `details`.
- **All IPC payloads and DB return values are validated with zod** in `electron/main.ts` (`handleDb` helper). Invalid payloads return `VALIDATION_FAILED`; invalid DB returns return `DB_INVALID_RETURN`.
- **IPC sender validation**: `ensureTrustedSender()` rejects IPC calls from unexpected origins (dev server URL or `file://` under `dist/`).
- **Schema source of truth**: `shared/schemas/` contains zod schemas and TypeScript types. Both renderer and main process import from here.

### Directory Structure

```
src/               React renderer process (pages, components, features, app shell)
electron/          Electron main process + preload + DB worker
  main.ts          Entry point: creates window, registers IPC handlers, starts DB worker
  preload.ts       Context bridge exposing window.api
  workers/db/      DB Worker Thread
    db-worker.ts      Worker entry: validates requests, dispatches to handlers
    db-worker-client.ts  Main-process client that talks to the worker
    db-dispatch.ts    Action router
    db-handlers.ts    Aggregates all action modules
    actions/          Domain-specific DB action modules (task, project, area, etc.)
  sync/            Cloud sync engine (WebSocket-based)
shared/            Code shared between renderer and main process
  window-api.ts    Complete TypeScript interface for window.api
  schemas/         Zod schemas + types for all entities
  result.ts        Result<T> monad (ok | err)
  i18n/            Shared i18n utilities
  db-worker-protocol.ts  Message protocol between main and DB worker
tests/
  renderer/        Component tests (React Testing Library + happy-dom)
  unit/            Pure logic tests
  setup/fast.ts    Test setup: mocks window.api and react-i18next
```

### Frontend Architecture

- **Router**: `HashRouter` (required for Electron `file://` protocol). Routes defined in `src/app/AppRouter.tsx`.
- **Pages**: `Today`, `Inbox`, `Upcoming`, `Anytime`, `Someday`, `Logbook`, `Trash`, `Search`, `Project/:id`, `Area/:id`.
- **State management**: No Redux/Zustand. Uses React Context for cross-cutting concerns:
  - `AppEventsContext` — global `revision` counter. Call `bumpRevision()` after mutations to trigger data refetching across views.
  - `TaskSelectionContext` — selected/open task state, editor registration.
  - `ContentScrollContext` — scroll container ref for focus management.
- **Optimistic updates**: Task titles use optimistic updates via `AppEventsContext` (`upsertOptimisticTaskTitle` / `ackOptimisticTaskTitle`) to avoid flicker during inline editing.
- **Drag and drop**: Sidebar area/project reordering uses `@dnd-kit/core`. Task lists use `@dnd-kit/sortable`.
- **Virtualization**: Long task lists use `@tanstack/react-virtual`.
- **i18n**: `react-i18next`. Supported locales defined in `shared/i18n/locale.ts`. In tests, `t()` returns the key string.

### Testing Architecture

- **Test runner**: Vitest executed inside Electron's Node runtime (`ELECTRON_RUN_AS_NODE=1`). This is required because some tests import Electron-native modules (e.g., better-sqlite3).
- **Fast tests** (`vitest.config.ts`): Use `happy-dom` environment. Cover `tests/unit/` and `tests/renderer/`.
- **DB tests** (`vitest.db.config.ts`): For tests that need the actual DB worker.
- **Renderer test setup** (`tests/setup/fast.ts`):
  - Mocks `react-i18next` (`t` returns the key).
  - Mocks `window.api` with a typed default mock (`createWindowApiMock()`). Individual tests override specific methods with `vi.fn()`.
- **Writing component tests**: Import from `@testing-library/react`. The test environment already provides `window.api` and i18n mocks.

### Build Configuration

- **Vite** (`vite.config.ts`): Uses `vite-plugin-electron/simple` with three entries:
  - `main`: `electron/main.ts`
  - `preload`: `electron/preload.ts`
  - `workers/db/db-worker`: `electron/workers/db/db-worker.ts`
- **Native module externalization**: `better-sqlite3` and `ws` are externalized in Rollup config. `ensure-electron-native-deps.mjs` ensures native modules are rebuilt for the target Electron ABI before dev/build.
- **CSP**: Installed at runtime via `session.defaultSession.webRequest.onHeadersReceived`. No `unsafe-eval`; `script-src` allows `'self' 'unsafe-inline'`.

### Security Model

- `contextIsolation: true`, `nodeIntegration: false`.
- Preload exposes only the business-level `WindowApi` — no raw `ipcRenderer`.
- IPC handlers validate sender origin (`ensureTrustedSender`).
- `better-sqlite3` is never accessible from the renderer; all DB access goes through the worker.
