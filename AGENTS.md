# Milesto — Agent Guide

Milesto is an open-source, local-first desktop task manager inspired by Things 3. It is a cross-platform Electron app for personal GTD-style task management. All data stays in a local SQLite database — no account or cloud service is required.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 30 |
| UI | React 18 + TypeScript 5 |
| Bundler | Vite 5 + `vite-plugin-electron` |
| Database | SQLite via `better-sqlite3` (runs inside `worker_threads`) |
| Styling | Hand-written CSS with semantic CSS custom properties (no Tailwind config file in repo) |
| Animation | Framer Motion |
| Drag & Drop | `@dnd-kit` |
| Virtual Scrolling | `@tanstack/react-virtual` |
| Validation | Zod |
| i18n | i18next (English + Simplified Chinese) |
| Testing | Vitest + `@testing-library/react` + happy-dom |

## Project Structure

```
electron/
  main.ts                 # Main process entry (window lifecycle, IPC gateway, sync, CSP)
  preload.ts              # Preload script — exposes business-level `window.api` only
  workers/db/
    db-worker.ts          # DB Worker entry (worker_threads)
    db-bootstrap.ts       # SQLite DB initialization & migrations
    db-dispatch.ts        # Route DB worker requests to action handlers
    db-handlers.ts        # Registry of all DB action handlers
    db-worker-client.ts   # Main-process client to send requests to the DB worker
    actions/              # Business logic (task, project, area, tag, checklist, trash, settings, sidebar, sync, data-transfer)
  sync/                   # S3-based sync service (main-process side)
  theme/                  # Window background color helpers

src/
  main.tsx                # Renderer bootstrap (i18n init, self-test registration)
  App.tsx                 # Root component (HashRouter + i18n)
  app/
    AppRouter.tsx         # Route definitions
    AppShell.tsx          # Sidebar + content layout
    AppEventsContext.tsx  # Global mutation event bus for cache invalidation
    selfTest.ts           # In-app self-test entrypoint
  pages/                  # Route pages (Today, Inbox, Upcoming, Anytime, Someday, Logbook, Trash, Search, Project, Area, Settings)
  features/               # Domain features
    tasks/                # Task lists, rows, editors, DnD, tag filters
    projects/             # Project progress controls
    settings/             # Settings dialog panels
    tags/                 # Tag picker
    logbook/              # Logbook grouping & labels
    trash/                # Trash list
  components/             # Shared UI components (very small — mostly custom CSS)
  lib/                    # Shared renderer utilities (dates, entity-scope, local-today)
  i18n/                   # i18next configuration & initialization
  index.css               # Global styles + semantic design tokens (light/dark via prefers-color-scheme)

shared/
  window-api.ts           # TypeScript contract for `window.api`
  schemas/                # Zod schemas — source of truth for all data models & IPC payloads
  result.ts               # `Result<T>` type (`Ok<T>` | `Err`) + helper functions
  app-error.ts            # Structured `AppError` type with Zod schema
  db-worker-protocol.ts   # Message protocol between Main and DB Worker
  task-list-ids.ts        # Well-known list ID constants
  i18n/                   # Locale definitions, message catalogs, translation helpers

tests/
  unit/                   # Fast pure-logic tests (no DOM)
  renderer/               # Component tests (happy-dom)
  db/                     # DB action tests (node environment, `forks` pool, real SQLite)
  setup/fast.ts           # Vitest setup: mocks `react-i18next` and injects `window.api`
  renderer/window-api-mock.ts  # Default typed mock of `window.api`

scripts/
  ensure-electron-native-deps.mjs   # Auto-rebuilds better-sqlite3 for Electron ABI
  run-vitest-with-electron.mjs      # Runs vitest under Electron as Node (`ELECTRON_RUN_AS_NODE=1`)
  electron-tooling.mjs              # Helpers to resolve Electron binary paths
```

## Architecture

The app enforces a strict four-layer Electron architecture with hard isolation boundaries:

```
┌─────────────────────────────────────────────┐
│  Renderer (React)                           │
│  Only calls window.api.*                     │
├─────────────────────────────────────────────┤
│  Preload (contextBridge)                    │
│  Exposes business-level APIs only            │
├─────────────────────────────────────────────┤
│  Main Process                               │
│  Window lifecycle, IPC gateway, validation   │
├─────────────────────────────────────────────┤
│  DB Worker (worker_threads)                 │
│  Sole SQLite access, serialized requests     │
└─────────────────────────────────────────────┘
```

**Critical constraints:**
- `contextIsolation: true`, `nodeIntegration: false`
- No raw `ipcRenderer` or arbitrary SQL exposed to the renderer
- Every IPC payload is validated with Zod on both sides
- Every DB write is transactional
- The preload script is the only bridge; all APIs are typed in `shared/window-api.ts`

## Build & Development Commands

Prerequisites: Node.js 20 / 22 / 23 / 24 / 25 (20 LTS or 22 LTS recommended), npm.

```bash
# Install dependencies
npm ci

# Development (auto-rebuilds native deps on first run)
npm run dev

# Production build: typecheck + bundle + package
npm run build
```

Output artifacts are written to `release/<version>/`:
- macOS DMG: `Milesto-Mac-<version>-Installer.dmg`
- Windows NSIS: `Milesto-Windows-<version>-Setup.exe`
- Linux AppImage: `Milesto-Linux-<version>.AppImage`

## Testing Commands

```bash
# Unit + renderer component tests (happy-dom, no Electron runtime needed)
npm run test
npm run test:watch

# DB Worker action tests (Node environment, forks pool, real SQLite)
npm run test:db
npm run test:db:watch
```

**Test architecture:**
- Fast tests (`tests/unit/`, `tests/renderer/`) use `happy-dom` and run in a standard Node process. `tests/setup/fast.ts` mocks `react-i18next` and injects a typed `window.api` mock.
- DB tests (`tests/db/`) run in Vitest's `forks` pool with `environment: 'node'` and a 30s timeout. They test real SQLite logic via the DB worker action layer.
- All tests are executed through `scripts/run-vitest-with-electron.mjs`, which launches Vitest under `ELECTRON_RUN_AS_NODE=1` so that native module resolution matches the Electron runtime.

## Code Style & Linting

```bash
npm run lint          # ESLint with zero-warnings policy
```

**Style rules:**
- TypeScript strict mode (`strict: true`)
- `noUnusedLocals: true` and `noUnusedParameters: true`
- 2-space indentation
- Single quotes
- No semicolons enforced by formatter convention (observed in existing code)
- Unused variables/parameters are compile-time errors

ESLint config: `.eslintrc.cjs` — extends `eslint:recommended`, `@typescript-eslint/recommended`, `plugin:react-hooks/recommended`. Ignores `dist/`, `dist-electron/`, `release/`, `node_modules/`.

## Security Guidelines

- **Never expose `ipcRenderer` directly** in the preload script. Only expose business-level APIs.
- **Validate all IPC payloads** with Zod schemas on both the renderer (before send) and main (on receive) sides.
- **CSP** is installed programmatically in `main.ts` via `session.defaultSession.webRequest.onHeadersReceived`. It disables `unsafe-eval` and restricts sources to `self`.
- **Trusted sender check**: Every IPC handler verifies the sender frame URL starts with an allowed prefix (dev server or `dist/` file URL).
- **Native modules**: `better-sqlite3` is externalized in Vite's Rollup config and rebuilt for the target Electron ABI via `scripts/ensure-electron-native-deps.mjs`.

## Key Development Conventions

### Result<T> Pattern
All cross-boundary APIs (DB worker → main, main → renderer via `window.api`) return `Result<T>`:

```ts
import type { Result } from '../shared/result'
// Result<T> = { ok: true; data: T } | { ok: false; error: AppError }
```

Always check `res.ok` before accessing `res.data`. Never throw raw errors across IPC boundaries.

### Zod Schemas as Source of Truth
All data models, IPC payloads, and DB return values are defined as Zod schemas in `shared/schemas/`. TypeScript types are inferred from schemas:

```ts
import { TaskSchema } from '../shared/schemas/task'
import type { Task } from '../shared/schemas/task'
```

### DB Worker Protocol
Main process communicates with the DB worker via structured messages (`shared/db-worker-protocol.ts`):
- Request: `{ id, type: 'db', action: string, payload: unknown }`
- Response: `{ id, ok: true, data: unknown } | { id, ok: false, error: AppError }`

### i18n
- Supported locales: `en`, `zh-CN`
- Message catalogs live in `shared/i18n/messages.ts`
- In dev mode, `initI18n` throws if message catalogs are out of sync (missing keys between languages)
- Tests mock `react-i18next` so `t('key')` returns `'key'`

### Self-Tests
The app supports an in-app self-test mode triggered by `?selfTest=1`. This is used for CI smoke tests. The main process runs registered self-test functions in the renderer and exits with code `0` or `1`.

### Styling
- No Tailwind CSS configuration file exists in the repo. Styles are hand-written in `src/index.css` using semantic CSS custom properties.
- Design tokens are defined under `:root` and overridden inside `@media (prefers-color-scheme: dark)`.
- The app supports Light, Dark, and System theme modes via `nativeTheme.themeSource`.

## Adding New Features

1. **Data model**: Add Zod schemas to `shared/schemas/` and export from `shared/schemas/index.ts`.
2. **DB actions**: Add handlers in `electron/workers/db/actions/` and register them in `electron/workers/db/db-handlers.ts`.
3. **IPC wiring**: Add the channel handler in `electron/main.ts` using `handleDb()` or `ipcMain.handle()`, and expose it in `electron/preload.ts` under `window.api`.
4. **Renderer types**: Update `shared/window-api.ts` with the new method signature.
5. **UI**: Build pages in `src/pages/` and reusable features in `src/features/`.
6. **Tests**: Add unit/renderer tests in `tests/` and DB tests in `tests/db/`.
7. **i18n**: Add translation keys to both `messagesEn` and `messagesZhCN` in `shared/i18n/messages.ts`.

## Important Files for Agents

| File | Purpose |
|------|---------|
| `shared/window-api.ts` | Contract between preload and renderer |
| `shared/schemas/` | Source of truth for all data shapes |
| `shared/result.ts` | Result type used across all boundaries |
| `electron/preload.ts` | The only bridge to the main process |
| `electron/main.ts` | All IPC handlers and window security |
| `electron/workers/db/db-handlers.ts` | Registry of all DB operations |
| `src/index.css` | All global styles and design tokens |
| `tests/setup/fast.ts` | Test environment setup and mocks |
