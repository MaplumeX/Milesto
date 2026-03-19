# Milesto

**An open-source, local-first desktop task manager inspired by Things 3.**

[简体中文](./README.zh-CN.md) | English

Milesto is a cross-platform desktop app for personal task management, covering the full GTD workflow: collect, organize, execute, and review. All data stays on your machine in a local SQLite database — no account or cloud service required.

<p align="center">
  <img src="docs/photos/1.png" alt="Milesto - Inbox View" width="32%" />
  <img src="docs/photos/2.png" alt="Milesto - Project View" width="32%" />
  <img src="docs/photos/3.png" alt="Milesto - Area View" width="32%" />
</p>

## Features

- **Inbox** — Quick capture for new tasks with minimal friction
- **Today** — Plan your day with drag-and-drop ordering
- **Upcoming / Anytime / Someday** — Organize tasks by time horizon
- **Projects & Sections** — Group related tasks, with support for sections within projects
- **Areas** — Organize projects under broader areas of responsibility
- **Tags** — Flexible labeling for cross-cutting categorization
- **Checklists** — Sub-items within tasks for step-by-step tracking
- **Full-text Search** — FTS5-powered search across task titles and notes (< 200ms at 10k tasks)
- **Data Import / Export** — Full JSON backup and restore with transactional safety
- **Logbook & Trash** — Review completed tasks and recover deleted ones
- **Themes** — Light, Dark, and System modes
- **i18n** — English and Simplified Chinese

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Electron](https://www.electronjs.org/) 30 |
| UI | [React](https://react.dev/) 18 + [TypeScript](https://www.typescriptlang.org/) 5 |
| Bundler | [Vite](https://vitejs.dev/) 5 + vite-plugin-electron |
| Database | [SQLite](https://sqlite.org/) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (in worker_threads) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| Animation | [Framer Motion](https://www.framer.com/motion/) |
| Drag & Drop | [@dnd-kit](https://dndkit.com/) |
| Virtual Scrolling | [@tanstack/react-virtual](https://tanstack.com/virtual) |
| Validation | [Zod](https://zod.dev/) |
| i18n | [i18next](https://www.i18next.com/) |
| Testing | [Vitest](https://vitest.dev/) + Testing Library |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- npm (ships with Node.js)

### Install & Run

```bash
# Install dependencies
npm ci

# Start in development mode
npm run dev
```

### Build

```bash
# Typecheck + bundle + package
npm run build
```

Output artifacts are written to `release/<version>/`:

| Platform | Format | Filename |
|----------|--------|----------|
| macOS | DMG | `Milesto-Mac-<version>-Installer.dmg` |
| Windows | NSIS | `Milesto-Windows-<version>-Setup.exe` |
| Linux | AppImage | `Milesto-Linux-<version>.AppImage` |

### Lint & Test

```bash
npm run lint          # ESLint (zero warnings policy)
npm run test          # Unit + component tests
npm run test:db       # DB Worker action tests
```

## Architecture

Milesto follows a strict four-layer Electron architecture with hard isolation boundaries:

```
┌─────────────────────────────────────────────┐
│  Renderer (React)                           │
│  Only calls window.api.*                    │
├─────────────────────────────────────────────┤
│  Preload (contextBridge)                    │
│  Exposes business-level APIs only           │
├─────────────────────────────────────────────┤
│  Main Process                               │
│  Window lifecycle, IPC gateway              │
├─────────────────────────────────────────────┤
│  DB Worker (worker_threads)                 │
│  Sole SQLite access, serialized requests    │
└─────────────────────────────────────────────┘
```

**Key constraints:**
- `contextIsolation: true`, `nodeIntegration: false`
- No raw `ipcRenderer` or arbitrary SQL exposed to Renderer
- All IPC payloads validated with Zod schemas
- All DB writes are transactional

## Project Structure

```
electron/
  main.ts                 # Main process entry
  preload.ts              # Preload script
  workers/db/
    db-worker.ts          # DB Worker entry
    actions/              # Business logic (task, project, area, tag, etc.)

src/
  App.tsx                 # Root component
  app/
    AppRouter.tsx         # Route definitions
    AppShell.tsx          # Sidebar + content layout
  pages/                  # Route pages (Today, Inbox, Upcoming, ...)
  features/               # Domain features (tasks, projects, settings, ...)
  components/             # Shared UI components
  i18n/                   # i18next configuration

shared/
  window-api.ts           # window.api type contract
  schemas/                # Zod schemas (source of truth for data models)
  result.ts               # Result<T> type
  app-error.ts            # Structured error type
```

## Contributing

1. Read the docs in `docs/` before making significant changes:
   - `redlines.md` — Hard constraints (highest priority)
   - `standards.md` — Engineering standards
   - `ui.md` — UI/UX rules
   - `tech-framework.md` — Architecture decisions
2. Follow the existing code style (TypeScript strict, 2-space indent, single quotes).
3. Run `npm run lint` and ensure zero warnings before submitting changes.

## License

This project is licensed under the [MIT License](./LICENSE).
