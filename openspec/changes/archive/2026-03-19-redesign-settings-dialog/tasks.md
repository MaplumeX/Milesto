## 1. Settings dialog shell

- [x] 1.1 Add settings open/close state and active-tab state to `AppShell`, and replace the sidebar `NavItem` settings entry with a button trigger
- [x] 1.2 Implement a centered `SettingsDialog` modal shell with scrim close, `Escape` close, focus trap, and focus restoration to the trigger
- [x] 1.3 Remove the `/settings` route from `AppRouter` and eliminate renderer code paths that depend on route navigation for opening Settings

## 2. General tab content

- [x] 2.1 Extract the non-sync settings content from `SettingsPage` into a `GeneralSettingsPanel`
- [x] 2.2 Re-layout the `General` tab into a compact two-column arrangement that contains language, theme, data transfer, and about sections
- [x] 2.3 Preserve existing language, theme, export/import, and reset behaviors inside the new `General` tab without changing their APIs

## 3. Sync tab content

- [x] 3.1 Refactor `SyncSettingsCard` into a `SyncSettingsPanel` that can render as tab content instead of a standalone page card
- [x] 3.2 Re-layout the `Sync` tab into a single-column flow with sync status above configuration fields and action controls
- [x] 3.3 Preserve existing sync validation, save, enable/disable, and manual sync behaviors in the new `Sync` tab

## 4. Copy, styling, and verification

- [x] 4.1 Update settings-related localization strings and labels to refer to the dialog and tabs where needed
- [x] 4.2 Add or update dialog-specific styles so the header stays fixed and the panel body scrolls independently on smaller windows
- [x] 4.3 Update `selfTest.ts` and any other affected UI checks to open Settings via the new modal trigger and verify close/focus behavior
