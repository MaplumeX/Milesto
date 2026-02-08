## Why

The content bottom bar is currently limited to creation affordances (`+ Task`, and `+ Section` on Project pages) and a keyboard hint for the command palette. For mouse-first workflows, there is no consistent, contextual place to schedule a task, move it between buckets/areas/projects, or open search from the content area.

Adding these actions to the content bottom bar improves discoverability and makes common task triage actions available without relying on shortcuts.

## What Changes

- Add a new action group to the content bottom bar with three buttons: `Schedule`, `Move`, `Search`.
- `Schedule` and `Move` are only enabled when a task is selected.
- The `Schedule` button opens an anchored popover at the button to edit the selected task's schedule state.
- The `Move` button opens an anchored popover at the button to move the selected task to another Area or Project.
  - Moving to an Area clears `project_id` and `section_id`.
  - Moving to a Project clears `area_id` and `section_id`.
  - Section selection is not part of this change.
- The `Search` button opens a floating search UI (reusing the existing Command Palette overlay pattern).
- When a task editor is open (`openTaskId != null`), the bottom bar does not show this new action group (a different editor-specific action group may be added later).

## Capabilities

### New Capabilities
- `content-bottom-bar-actions`: Bottom bar action group for scheduling/moving/searching tasks (visibility + enablement rules, popover/overlay interactions).

### Modified Capabilities
- `project-page`: The global content bottom bar gains additional actions when no task editor is open.
- `task-bucket-flags`: Moving a task via the bottom bar MUST apply the same bucket normalization rules (e.g. moving to Project clears inbox state) and defines move semantics for Area vs Project.

## Impact

- Renderer UI:
  - `src/app/AppShell.tsx` (render bottom bar action group; wire to selection/open state)
  - `src/app/CommandPalette.tsx` (expose an open trigger for button click, likely via a custom event)
  - `src/index.css` (minor styling additions for the new bottom bar action group and popovers)
- Existing state and APIs reused:
  - `TaskSelectionContext` (`selectedTaskId`, `openTaskId`)
  - `window.api.task.update` for schedule and move operations
  - `window.api.sidebar.listModel` / `window.api.area.list` / `window.api.project.listOpen` to populate move destinations
- Testing/verification:
  - Update or extend `src/app/selfTest.ts` to cover the new bottom bar behaviors (visibility gating, disabled states, popover open/close).
