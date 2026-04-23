# Milesto

A focused, keyboard-friendly desktop task manager inspired by Things. Built with Electron, React, and SQLite.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-20%2B-green.svg)

## Features

- **Lists**: Inbox, Today, Upcoming, Anytime, Someday, Logbook, Trash
- **Projects & Areas**: Organize tasks into projects, group projects by areas
- **Quick Capture**: Add tasks from anywhere with a keyboard shortcut
- **Drag & Drop**: Reorder tasks, projects, and areas intuitively
- **Search**: Fast full-text search across all tasks and projects
- **Dates**: Schedule tasks, set deadlines, and view your upcoming week
- **Offline-First**: All data stored locally in SQLite; works without a network
- **Cloud Sync** (optional): WebSocket-based sync engine for multi-device support
- **Internationalization**: Multi-language support (i18n-ready)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Desktop | Electron 30 |
| Database | better-sqlite3 (Worker Thread) |
| State | React Context + optimistic updates |
| Drag & Drop | @dnd-kit |
| Virtualization | @tanstack/react-virtual |
| Testing | Vitest + React Testing Library |

## Architecture

Milesto uses a three-layer communication stack:

```
Renderer (React)     →    Main Process (Node)     →    DB Worker Thread
      |                           |                           |
   contextBridge            ipcMain.handle()          Worker.postMessage()
   window.api                                                better-sqlite3
```

All SQLite operations run off the main thread via a dedicated DB Worker, keeping the UI responsive.

## Quick Start

**Requirements**: Node.js 20+ and npm.

```bash
# Install dependencies
npm install

# Start development (Vite + Electron)
npm run dev

# Run tests
npm test

# Run DB-specific tests
npm run test:db

# Production build
npm run build
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Full production build |
| `npm test` | Run test suite (Electron Node runtime) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:db` | Run DB worker tests |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

## Project Structure

```
src/              React renderer (pages, components, features)
electron/         Electron main + preload + DB worker
  main.ts         Entry point
  preload.ts      Context bridge (window.api)
  workers/db/     DB Worker Thread (SQLite operations)
  sync/           Cloud sync engine (WebSocket)
shared/           Shared code (schemas, types, i18n, result monad)
tests/            Test suites (renderer, unit, DB)
```

## Security

- `contextIsolation: true`, `nodeIntegration: false`
- Preload exposes only a typed business-level API — no raw `ipcRenderer`
- IPC sender origin validation on all handlers
- `better-sqlite3` is never accessible from the renderer

## License

MIT © 2026 Maplume
