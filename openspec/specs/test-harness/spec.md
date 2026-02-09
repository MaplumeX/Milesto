# test-harness Specification

## Purpose
Provide first-class automated test commands and a deterministic test harness for Milesto (unit tests, renderer component tests, and DB action tests) without requiring an Electron runtime.

## Requirements

### Requirement: Repository provides automated test commands
The repository SHALL provide first-class `npm` scripts for running automated tests locally.

#### Scenario: Run fast tests
- **WHEN** a developer runs the default test command
- **THEN** unit tests and renderer component tests run via Vitest and complete successfully without requiring an Electron runtime

#### Scenario: Run DB action tests
- **WHEN** a developer runs the DB test command
- **THEN** DB action tests run via Vitest in a Node environment and complete successfully using an isolated SQLite database

### Requirement: Renderer tests respect the Electron boundary
Renderer component tests SHALL treat `window.api` as the integration boundary and SHALL NOT require access to Electron IPC primitives.

#### Scenario: Mocked bridge
- **WHEN** renderer component tests execute
- **THEN** `window.api` is provided by test mocks (typed to the `WindowApi` contract) rather than a real preload bridge

#### Scenario: No Electron runtime required
- **WHEN** renderer component tests execute in the test runner
- **THEN** they do not import or require the `electron` module and do not access `ipcRenderer`

### Requirement: DB tests reuse production bootstrap and dispatch semantics
DB action tests SHALL reuse the production DB bootstrap logic (pragmas and migrations) and the production dispatch semantics for request handling.

#### Scenario: Shared migrations
- **WHEN** DB action tests initialize a test database
- **THEN** the same migrations and baseline pragmas used by the DB worker are applied to the test database

#### Scenario: Stable error mapping
- **WHEN** a DB request is dispatched for an unknown action
- **THEN** the response is a structured error with code `DB_UNKNOWN_ACTION`

#### Scenario: Unhandled DB exceptions are contained
- **WHEN** a DB action handler throws an unhandled exception during a dispatched request
- **THEN** the response is a structured error with code `DB_UNHANDLED` and does not crash the test runner

### Requirement: DB tests are isolated from real user data
DB action tests SHALL run against isolated database files and SHALL NOT read or write the real application database in the user data directory.

#### Scenario: Isolated DB path
- **WHEN** DB action tests run
- **THEN** each test uses a unique temporary DB path and cleans up after execution
