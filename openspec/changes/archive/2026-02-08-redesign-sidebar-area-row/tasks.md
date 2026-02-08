## 1. Specs To Code Mapping

- [x] 1.1 Identify all Sidebar render + style touchpoints (`src/app/AppShell.tsx`, `src/index.css`, `src/app/selfTest.ts`) and confirm current selectors used for keyboard reorder and self-test.
- [x] 1.2 Decide and document the row-level data-attribute contract used to resolve “owning row” from any focused descendant (Area link vs collapse button).

## 2. Settings Persistence (Collapsed Areas)

- [x] 2.1 Extend `shared/window-api.ts` to add typed `window.api.settings.getSidebarState()` / `setSidebarState()` methods.
- [x] 2.2 Expose the new methods in `electron/preload.ts` and keep the surface business-level (no generic get/set).
- [x] 2.3 Add `settings:getSidebarState` / `settings:setSidebarState` IPC handlers in `electron/main.ts` with trusted-sender checks and zod validation.
- [x] 2.4 Implement DB worker actions to read/write `app_settings` key `sidebar.collapsedAreaIds` as JSON `string[]` (safe parse + fallback).
- [x] 2.5 Verify persistence flow end-to-end by calling set/get from renderer code paths (and add a minimal self-test assertion via `window.api.settings.getSidebarState`).

## 3. Sidebar Area Row Redesign (Folder + Collapse)

- [x] 3.1 Update `SortableSidebarAreaGroup` markup to render an Area header as a row-style entry consistent with `.nav-item`, including a leading folder icon.
- [x] 3.2 Add a dedicated collapse/expand button per Area with `aria-expanded` and an i18n-backed `aria-label`; ensure it does not navigate.
- [x] 3.3 Implement per-Area collapsed state in `src/app/AppShell.tsx` and wire it to hide/show the nested Project list.
- [x] 3.4 Load initial collapsed state on app start and persist updates on toggle using the new settings API.
- [x] 3.5 Add minimal CSS for the Area row layout (icon spacing, right-aligned collapse affordance) while preserving existing Sidebar visual language.

## 4. Keyboard Reorder From Any Focusable Control

- [x] 4.1 Update `handleSidebarKeyDown` in `src/app/AppShell.tsx` to resolve the owning row when focus is on a descendant control (e.g., Area collapse button).
- [x] 4.2 Update `focusSidebarRowByDndId` to reliably restore focus to the row activator element after reorder.
- [x] 4.3 Ensure existing keyboard reorder behavior for Project rows remains unchanged.

## 5. Self-Test Updates

- [x] 5.1 Update Sidebar Area handle selectors in `src/app/selfTest.ts` to match the new Area header row structure.
- [x] 5.2 Add/adjust self-test coverage so that collapsing an Area hides its nested Projects and does not break Sidebar reorder shortcuts.

## 6. Verification

- [x] 6.1 Run typecheck (`npx tsc -p tsconfig.json`).
- [x] 6.2 Run the app and manually verify: collapse/expand, persistence across restart, drag-and-drop still works, and keyboard reorder works from both the Area row and collapse button focus.
