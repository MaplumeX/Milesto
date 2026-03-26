## Why

Task metadata edits are currently spread across the inline editor and the content bottom bar. For mouse-first workflows, common triage actions such as setting a plan date, adjusting tags, editing a due date, or completing/restoring a task require extra navigation and are not consistently discoverable from the task row itself.

Adding a task-level context menu makes these actions direct and consistent across active lists, completed task lists, and Logbook task rows without expanding the list payload or introducing a second editing surface.

## What Changes

- Add a task row context menu that opens on right click / secondary click.
- Make the context menu available anywhere a task row is rendered for work management, including:
  - active task lists
  - completed task rows
  - Logbook task rows
- Keep the menu root intentionally small with exactly four actions:
  - `Plan` / `Schedule`
  - `Tags`
  - `Due`
  - `Complete` / `Restore`
- Open `Schedule` and `Due` in an anchored secondary panel with an embedded date picker and immediate persistence.
- Open `Tags` in an anchored secondary panel that lists existing tags only; checking or unchecking a tag saves immediately and keeps the panel open for additional changes.
- Persist `Complete` / `Restore` immediately and close the context menu after the action succeeds.
- Reuse existing task update/detail/tag APIs and lazy-load tag membership only when the tags panel is opened.
- Ensure opening the context menu coordinates with the existing inline task editor so the UI never leaves two task edit surfaces active at once.

## Capabilities

### New Capabilities
- `task-context-menu`: Right-click task row editing for plan date, existing tags, due date, and complete/restore across active, completed, and Logbook task surfaces.

### Modified Capabilities
- None.

## Impact

- Renderer UI:
  - task row entry points in task list, grouped list, project list, and Logbook list renderers
  - a new shared context menu / secondary panel flow for task row actions
  - selection and focus coordination with the existing inline editor
- Existing APIs reused:
  - `window.api.task.update`
  - `window.api.task.getDetail`
  - `window.api.task.setTags`
  - `window.api.task.toggleDone`
  - `window.api.tag.list`
- Existing systems affected:
  - `TaskSelectionContext` close-before-open flow
  - renderer refresh via `AppEventsContext.bumpRevision()`
  - list-row interaction behavior alongside virtualized lists and project drag-and-drop
- Verification:
  - renderer coverage for right-click open/close behavior, secondary panels, immediate save semantics, and compatibility with completed/Logbook task rows
