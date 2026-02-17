## Why

The current Logbook UI is split into separate task and project sections and does not surface completion dates inline, which makes it slow to scan and hard to use as a monthly review.

We want Logbook to feel like a quiet, chronological record: a single place to review what was completed, grouped by month, with the completion date visible at a glance.

## What Changes

- Group completed entries by completion month (local time), ordered by most recent month first.
- Merge completed tasks and completed projects into a single Logbook list (no task/project split sections).
- Remove the separate "Completed Projects" block from the Logbook page.
- Remove strikethrough styling in Logbook; completed state is indicated by the left status control and muted styling only.
- Remove the per-row Restore button in Logbook.
- Keep Logbook "recycle" capability by making the left status control interactive:
  - Tasks: toggle the checkbox to restore (done -> open).
  - Projects: use the project progress control to reopen (done -> open).
- Display the completion date between the status control and the title for every entry.
  - Date format: month/day (e.g., 2/17).
- Month header labeling:
  - Current year: show month only (e.g., 12月).
  - Non-current year: include year (e.g., 2025年12月).
- Preserve the constraint that the project progress control is not nested inside the project title navigation link.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `logbook-page`: Redefine the Logbook page as a month-grouped, mixed (tasks + projects) completed list with inline completion dates and status-control-based restore/reopen affordances; remove strikethrough and remove the Restore button.

## Impact

- Renderer: `src/pages/LogbookPage.tsx` and new/updated list components to render grouped mixed entries.
- Task list UI: may bypass or extend `src/features/tasks/TaskList.tsx` / `src/features/tasks/TaskRow.tsx` to support the date column and Logbook-specific done styling.
- Styles: Logbook-specific styling to ensure no line-through is applied in Logbook.
- Localization: update or remove usage of `logbook.completedProjects` and add any new labels needed for month headers.
- Self-test: update Logbook assertions in `src/app/selfTest.ts` that currently depend on the "Completed Projects" block structure.
- Specs: update `openspec/specs/logbook-page/spec.md` to reflect the new Logbook structure and requirements.
