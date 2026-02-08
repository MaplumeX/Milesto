# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Milesto is a cross-platform desktop task management app built with Electron + React + TypeScript. It targets macOS, Windows, and Linux. Data is stored locally in SQLite via `better-sqlite3` running in a `worker_threads` DB Worker.

## Commands

Package manager: **npm** (uses `package-lock.json`)

```bash
npm ci                    # Install dependencies
npm run dev               # Dev mode (Vite + Electron)
npm run build             # Typecheck + Vite build + electron-builder package
npm run lint              # ESLint (ts,tsx, zero warnings)
npm run preview           # Preview renderer build only
npx tsc -p tsconfig.json  # Typecheck only (noEmit)
```

No test runner is configured yet. When Vitest is added:
```bash
npx vitest run                          # All tests (CI)
npx vitest run path/to/file.test.ts     # Single file
npx vitest run -t "test name"           # Single test by name
```

## Architecture

### Four-layer Electron architecture

```
electron/main.ts          → Main process: window lifecycle, IPC gateway, DB Worker management
electron/preload.ts       → Preload: contextBridge exposes window.api.* (business-level APIs)
src/                      → Renderer: React UI (only calls window.api.*)
electron/workers/db/      → DB Worker: sole SQLite access via worker_threads
```

**Hard boundaries** — do not cross these:
- Renderer must never use `ipcRenderer` directly; only `window.api.*`
- Preload must not expose raw `ipcRenderer`, arbitrary SQL, or filesystem access
- DB access is exclusively in the DB Worker — never in Main or Renderer
- IPC uses only `ipcMain.handle` / `ipcRenderer.invoke` (request-response)

### Source layout

```
electron/
  main.ts                  # Main process entry
  preload.ts               # Preload script
  ipc/                     # IPC channel definitions
  workers/db/
    db-worker.ts           # Worker entry
    db-worker-client.ts    # Client for Main → Worker communication
    actions/               # Business actions (task, project, area, tag, checklist, sidebar, settings, data-transfer)

src/
  main.tsx                 # Renderer entry
  App.tsx                  # Root component (HashRouter)
  app/
    AppRouter.tsx           # Route definitions
    AppShell.tsx            # Main layout (sidebar + content, drag-and-drop hub)
    AppEventsContext.tsx     # Global event bus (Context API)
  pages/                    # Route pages (Inbox, Today, Upcoming, Anytime, Someday, Logbook, Project, Area, Search, Settings)
  features/tasks/           # Task domain (TaskEditorPaper, TaskList, TaskRow, grouped lists, selection context, dnd)
  lib/                      # Utilities (dates)
  i18n/                     # i18next config

shared/                     # Shared between Main + Renderer
  window-api.ts             # WindowApi type (the contract for window.api.*)
  result.ts                 # Result<T> type
  app-error.ts              # AppError structure (code/message/details)
  db-worker-protocol.ts     # Worker message protocol
  schemas/                  # Zod schemas (task, project, area, tag, checklist, sidebar, search, data-transfer, etc.)
  i18n/                     # Locale definitions and translations
```

### Key patterns

- **State management**: Context API (`AppEventsContext`, `TaskSelectionContext`). Tech framework recommends zustand for future growth.
- **Routing**: HashRouter with `AppShell` layout wrapping all pages. Default route redirects `/` → `/today`.
- **Window API**: `window.api` organized by domain — `app.*`, `data.*`, `settings.*`, `task.*`, `project.*`, `area.*`, `sidebar.*`, `tag.*`, `checklist.*`.
- **Data models**: Zod schemas in `shared/schemas/` define all data structures and are the source of truth for IPC validation.
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable` with custom drop animation.
- **Virtual scrolling**: `@tanstack/react-virtual` for task lists (required for 10k task target).
- **i18n**: `i18next` + `react-i18next`.

## Source of Truth Documents

Read these before making significant changes:

1. **`docs/redlines.md`** — Hard MUST NOT rules (highest priority). Security, IPC boundaries, DB constraints, privacy, performance red lines.
2. **`docs/standards.md`** — Engineering standards: naming, error handling, architecture boundaries, PR expectations.
3. **`docs/ui.md`** — UI/UX rules: shadcn/ui + Tailwind, minimal design, keyboard-first, virtual scrolling, accessibility.
4. **`docs/tech-framework.md`** — Target architecture, recommended tooling, IPC/DB Worker protocol, performance targets.

## Critical Rules (from redlines.md)

- `contextIsolation: true`, `nodeIntegration: false` — always
- No `@electron/remote`
- CSP enabled, `unsafe-eval` disabled
- All DB writes must be transactional; import failures must rollback
- Core IDs must be UUID (no auto-increment)
- `deleted_at` (soft delete) and `updated_at` (reliable change tracking) required on core entities
- No telemetry/analytics by default
- Performance: search < 200ms at 10k tasks, cold start < 1s, virtual scrolling mandatory for lists

## Code Style

- TypeScript `strict: true` with `noUnusedLocals` and `noUnusedParameters`
- 2-space indent, single quotes, follow existing file style
- Avoid `any`; use `unknown` + runtime validation for untrusted data
- Variables/functions: `camelCase`; types/classes/components: `PascalCase`
- Booleans: `is`/`has`/`can`/`should` prefix
- Event handlers: `handleXxx`
- Directories: `kebab-case/`; React components: `PascalCase.tsx`; other modules: `kebab-case.ts`
- Import order: Node/Electron built-ins → third-party → internal → relative → styles
- Prefer `import type { ... }` for type-only imports
- TS extension imports allowed (`.ts` suffix) — follow surrounding code convention

## IPC & DB Worker Conventions

- IPC channels: domain-scoped (`db:*`, `settings:*`, `app:*`)
- DB Worker actions: `domain.verb` format (`task.create`, `project.list`)
- All IPC payloads validated with Zod schemas
- Errors: `AppError { code, message, details? }` — UI uses only `code`/`message`
- Error codes: `SCOPE_CODE` format (`DB_TIMEOUT`, `VALIDATION_FAILED`)

## OpenSpec Workflow

This project uses the OpenSpec artifact workflow for structured changes. Configuration in `openspec/config.yaml`. Specs live in `openspec/specs/`, changes in `openspec/changes/`.
