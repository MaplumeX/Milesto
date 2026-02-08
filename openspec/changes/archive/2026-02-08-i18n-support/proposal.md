## Why

Milesto currently renders almost all user-facing text as hardcoded strings in the Renderer, and a small but important set of native dialog strings in Electron Main. The UI already contains a mix of English and Chinese hardcoded text, which is inconsistent and blocks adding proper localization.

We want to provide first-class i18n support (starting with `en` and `zh-CN`) with a user-selectable language, persisted across restarts, and applied consistently to both the React UI and Main-process native file dialogs.

## What Changes

- Add a translation system in the Renderer (React) so UI text is keyed and can switch languages at runtime.
- Add a language setting in Settings UI that lets users choose `English` / `中文`.
- Persist the selected locale so it survives app restarts.
- Localize Electron Main native dialogs used by data import/export (titles and file type filter labels).
- Define a minimal, validated cross-process API for reading/updating locale (via `window.api`, request/response IPC only).
- Establish a translation key catalog and basic coverage checks (e.g., ensuring `en`/`zh-CN` key sets stay in sync).

## Capabilities

### New Capabilities

- `app-language-preference`: User can select `en` or `zh-CN` in Settings; the choice is persisted and used as the effective locale with a safe fallback strategy.
- `ui-localization`: The React UI and Main-process native dialogs use translation keys and shared message catalogs to render localized strings.

### Modified Capabilities

<!-- None. This change introduces i18n as a new capability without changing existing feature requirements beyond how strings are presented. -->

## Impact

- Affected code areas:
  - Renderer bootstrap (`src/main.tsx`, `src/App.tsx`) to initialize locale before or during initial render.
  - Settings UI (`src/pages/SettingsPage.tsx`) to add language controls.
  - Electron Main (`electron/main.ts`) to translate native dialog titles and filter labels.
  - Preload + shared API typing (`electron/preload.ts`, `shared/window-api.ts`) to expose minimal i18n/settings methods.
  - DB worker migrations/actions if locale is persisted in SQLite (`electron/workers/db/db-worker.ts`, `electron/workers/db/actions/*`).

- New dependencies (likely): `i18next`, `react-i18next` (plus any minimal helpers for typed keys if needed).

- Security/boundary considerations:
  - Renderer must not use `ipcRenderer` directly; use `window.api.*` only.
  - IPC channels must be allowlisted, sender-validated, and schema-validated (zod).
  - Locale must be allowlisted/normalized to avoid path traversal or injection when used in any resource lookup.

- Testing/regression:
  - The existing `selfTest` relies on English button text for DOM queries; language selection must not cause selfTest to become flaky (e.g., selfTest runs in `en` by default).
