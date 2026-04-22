# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Milesto is an open-source, local-first desktop task manager inspired by Things 3, built with Electron + React + TypeScript. All data is stored in a local SQLite database. The app supports full GTD workflows: Inbox, Today, Upcoming, Anytime, Someday, Projects (with Sections), Areas, Tags, Checklists, Logbook, Trash, and full-text search.

## Common Commands

```bash
# Install dependencies
npm ci

# Development (auto-rebuilds better-sqlite3 native module on first run)
npm run dev

# Full build (typecheck + bundle + package)
npm run build

# Lint (zero warnings policy)
npm run lint

# Run tests
npm run test           # Unit + renderer component tests (happy-dom, no Electron UI)
npm run test:db        # DB Worker action tests (requires Electron runtime)
npm run test:watch     # Watch mode for fast tests
npm run test:db:watch  # Watch mode for DB tests

# Run single test file
npx vitest run tests/unit/path/to/test.test.ts -c vitest.config.ts
```

## Architecture

### Four-Layer Electron Stack (Hard Isolation)

```
Renderer (React)          — Only calls window.api.*
    ↓
Preload (contextBridge)   — Exposes business-level APIs only
    ↓
Main Process              — Window lifecycle, IPC gateway, Zod validation
    ↓
DB Worker (worker_threads) — Sole SQLite access, serialized requests
```

**Critical constraints:**
- `contextIsolation: true`, `nodeIntegration: false`
- No raw `ipcRenderer` or arbitrary SQL exposed to the renderer
- All IPC payloads are validated with Zod schemas at the main process boundary
- All DB writes are transactional

### IPC & API Contract

- The preload script (`electron/preload.ts`) maps `window.api.*` methods to IPC channels
- The main process (`electron/main.ts`) registers handlers that validate payloads and forward DB requests to the worker
- DB handlers (`electron/workers/db/actions/`) receive parsed payloads and return raw data
- All IPC calls return a `Result<T>`: `{ ok: true, data: T } | { ok: false, error: AppError }`
- Always check `res.ok` before accessing `res.data`

### Data Refresh Pattern

Cross-view mutations use a revision counter instead of a global state manager:

- `AppEventsContext` provides `revision: number` and `bumpRevision(): void`
- Pages listen to `revision` changes in `useEffect` and re-fetch data
- The sidebar refreshes on every revision bump to stay synchronized

### DB Worker

- Entry: `electron/workers/db/db-worker.ts`
- Client: `electron/workers/db/db-worker-client.ts` (promisified `postMessage` with 30s timeout)
- Dispatch: `electron/workers/db/db-dispatch.ts` (routes action names to handlers)
- Handlers: `electron/workers/db/actions/*.ts` (task, project, area, tag, checklist, sidebar, trash, sync, settings, data-transfer)
- Database: SQLite via `better-sqlite3`, WAL mode, foreign keys enabled
- Migrations: inline in `db-bootstrap.ts`, driven by `user_version` pragma (currently v7)

### Project Structure

```
electron/
  main.ts                 # Main process: IPC gateway, sync service, theme, locale
  preload.ts              # contextBridge — sole Renderer ↔ Main API surface
  workers/db/
    db-worker.ts          # Worker thread entry
    db-worker-client.ts   # Promise-based worker communication
    db-dispatch.ts        # Action router
    db-handlers.ts        # Aggregates all action modules
    db-bootstrap.ts       # DB init + migrations
    actions/              # Business logic per domain
  sync/                   # S3-based sync (HLC/CRDT), credentials store
  theme/                  # Window background color per theme

src/
  App.tsx                 # Root: providers + router
  app/
    AppRouter.tsx         # react-router-dom routes
    AppShell.tsx          # Sidebar (dnd-kit areas/projects) + content layout
    AppEventsContext.tsx  # Revision counter + optimistic task titles
    TaskSelectionContext.tsx  # Selected/open task state, editor handle registry
    ContentScrollContext.tsx  # Content scroll ref sharing
  pages/                  # Route pages (Today, Inbox, Upcoming, Project, Area, ...)
  features/               # Domain features
    tasks/                # TaskList, TaskRow, TaskEditorPaper, inline editing, DnD
    projects/             # ProjectPage, sections, progress controls
    tags/                 # Tag picker, tag management
    settings/             # Settings dialog (general, sync, data)
    sync/                 # Sync UI
    logbook/              # Completed tasks view
    trash/                # Deleted items view
  components/             # Shared UI (minimal — mostly feature-local)
  lib/                    # Utilities (dates, entity-scope, local today hook)
  i18n/                   # i18next config + translation keys
  types/                  # Additional TypeScript types

shared/
  window-api.ts           # window.api TypeScript contract (source of truth)
  schemas/                # Zod schemas — sole source of truth for data models
  result.ts               # Result<T>, ok(), err()
  app-error.ts            # Structured AppError type
  db-worker-protocol.ts   # Worker message schemas
  task-list-ids.ts        # Constants for list position scopes
  i18n/                   # Locale, translation helpers (shared between main/renderer)

tests/
  unit/                   # Pure logic tests (no DOM)
  renderer/               # Component tests (happy-dom)
  db/                     # DB action tests (Electron runtime)
  setup/                  # Test setup files
```

### Routing

Routes are defined in `src/app/AppRouter.tsx`:
- `/inbox`, `/today`, `/upcoming`, `/anytime`, `/someday`
- `/logbook`, `/trash`
- `/search`
- `/projects/:projectId`, `/areas/:areaId`

Project pages support a `?scope=trash` query param for viewing deleted tasks.

### Key Frontend Patterns

- **Task lists**: Virtualized with `@tanstack/react-virtual` inside `TaskList.tsx`
- **Drag & drop**: `@dnd-kit` for task reordering in lists and area/project reordering in sidebar
- **Animations**: `framer-motion` for UI transitions; reduced motion is respected (`usePrefersReducedMotion`)
- **Optimistic titles**: Inline title edits are optimistically rendered via `AppEventsContext` and acked when the server response arrives
- **Task editor**: Opens as an overlay (not a route). `TaskSelectionContext` manages selection vs. open state. `OpenEditorHandle` allows the shell to flush pending changes before switching tasks.
- **Styling**: Tailwind CSS + shadcn/ui primitives. CSS custom properties for theme tokens (light/dark).
- **i18n**: `i18next` + `react-i18next`. Translation keys are referenced via `t('key')`. Shared locale helpers in `shared/i18n/`.

### Schemas

`shared/schemas/*.ts` contain Zod schemas that are the single source of truth for all data shapes. Both the renderer and main process import types from these schemas. When adding a new field or entity, update the schema first, then the DB action, then the preload API, then the UI.

### Testing

- Fast tests use `happy-dom` environment; DB tests need the Electron runtime (`ELECTRON_RUN_AS_NODE=1`)
- Self-test mode: set `MILESTO_SELF_TEST=1` to run in-memory tests with isolated user data
- The project has a zero-warnings ESLint policy

### Build & Native Dependencies

- `better-sqlite3` is a native module that must match the Electron runtime ABI
- `scripts/ensure-electron-native-deps.mjs` probes and rebuilds automatically during `predev` / `prebuild`
- Vite config externalizes `better-sqlite3` for the main process bundle
- Output packages: DMG (macOS), NSIS (Windows), AppImage (Linux) in `release/<version>/`

### TypeScript Configuration

- Strict mode enabled, `noUnusedLocals: true`, `noUnusedParameters: true`
- `moduleResolution: bundler`, `allowImportingTsExtensions: true`
- 2-space indentation, single quotes
- Includes: `src`, `electron`, `shared`
