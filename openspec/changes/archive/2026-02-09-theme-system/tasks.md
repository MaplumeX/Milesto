## 1. Models, Schemas, and Settings Storage

- [x] 1.1 Define `ThemePreference` model (`system` | `light` | `dark`) and any shared result types
- [x] 1.2 Add DB worker settings actions to get/set theme preference in `app_settings` (key `theme.preference`)
- [x] 1.3 Add Zod validation for theme preference payloads and persisted values (allowlist)

## 2. Main Process Integration (nativeTheme + Startup)

- [x] 2.1 Add Main resolver for theme preference/effective theme (self-test forces deterministic theme)
- [x] 2.2 Apply `nativeTheme.themeSource` before creating the BrowserWindow
- [x] 2.3 Set `BrowserWindow` `backgroundColor` based on effective theme to minimize startup flash
- [x] 2.4 Add Main IPC handlers: `settings:getThemeState` and `settings:setThemePreference` (validate sender + payload)

## 3. Preload + Window API

 - [x] 3.1 Extend `shared/window-api.ts` settings API with theme get/set methods
 - [x] 3.2 Expose theme APIs via `electron/preload.ts` (request/response invoke only)

## 4. Renderer: Settings UI + State

- [x] 4.1 Add Theme selector card to `src/pages/SettingsPage.tsx` (system/light/dark)
- [x] 4.2 Load theme state on SettingsPage mount and handle error display consistently
- [x] 4.3 Persist selection via `window.api.settings.setThemePreference` and update local UI state

## 5. Renderer: Theme Tokens and CSS Migration

- [x] 5.1 Update `src/index.css` to declare support for `color-scheme: light dark`
- [x] 5.2 Add dark token overrides using `@media (prefers-color-scheme: dark)`
- [x] 5.3 Introduce derived tokens for wash/glass/scrim/shadows and migrate high-impact selectors away from hardcoded `rgba(...)`
- [x] 5.4 Update background gradient and overlay noise behavior for dark mode (avoid muddy blend)
- [x] 5.5 Update `react-day-picker` scoped variables to respect the effective theme

## 6. Self-Test and Verification

- [x] 6.1 Ensure self-test mode uses deterministic theme to avoid flakiness
- [x] 6.2 Add/adjust self-test assertions for theme preference persistence and Settings behavior
- [ ] 6.3 Manual smoke test: switch theme preference (light/dark/system), restart app, and verify no startup flash
