## Why

In task edit mode, the content bottom bar currently switches to creation actions (e.g. `+ Task`, `+ Section`) and hides the global action group.
This makes common “edit” operations (move/delete) slower and forces users to leave the editor context.

## What Changes

- When a task editor is open (edit mode), the content bottom bar shows a dedicated action set: `Move`, `Delete`, `More`.
- Edit-mode bottom bar fully replaces other bottom bar buttons (it MUST NOT show `+ Task`, `+ Section`, `Schedule`, or `Search` while editing).
- Add a task soft-delete API end-to-end (`window.api.task.delete`), implemented as setting `deleted_at` (soft delete).
- `Delete` in edit mode uses confirmation and MUST flush any pending task editor changes before attempting delete.
- `More` is a placeholder: it is clickable but does not open a menu yet.

## Capabilities

### New Capabilities
- `task-soft-delete`: Soft-delete a task via a stable API and an edit-mode `Delete` action.

### Modified Capabilities
- `content-bottom-bar-actions`: Change behavior when a task editor is open (edit-mode action set) and update visibility rules for `Move`.
- `project-page`: Update bottom bar behavior on `/projects/:projectId` while a task editor is open (edit-mode action set replaces `+ Section`).

## Impact

- Renderer UI: `src/app/AppShell.tsx`, bottom bar actions, and self-test selectors for bottom bar actions.
- Renderer actions: reusing existing move popover logic; adding delete confirmation + close behavior.
- Cross-boundary API surface: `shared/window-api.ts`, `electron/preload.ts`, `electron/main.ts` IPC registrations.
- DB worker actions: add a business-level `task.delete` action implemented as soft delete (`deleted_at`).
- Localization: add message key(s) for `More`.
