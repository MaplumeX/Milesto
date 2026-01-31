## Why

The current Project page UI is fragmented (area selector, title, tasks, sections/actions live in separate blocks) and does not match the interaction quality of the main task lists. It also lacks an on-page Project notes surface and cannot show completed tasks in context after completing a project.

## What Changes

- Redesign the Project page into a single, predictable hierarchy: header (project status + title + overflow menu) -> notes -> tasks.
- Add a project-level completion checkbox in the header that marks the project as done and completes all tasks in that project (with a confirmation step).
- Keep the user on the Project page after completion even though the project may disappear from the sidebar (open-project-only).
- Display project tasks grouped by section, including completed tasks.
- Add a default-collapsed "Completed (N)" toggle (no persistence) to show/hide completed tasks within the Project task area.
- Add a Project notes section below the header (editable, multi-line).
- Consolidate existing Project actions (rename, move to area, new section, etc.) into a header overflow menu.

## Capabilities

### New Capabilities
- `project-page`: Defines the Project page layout (header/notes/tasks), section grouping rules (including empty sections), and completed-task collapse/expand behavior.
- `project-bulk-complete`: Defines the atomic semantics of completing a project (project done + all tasks done) with a confirmation requirement, and the non-symmetric reopen behavior (reopen project does not restore tasks).

### Modified Capabilities
- (none)

## Impact

- Renderer: `src/pages/ProjectPage.tsx` (layout and interactions), plus any shared UI primitives needed for menu/confirmation.
- IPC API surface: `shared/window-api.ts`, `electron/preload.ts`, `electron/main.ts`.
- DB worker actions: `electron/workers/db/actions/project-actions.ts` and/or `electron/workers/db/actions/task-actions.ts` (new atomic bulk-complete action; project task listing that can include done tasks).
- No new external dependencies are required for the initial change.
