## 1. Dependencies & Shared Models

- [x] 1.1 Add i18n dependencies for Renderer (`i18next`, `react-i18next`) and ensure build still succeeds
- [x] 1.2 Define `Locale` allowlist + normalization in `shared/` (zod schema + helper)
- [x] 1.3 Create shared message catalogs for `en` and `zh-CN` (initial keys for shell + dialogs)
- [x] 1.4 Add a lightweight key-parity check (ensure `en` and `zh-CN` key sets match)

## 2. DB Persistence (DB Worker)

- [x] 2.1 Add DB migration (bump `PRAGMA user_version`) to create `app_settings` table
- [x] 2.2 Add DB Worker settings actions to read/write locale (allowlist/normalize on write)
- [x] 2.3 Ensure reset/import flows do not accidentally delete locale preference (explicitly verify)

## 3. Main IPC + Preload + Window API

- [x] 3.1 Extend `shared/window-api.ts` with `settings.getLocaleState` + `settings.setLocale`
- [x] 3.2 Implement Preload bridge (`electron/preload.ts`) for `window.api.settings.*`
- [x] 3.3 Add Main IPC handlers (`electron/main.ts`) for `settings:getLocaleState` and `settings:setLocale` with sender + zod validation
- [x] 3.4 Cache effective locale in Main (optional optimization) and ensure Main always returns normalized allowlisted locale

## 4. Renderer Bootstrap & Providers

- [x] 4.1 Initialize i18next resources and provider wiring in the Renderer
- [x] 4.2 Bootstrap locale before initial React render (fallback to `en` on error)
- [x] 4.3 Set `<html lang="...">` to the effective locale

## 5. Settings UI (Language Selector)

- [x] 5.1 Add language selector to `src/pages/SettingsPage.tsx` (shows current locale + options)
- [x] 5.2 Persist selection via `window.api.settings.setLocale` and immediately update UI language
- [x] 5.3 Convert Settings page strings to translation keys

## 6. Localize Core UI Strings

- [x] 6.1 Convert navigation labels and shell strings (`src/app/AppShell.tsx`, command palette entry for Settings) to translation keys
- [x] 6.2 Convert Search page heading/placeholder and key toggles to translation keys
- [x] 6.3 Convert confirm/prompt messages used in pages and task editor to translation keys
- [x] 6.4 Normalize existing hardcoded Chinese fallbacks (e.g. "新建任务") to use i18n keys

## 7. Localize Main Native Dialogs

- [x] 7.1 Replace hardcoded export/import dialog titles in `electron/main.ts` with localized strings
- [x] 7.2 Localize dialog filter label "JSON" in Main based on effective locale
- [x] 7.3 Verify dialogs reflect locale changes without restart (trigger export/import after switching language)

## 8. SelfTest & Verification

- [x] 8.1 Force deterministic locale (`en`) in self-test mode to keep `src/app/selfTest.ts` stable
- [x] 8.2 Run typecheck and build to confirm no regressions (`npm run build`)
