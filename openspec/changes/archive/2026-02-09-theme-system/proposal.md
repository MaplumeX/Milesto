## Why

Milesto currently hardcodes a light-only visual system, which prevents users from using the app comfortably in dark environments and makes the UI inconsistent with OS appearance settings.

This change introduces a first-class theme preference (light/dark/system) that is applied deterministically on startup and can follow OS changes automatically.

## What Changes

- Add a theme preference with 3 modes: `system`, `light`, `dark`.
- Add a Settings control to view and change the theme preference.
- Persist the theme preference in app settings so it survives restarts.
- Resolve and apply the effective theme early in the Main process to avoid startup flash.
- Update renderer styling tokens so core UI renders correctly under both light and dark color schemes.

## Capabilities

### New Capabilities
- `app-theme-preference`: Theme preference model (system/light/dark), Settings UI, persistence, effective theme resolution, and auto-follow behavior.

### Modified Capabilities
- 

## Impact

- Electron Main: apply `nativeTheme.themeSource` before window creation; set `BrowserWindow` background to reduce first-paint flash.
- Preload/window API: extend `window.api.settings.*` to get/set theme preference.
- DB Worker: store/read the preference via the existing `app_settings` key/value store.
- Renderer: add Settings UI control; update `src/index.css` tokens and replace hardcoded light-only color values where required.
