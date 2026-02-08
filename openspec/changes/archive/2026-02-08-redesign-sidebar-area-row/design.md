## Context

- Sidebar Areas/Projects are rendered in `src/app/AppShell.tsx` using `SortableSidebarAreaGroup` (Area header + nested Projects) and `SortableSidebarProjectNavItem` (Project rows).
- Project rows use `.nav-item` styles (block row with padding/hover/active). Area headers currently use `.nav-area-title` styles (muted, inline text).
- Sidebar supports pointer + keyboard reordering via dnd-kit and `handleSidebarKeyDown` (Cmd/Ctrl+Shift+ArrowUp/ArrowDown).
- There is no existing icon system in the renderer; introducing a folder icon should use a small inline SVG.
- Settings persistence exists and is stored in SQLite `app_settings` via Renderer -> Main IPC -> DB Worker actions (currently used for locale).

Key constraints:
- Do not nest a `<button>` inside the `<a>` rendered by `NavLink`.
- Preserve dnd-kit drag activator behavior for Area and Project rows.
- Keep keyboard reorder working even when focus is on the Area collapse button.

## Goals / Non-Goals

**Goals:**
- Render each Area header as a row-like entry consistent with Project rows, including a leading folder icon and a trailing collapse/expand button.
- Add per-Area collapsed state that hides/shows the nested Project list.
- Persist collapsed state across restarts via the existing settings pipeline and `app_settings`.
- Ensure keyboard reorder shortcuts work when focus is within a Sidebar row surface (including the new collapse button).

**Non-Goals:**
- Redesign the entire Sidebar IA, typography, or color system.
- Introduce a general-purpose icon framework or third-party icon dependency.
- Change the underlying Sidebar list model shape returned from the DB for Areas/Projects.

## Decisions

### Persist collapsed Areas as a settings key

**Decision:** Store collapsed Area IDs under `app_settings.key = 'sidebar.collapsedAreaIds'` with `value` as a JSON-encoded `string[]`.

**Rationale:**
- Matches the existing settings architecture (locale preference) and keeps persistence out of the renderer.
- Requires no new DB tables and minimal migration risk (new key defaults to empty).

**Alternatives considered:**
- LocalStorage in renderer: rejected (no existing usage; violates the project’s boundary expectations).
- New dedicated table for sidebar prefs: rejected (unnecessary complexity for a small preference set).

### Add a dedicated settings API for Sidebar state

**Decision:** Add `window.api.settings.getSidebarState()` / `setSidebarState()` rather than generic key-value getters/setters.

**Rationale:**
- Avoids exposing a low-level “settings primitive” that is easy to abuse.
- Keeps payload/return values schema-validated and narrowly scoped.

### Sidebar row identification for keyboard reorder

**Decision:** Introduce a row-level data attribute contract for keyboard reorder resolution:
- A stable row identifier that can be discovered from any focused descendant (including the collapse button).
- A stable “focus activator” element to receive focus after reorder.

**Concrete contract (implemented in code):**
- Row root element (must wrap *all* focusable descendants in that row):
  - `data-sidebar-dnd-kind="area" | "project"`
  - `data-sidebar-dnd-id="area:<id>" | "project:<id>"`
- Row activator element (the element to focus after reorder; typically the `NavLink`):
  - `data-sidebar-row-activator="true"`

This ensures `handleSidebarKeyDown` can always resolve the owning row via `closest('[data-sidebar-dnd-kind][data-sidebar-dnd-id]')`, even when focus is on a descendant control (e.g., the Area collapse button).

**Rationale:**
- Current implementation discovers rows via `[data-sidebar-dnd-kind][data-sidebar-dnd-id]`, which breaks when focus moves to a sibling button.
- Avoids duplicating dnd attributes across multiple elements and keeps focus deterministic.

**Alternatives considered:**
- Make collapse button non-focusable: rejected (keyboard-first requirement).
- Duplicate `data-sidebar-dnd-*` onto the collapse button: rejected (risks confusing focus targeting and future selectors).

### Folder icon implementation

**Decision:** Use an inline SVG folder icon with `width/height="1em"`, `stroke="currentColor"`, `fill="none"`, and `aria-hidden="true"`.

**Rationale:**
- No icon library exists in the codebase.
- `currentColor` ensures the icon inherits hover/active state color changes automatically.

## Risks / Trade-offs

- **Risk:** Focus behavior becomes inconsistent after keyboard reorder. → **Mitigation:** Always focus the row activator element (NavLink) via an explicit selector contract; add self-test coverage.
- **Risk:** Collapse button interferes with drag activation. → **Mitigation:** Keep dnd-kit listeners/activator on the NavLink only; button uses `stopPropagation` for click/pointer as needed.
- **Risk:** Persisted settings value becomes corrupted or incompatible. → **Mitigation:** Strict parse with safe fallback to empty set; ignore unknown IDs.
- **Trade-off:** More DOM structure per Area row. → **Mitigation:** Keep markup minimal; collapsing reduces nested Project DOM.

## Migration Plan

- No DB migration required if `app_settings` already exists.
- Introduce the new key `sidebar.collapsedAreaIds`; absence implies default (all expanded).
- Ship with safe parsing so older app versions and self-test runs do not crash on unexpected values.

## Open Questions

- Should collapsing an Area also affect drag/drop hit targets for moving Projects into that Area (e.g., allow dropping onto the Area header row when collapsed)?
- Should collapse state be restored before or after the Sidebar model is loaded (i.e., does initial render briefly flash expanded content)?
