# Milesto Agent Guide (AGENTS.md)

This file is for agentic coding tools working in this repository.
When in doubt, follow the repo's existing written rules first.

## Source of Truth (Read These First)

- `docs/redlines.md` - hard MUST NOT rules (security, IPC boundaries, DB constraints, privacy)
- `docs/standards.md` - engineering standards (naming, error handling, PR expectations)
- `docs/ui.md` - UI/UX design rules and interaction guidelines (renderer)
- `docs/tech-framework.md` - target architecture and recommended tooling

Cursor/Copilot rules:
- No `.cursor/rules/` or `.cursorrules` found.
- No `.github/copilot-instructions.md` found.

## Repository Layout

- `electron/` - Electron main + preload
- `src/` - Renderer (React)
- `shared/` - shared code/types (currently minimal)
- `tests/` - tests (currently empty)
- `docs/` - specs and standards
- `docs/design/prototype interface/` - separate Vite prototype app (treat as a subproject)

## Commands (Repo Root)

Package manager:
- Use `npm` (root has `package-lock.json`).

Install:
- `npm ci`

Dev:
- `npm run dev`

Build (typecheck + bundle + package):
- `npm run build`

Preview (renderer build only):
- `npm run preview`

Typecheck (explicit):
- `npx tsc -p tsconfig.json`
  - Note: `tsconfig.json` sets `noEmit: true`, so this is typecheck-only.

Lint:
- `npm run lint`
  - Current status: fails because no ESLint config file exists yet (`.eslintrc.*` or
    `eslint.config.*`).
  - If you need lint to be green, add an ESLint config and/or ignore subprojects appropriately
    (the repo contains a separate prototype app under `docs/design/prototype interface/`).

## Commands (Prototype Subproject)

The directory `docs/design/prototype interface/` has its own `package.json`.

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run preview`

Environment variables:
- Prototype README mentions `GEMINI_API_KEY` in `.env.local`.
- Do not commit secrets; repo `.gitignore` ignores `.env*` by default.

## Tests

Root test runner is not set up yet (no `test` scripts, `tests/` is empty).

If/when Vitest is added (recommended by `docs/tech-framework.md` / `docs/standards.md`):
- Run all tests (watch): `npx vitest`
- Run all tests (CI): `npx vitest run`
- Run a single file: `npx vitest run path/to/file.test.ts`
- Run a single test name: `npx vitest run -t "should do X"`

If/when Playwright E2E is added:
- Run all E2E tests: `npx playwright test`
- Run a single spec: `npx playwright test tests/e2e/foo.spec.ts`
- Run a single test name: `npx playwright test -g "window should open"`

## Code Style (Practical Defaults)

The repo currently has no formatter config (Prettier/Biome not checked in). Use local file
style and keep diffs focused.

- Formatting: 2-space indent; prefer single quotes; avoid semicolons if the file already does.
- Avoid drive-by formatting: don't reformat unrelated files/blocks in the same PR.
- Keep imports stable and grouped:
  - Node/Electron built-ins first (use the `node:` prefix where applicable)
  - Third-party packages
  - Internal modules
  - Relative imports
  - Styles/assets last
- Prefer `import type { ... }` for type-only imports when it improves clarity.
- TS extension imports are allowed (`tsconfig.json` has `allowImportingTsExtensions: true`).
  Prefer whatever the surrounding code uses (do not churn it).

## TypeScript Rules

- TS is `strict: true` (`tsconfig.json`). Do not weaken types to "make it work".
- `noUnusedLocals` / `noUnusedParameters` are enabled: remove unused code or wire it up.
- Avoid `any`. For untrusted data, use `unknown` and validate at runtime.

## Naming Conventions (From `docs/standards.md`)

- Variables/functions: `camelCase`
- Types/classes/enums/components: `PascalCase`
- Booleans: prefix with `is` / `has` / `can` / `should`
- Event handlers: `handleXxx` (e.g. `handleSubmit`)

Files/directories:
- Directories: `kebab-case/`
- React components: `PascalCase.tsx`
- Non-component modules (utils/domain/schema): `kebab-case.ts`
- Tests: `*.test.ts(x)` (keep names aligned with the source file)

## Architecture & Boundary Rules (Hard)

Milesto is designed as Electron Main / Preload / Renderer, plus a DB Worker.
Do not cross these boundaries.

- Renderer must not use `ipcRenderer` directly.
  - Renderer should call `window.api.*` (business-level APIs exposed by Preload).
- Preload must not expose dangerous primitives.
  - Do not expose raw `ipcRenderer`, arbitrary SQL execution, or arbitrary filesystem access.
- IPC shape:
  - Use request/response only: `ipcMain.handle` / `ipcRenderer.invoke`.
  - Channels should be domain-scoped (e.g. `db:*`, `settings:*`, `app:*`).
  - Validate sender/window in main before servicing requests.
  - Schema-validate all IPC payloads and return values (docs recommend `zod`).

Electron security baseline:
- Ensure `contextIsolation: true` and `nodeIntegration: false`.
- Do not use `@electron/remote`.
- Enforce CSP and at least disable `unsafe-eval`.

Database rules:
- No SQLite access in Main/Renderer.
- DB access must run in a dedicated `worker_threads` DB Worker.
- No generic `query(sql)` escape hatch.
- All writes must be transactional; import/bulk writes must roll back on failure.

## Error Handling & Logging

- Cross-boundary failures should use a stable structured error:
  - `AppError = { code: string, message: string, details?: unknown }`
- UI must only rely on `code` / `message`.
- `details` is for local logs/debugging only (never show raw details to users).
- Never log secrets, credentials, or personal data. Redact aggressively.

## Current State Notes (WIP)

- Root ESLint is installed but has no config file yet, so `npm run lint` fails.
- Current Electron preload/renderer code looks like starter boilerplate and may violate
  `docs/redlines.md` (notably around IPC exposure). When touching those areas, refactor
  towards the documented `window.api` boundary.
