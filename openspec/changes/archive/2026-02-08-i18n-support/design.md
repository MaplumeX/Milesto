## Context

- Renderer (React) currently contains many hardcoded user-facing strings across pages, navigation, command palette, and task editor. The codebase already mixes English and Chinese hardcoded strings.
- Electron Main shows native file dialogs for import/export in `electron/main.ts` with hardcoded English titles and filter names.
- The project enforces strict Electron boundaries:
  - Renderer must not use `ipcRenderer` directly; it must call `window.api.*` (Preload).
  - IPC must be request/response only (`ipcMain.handle` / `ipcRenderer.invoke`).
  - IPC must validate sender and payload with zod.
  - DB access must run in the DB Worker (SQLite via `better-sqlite3`).
- There is no existing settings storage/API. DB schema migrations are managed in `electron/workers/db/db-worker.ts` via `PRAGMA user_version`.
- The existing `src/app/selfTest.ts` locates UI elements by visible English strings in multiple places; language switching can introduce test brittleness unless selfTest is pinned to `en`.

## Goals / Non-Goals

**Goals:**

- Provide i18n for the app starting with two locales: `en` and `zh-CN`.
- Add a Settings UI control to switch language at runtime.
- Persist the selected locale across restarts.
- Apply the selected locale consistently in:
  - Renderer UI (React)
  - Electron Main native import/export dialogs (titles + JSON filter name)
- Keep cross-process surface area minimal and validated (sender + zod).
- Keep message catalogs shared and bundled (no runtime disk reads and no “send the full catalog over IPC”).

**Non-Goals:**

- Translating every string in the application in one pass (we will start with the core shell and visible flows).
- Localizing DB/IPC error messages end-to-end (we will prefer translating by stable error codes in the UI later).
- Adding multi-window real-time locale sync (single-window app today; can be extended later).
- Adding locale-aware date/number formatting beyond current needs (can be a follow-up once string i18n is stable).

## Decisions

1) Translation library for the Renderer

- Decision: Use `i18next` + `react-i18next` in the Renderer.
- Rationale:
  - Well-supported runtime language switching (`changeLanguage`).
  - Works naturally with React components and gradual adoption (`t('key')` around existing hardcoded strings).
  - Allows a simple “shared catalog” approach (imported resources) without relying on runtime `fetch()` under `file://`.
- Alternatives considered:
  - `react-intl`/FormatJS: great ICU story but heavier JSX patterns and more glue for this codebase.
  - Lingui: attractive compile-time approach but adds build-time complexity early.

2) Locale model, allowlist, and normalization

- Decision: Treat locale as untrusted input and constrain it to an allowlist: `['en', 'zh-CN']`.
- Normalize system locales:
  - `zh`, `zh-Hans`, `zh-CN`, `zh-SG`, `zh-HK`, `zh-TW` -> `zh-CN` (for v1; region nuance can be added later).
  - Everything else -> `en`.
- Rationale:
  - Prevents path traversal / injection risks if locale is ever used to select resources.
  - Keeps catalogs small and predictable.

3) Source of truth + persistence strategy

- Decision: Locale source of truth lives in Electron Main, persisted in SQLite via the DB Worker.
- Storage design:
  - Add a small `app_settings` table (key/value + updated_at) via DB migration (bump `user_version`).
  - Store `key = 'locale'`, `value = 'en' | 'zh-CN'`.
- Rationale:
  - Aligns with the existing architecture and redlines (DB access stays in DB Worker).
  - Avoids introducing a second persistence system (e.g. JSON config file) just for locale.
- Alternative considered:
  - `userData/settings.json` managed by Main with atomic writes. This is simpler, but diverges from “DB in worker” as the canonical persistence path.

4) Cross-process API surface

- Decision: Add a minimal `settings` domain to `window.api`:
  - `window.api.settings.getLocaleState(): Result<{ locale: Locale; supportedLocales: Locale[] }>`
  - `window.api.settings.setLocale(locale: Locale): Result<{ locale: Locale; supportedLocales: Locale[] }>`
- IPC channels:
  - `settings:getLocaleState`
  - `settings:setLocale`
- Implementation notes:
  - Main validates sender (`ensureTrustedSender`) and payload with zod.
  - Main forwards persistence to DB Worker via a new settings action.
  - Main returns the normalized effective locale.
- Rationale:
  - Keeps the API stable and business-level; Renderer never sees raw IPC.
  - Returning `supportedLocales` avoids duplicating constants across layers.

5) Shared message catalogs (Main + Renderer)

- Decision: Define message catalogs in a shared module under `shared/` and import them from both Main and Renderer bundles.
- Rationale:
  - Ensures Main can translate native dialogs without involving Renderer.
  - Avoids shipping translation JSON as extraResources or reading from disk at runtime.

6) Renderer bootstrap

- Decision: Bootstrap locale before the initial React render (or at least before rendering user-facing strings).
- Approach:
  - In `src/main.tsx`, call `window.api.settings.getLocaleState()`; on failure fall back to `en`.
  - Initialize i18next with the chosen locale and the bundled resources.
  - Mount React afterwards.
- Rationale:
  - Avoids a visible “flash” where the UI briefly renders in the wrong language.

7) Main native dialog localization

- Decision: Localize `dialog.showSaveDialog` / `dialog.showOpenDialog` titles and filter labels using the same shared catalogs.
- Scope:
  - Export: title (e.g. `dialog.export.title`), filter name (e.g. `fileFilter.json`).
  - Import: title (e.g. `dialog.import.title`), filter name.
- Rationale:
  - Covers the user-facing Main-process strings in scope without adding a heavy Main-side i18n runtime.

## Risks / Trade-offs

- [SelfTest brittleness] Language switching breaks tests that locate elements by English text
  -> Mitigation: force selfTest to run with locale `en` (explicit bootstrap or environment/query param).

- [Startup latency] Waiting for an IPC roundtrip before mounting React may add a small delay
  -> Mitigation: keep IPC handler fast (cached in Main when possible), and fall back to `en` if loading fails.

- [Partial translation coverage] Incremental adoption can leave mixed languages visible
  -> Mitigation: prioritize translating App shell/navigation/Settings/Search and the most visible task editor strings first; add a key coverage check.

- [Locale persistence semantics] “Reset All Data” could be expected to reset locale
  -> Mitigation: define behavior explicitly (v1 keeps locale; if users expect reset, add a separate “Reset Settings” later).

- [Future expansion] Adding more locales later could require pluralization/ICU formatting
  -> Mitigation: keep translation keys stable; choose library (`i18next`) that can expand with ICU plugins if needed.

## Migration Plan

1. Introduce shared locale model + normalization and add a DB migration for `app_settings`.
2. Add DB Worker actions to read/write locale.
3. Add Main IPC handlers + Preload `window.api.settings` methods.
4. Add shared message catalogs and Renderer i18n initialization.
5. Update Settings page to show language selector and persist choice.
6. Localize Main import/export dialogs.
7. Convert key high-visibility UI strings from hardcoded text to `t('...')`.
8. Add a lightweight verification (key set parity between `en` and `zh-CN`).

## Open Questions

- Should selfTest enforce `en` via a query param (e.g. `?locale=en`) or via a Main env var that overrides persisted locale?
- Should `Reset All Data` also clear `app_settings`? (Current recommendation: no.)
- Do we want `zh-CN` only, or do we anticipate `zh-TW` soon enough to model `zh-Hans` / `zh-Hant` now?
