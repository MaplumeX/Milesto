## 1. Test Runner Setup (Vitest)

- [x] 1.1 Add Vitest + DOM testing dependencies (Vitest, jsdom/happy-dom, React Testing Library, user-event, jest-dom)
- [x] 1.2 Add `npm` scripts for tests (at minimum `test` and `test:db`) without breaking existing `dev/build` workflows
- [x] 1.3 Add a minimal `vitest.config.ts` suitable for an ESM TypeScript repo and split fast tests vs DB tests via globs

## 2. Shared Unit Test Baseline

- [x] 2.1 Add unit tests for `shared/result.ts` (`ok/err/resultSchema`)
- [x] 2.2 Add unit tests for `shared/app-error.ts` (`toAppError` fallback and passthrough)
- [x] 2.3 Add unit tests for schema invariants in `shared/schemas/task.ts` (inbox/someday/scheduled invariants)
- [x] 2.4 Add unit tests for `shared/schemas/search.ts` input validation (`query` minimum length)

## 3. Renderer Component Test Baseline

- [x] 3.1 Add renderer test setup that provides a typed `window.api` mock (aligned to `shared/window-api.ts`)
- [x] 3.2 Add a stable i18n mock for component tests (avoid brittle localized string assertions)
- [x] 3.3 Add one representative component test that validates the harness end-to-end (render + user interaction + assertions)


## 4. DB Worker Refactor for Testability

- [x] 4.1 Extract DB bootstrap into a reusable module (open DB, apply pragmas, run migrations)
- [x] 4.2 Extract DB handler wiring into a reusable module (build the action map from `create*Actions`)
- [x] 4.3 Extract DB request dispatch into a reusable module that preserves production error mapping (`DB_UNKNOWN_ACTION`, `DB_UNHANDLED`)
- [x] 4.4 Update the DB worker entrypoint to use the extracted modules without behavior changes

## 5. DB Action Tests (Deterministic)

- [x] 5.1 Create a DB test helper that creates a unique temporary DB path per test and initializes it via the shared bootstrap
- [x] 5.2 Add a DB test that proves import overwrite is transactional (a failed import MUST roll back and not leave partial data)
- [x] 5.3 Add a DB dispatch test for unknown action mapping (`DB_UNKNOWN_ACTION`)
- [x] 5.4 Add a DB dispatch test that thrown exceptions are contained and returned as `DB_UNHANDLED`

## 6. Verification & Docs

- [x] 6.1 Verify `npm run test` passes locally (fast tests only)
- [x] 6.2 Verify `npm run test:db` passes locally (DB action tests)
- [x] 6.3 Verify `npx tsc -p tsconfig.json` and `npm run build` still succeed after refactors
- [x] 6.4 Document how to run tests locally (short notes in an appropriate doc file)
