## Why

The current project completion checkbox is binary and does not convey how far a project is from completion. As projects grow, users need a fast, low-noise way to understand progress and act on completion/reopen without navigating into the Project page.

## What Changes

- Replace the Project page header completion checkbox with a circular progress indicator control that conveys per-project completion progress.
- Show the same progress control next to project titles in:
  - Sidebar open projects list
  - Area page project list
  - Logbook completed projects list
- Progress visual: a pie fill that starts at 12 o'clock and fills clockwise based on per-project task completion (0-100%).
- Interaction:
  - When project status is `open`, clicking the control prompts for confirmation and then completes the project (atomic project done + complete remaining open tasks).
  - When project status is `done`, clicking the control reopens the project (status `done` -> `open`) without restoring tasks.
  - Projects with zero tasks can still be completed (confirmation count = 0).
- Add a batch API to fetch per-project done/total task counts to support list rendering without N IPC calls.

## Capabilities

### New Capabilities
- `project-progress-indicator`: Defines a reusable project progress control (pie fill + done checkmark state), its state mapping, interaction rules (complete with confirm, reopen on click), and the batch counts API contract required to render it efficiently across lists.
- `logbook-page`: Defines Logbook page requirements needed for this change (render the project progress control alongside completed project titles).

### Modified Capabilities
- `project-page`: Project header completion control semantics change (progress indicator replaces checkbox; done state can be clicked to reopen).
- `area-page`: Area page project list renders the progress control alongside project titles.
- `sidebar-project-area-dnd`: Sidebar project rows include an additional focusable control; manual ordering behaviors must remain correct (including keyboard reorder while focus is on the control).

## Impact

- Renderer UI:
  - `src/pages/ProjectPage.tsx` (header control)
  - `src/app/AppShell.tsx` (sidebar project rows)
  - `src/pages/AreaPage.tsx` (area project list)
  - `src/pages/LogbookPage.tsx` (completed projects list)
  - New shared UI primitive for the progress control + styling in `src/index.css`
- IPC + schemas:
  - `shared/schemas/*` (new batch counts schema)
  - `shared/window-api.ts` (new API surface)
  - `electron/preload.ts`, `electron/main.ts` (new IPC handler)
- DB worker:
  - `electron/workers/db/actions/task-actions.ts` (batch counts query)
- Performance: list views must fetch counts in bulk and render without per-row IPC.
