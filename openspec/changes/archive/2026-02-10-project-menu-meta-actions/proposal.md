## Why

The Project page overflow menu currently exposes low-leverage actions (area select, rename) while missing the actions users reach for most (complete, plan/schedule, due, move, tags, delete). Project metadata (schedule/due/tags) also has no clear, discoverable surface near the title.

This change makes project-level actions faster and more consistent by consolidating metadata editing into the existing overflow menu and surfacing the current values in a compact meta row below the title.

## What Changes

- Keep the existing Project page header structure (completion checkbox, editable title, overflow menu button), but place the overflow menu button closer to the title.
- Replace the contents of the Project overflow menu:
  - Remove current menu items (area select, rename, etc.).
  - Add actions: Complete/Reopen project, Plan (schedule) including Someday, Due date, Move (to Area/None), Tags, Delete.
- Add a Project meta row between the header and notes that displays:
  - Plan (schedule) value (Someday/Today/YYYY-MM-DD) with an inline clear (x) button.
  - Due value (YYYY-MM-DD) with an inline clear (x) button.
  - Tags as chips with per-tag remove (x) buttons.
- Ensure menu root view does not display metadata values; values are displayed in the meta row.
- Add missing backend capability for deleting a project (soft delete) with appropriate cascade.
- Extend the Project scheduling model to support a Someday state (project-level), analogous to tasks.

## Capabilities

### New Capabilities
- `project-metadata-actions`: Edit project plan (schedule with Someday), due date, and tags via the Project overflow menu; display these values in a meta row under the title with one-click clear/remove.
- `project-soft-delete`: Soft-delete projects from the Project page overflow menu, with confirmation and cascade to project tasks/sections.

### Modified Capabilities
- `project-page`: The Project page layout is extended to include a meta row between header and notes, and the overflow menu action set changes.

## Impact

- Renderer: `src/pages/ProjectPage.tsx` (header/menu/meta row), CSS reuse for chips/popovers, and i18n labels.
- Shared: `shared/schemas/project.ts` (project Someday scheduling + delete input), `shared/window-api.ts` (project.delete), `shared/i18n/messages.ts`.
- Electron: `electron/preload.ts` and `electron/main.ts` IPC handlers for `db:project.delete`.
- DB Worker: `electron/workers/db/actions/project-actions.ts` (implement `project.delete` cascade) and DB migration (`electron/workers/db/db-bootstrap.ts`) for project Someday scheduling state.
- QA: `src/app/selfTest.ts` may need updates if menu labels or DOM hooks change.
