## Context

- Repo state today:
  - No automated test runner wired into `package.json` scripts.
  - A large in-app UI self-test harness exists (`src/app/selfTest.ts`) and is executed via `?selfTest=1` with an isolated `userData` directory when `MILESTO_SELF_TEST=1`.
  - DB access is correctly isolated to the DB worker (`worker_threads`) and all cross-boundary calls go through `window.api` (preload) and `ipcMain.handle` (main).
- Constraints:
  - TypeScript is strict; the repo is ESM (`package.json` has `type: "module"`).
  - Electron boundary rules remain: renderer tests must not import/use `ipcRenderer`; DB writes remain transactional.
  - `better-sqlite3` is a native dependency; DB-related tests must be isolated, deterministic, and avoid requiring Electron runtime.

## Goals / Non-Goals

**Goals:**

- Provide a first-class Vitest setup that supports:
  - Unit tests for shared/pure logic.
  - Renderer component tests that mock `window.api` and avoid crossing Electron boundaries.
  - DB action tests that exercise `electron/workers/db/actions/*` against an isolated SQLite database, using the same bootstrap (pragmas + migrations) as production.
- Refactor DB worker code so migrations/bootstrap and request dispatch can be reused by tests without instantiating a Worker.
- Add a minimal baseline test suite that proves the harness works and protects high-risk invariants.

**Non-Goals:**

- Replace or remove the existing in-app `selfTest` harness.
- Add Playwright/E2E in this change (can be a follow-up).
- Change product behavior, DB schema, or IPC surface.
- Introduce a full CI pipeline (can be a follow-up once tests exist).

## Decisions

### 1) Vitest as the primary runner (ESM + TS)

**Decision:** Use Vitest for unit and component tests.

**Rationale:**

- Aligns with Vite/TS and keeps feedback loops fast.
- Works well with ESM projects and supports modern mocking patterns.

**Alternatives considered:**

- Jest: slower in Vite-first repos and adds extra ESM friction.

### 2) Keep tests under a dedicated `tests/` tree

**Decision:** Place tests in `tests/` (not under `src/` / `electron/` / `shared/`) so production `tsc` typecheck and builds are not forced to include test files.

**Rationale:**

- Current `tsconfig.json` includes `src`, `electron`, and `shared` only; keeping tests outside avoids accidental coupling with production build/typecheck.
- Test typechecking can be added explicitly via a dedicated test tsconfig if desired.

**Alternatives considered:**

- Co-locating tests next to sources: convenient, but would require adjusting `tsconfig` and build/lint gates.

### 3) Renderer tests mock `window.api` and i18n

**Decision:** Renderer component tests SHALL treat `window.api` as the boundary and mock it with typed helpers. `react-i18next` SHALL be mocked to avoid brittle string assertions.

**Rationale:**

- Keeps renderer tests fast and deterministic.
- Preserves the security boundary rules (renderer does not touch IPC primitives).

### 4) Refactor DB worker into reusable bootstrap + handlers + dispatch

**Decision:** Split DB worker code into reusable modules:

- `db-bootstrap`: apply pragmas + run migrations + open DB.
- `db-handlers`: build the action handler map (wiring `create*Actions`).
- `db-dispatch`: dispatch a `DbWorkerRequest` against handlers and return a `DbWorkerResponse` with stable error mapping.

The worker entrypoint remains a thin adapter that uses these modules.

**Rationale:**

- Tests can open an isolated SQLite database and reuse the exact production migrations/pragmas.
- Tests can call `dispatchDbRequest()` to ensure error mapping matches production (unknown action / unhandled error).

**Alternatives considered:**

- Spawning a real Worker in tests: closer to real runtime but slower and more fragile.

### 5) DB tests focus on invariants + transactions first

**Decision:** The initial DB test suite prioritizes:

- Transaction rollback on import failures.
- Schema invariants and structured error shapes.

**Rationale:**

- These are the highest risk areas per `docs/redlines.md` (no half-written imports; transactional writes).

## Risks / Trade-offs

- [Native dependency friction] `better-sqlite3` can be a pain on CI/multi-platform.
  -> Mitigation: keep DB tests in a separate script (`test:db`) so teams can stage CI adoption; ensure tests use isolated temporary DB paths.

- [Test brittleness] Renderer tests can become brittle if they assert on localized strings.
  -> Mitigation: mock `react-i18next` and prefer behavior-based assertions.

- [Refactor risk] Splitting DB worker code could accidentally change runtime behavior.
  -> Mitigation: keep the worker entrypoint behavior identical; add dispatch-level tests that cover unknown action/unhandled error mapping.

## Migration Plan

1) Add test dependencies and a minimal Vitest config.
2) Add shared unit tests (fast) and one renderer component test (to validate mocking patterns).
3) Extract DB bootstrap/handlers/dispatch modules and update DB worker entrypoint to use them.
4) Add 1-2 DB action tests that use the extracted bootstrap and dispatch helpers.

Rollback: revert the DB worker refactor and test additions; no user data migrations or external API changes are expected.

## Open Questions

- Should we introduce a dedicated `tsconfig.test.json` to typecheck tests explicitly, or rely on Vitest + `tsc -p tsconfig.json` (production only) initially?
- Should `npm test` include DB tests by default, or keep them in `test:db` until CI is ready for native modules?
