## Why

The Sidebar currently renders Area headers as muted, non-row text, which makes Areas feel inconsistent with Project rows and makes the intended “Area group” interaction (collapse/expand) unclear.

We need an Area row that visually matches Project rows, provides an explicit collapse affordance, and persists the collapsed state across app restarts while keeping keyboard reordering reliable (even when focus is on the collapse button).

## What Changes

- Redesign Sidebar Area header into a row-style entry similar to Project rows, including a leading folder icon and a trailing collapse/expand button.
- Add per-Area collapse state that controls whether the Area’s nested Project list is shown.
- Persist the collapsed Area state across restarts using the existing settings persistence flow (Renderer -> Main -> DB Worker -> `app_settings`).
- Ensure the keyboard reorder shortcut for Sidebar Areas/Projects continues to work when focus is on any focusable control within a row (including the Area collapse button).

## Capabilities

### New Capabilities
- `sidebar-area-collapse`: Areas in the Sidebar can be collapsed/expanded via a dedicated control; the collapsed state is persisted across restarts.

### Modified Capabilities
- `sidebar-project-area-dnd`: Keyboard reordering MUST work when focus is within the Sidebar row surface, including on the new Area collapse button.

## Impact

- Renderer: Sidebar markup, styling, and keyboard handling in `src/app/AppShell.tsx` and `src/index.css`.
- Settings API surface: new `window.api.settings.*` calls for Sidebar state.
- Main IPC: new `settings:*` handlers with payload/return validation.
- DB Worker: new settings actions that read/write `app_settings` for `sidebar.collapsedAreaIds`.
- Self-test: update selectors/flows in `src/app/selfTest.ts` that currently target `.nav-area-title`.
