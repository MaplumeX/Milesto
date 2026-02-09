## Why

Milesto currently has no first-class automated test runner wired into `npm` scripts, making regressions easy to introduce and hard to catch early. We also lack a reusable DB test harness because DB bootstrap/dispatch logic is embedded in the DB worker entrypoint.

## What Changes

- Add a Vitest-based test setup for unit tests (shared/pure logic) and renderer component tests (React) with stable mocking at the `window.api` boundary.
- Refactor DB worker bootstrap/handler wiring/dispatch into reusable modules so tests can create an isolated SQLite database and exercise DB actions deterministically.
- Add an initial seed set of tests that prove the harness works and lock down high-risk invariants (schema invariants, structured errors, import/transaction rollback).

## Capabilities

### New Capabilities

- `test-harness`: Provide a first-class automated test harness (commands, structure, and minimal baseline coverage) for unit tests, renderer component tests, and DB action tests.

### Modified Capabilities

<!-- None. This change is engineering-only and does not modify product requirements. -->

## Impact

- New dev dependencies for testing (Vitest + DOM test utilities) and new `npm` scripts (e.g. `test`, `test:db`).
- New test directories/files (under a dedicated `tests/` tree) and a consistent mocking strategy for `window.api` and `react-i18next`.
- Refactors in the DB worker area (`electron/workers/db/*`) to expose reusable DB bootstrap and request dispatch helpers (no DB schema changes expected).
