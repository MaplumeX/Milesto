## Why

Project sections are currently created from the Project overflow menu via a modal `prompt()`. This is hard to discover, interrupts flow, and does not match the “inline, keyboard-first” interaction style of the rest of the Project page.

At the same time, the “no section” group header adds visual noise at the top of the Project task list, even though it does not represent a real section.

## What Changes

- Move **Create Section** entrypoint from the Project overflow menu to the global content bottom bar when viewing `/projects/:projectId`.
- Clicking `+ Section` SHALL immediately create a new section (persisted) and enter inline title editing for that section header.
- Allow project sections to have an empty-string title (persisted). UI SHALL render a placeholder label for empty titles.
- Remove the dedicated visual “no section” group header on the Project page. Tasks without `section_id` remain visible but render without an extra header row.
- Remove `+ Section` from the Project overflow menu.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-page`: section creation entrypoint + inline edit behavior, no-section header presentation, and empty-title section display.

## Impact

- Renderer UI:
  - `src/app/AppShell.tsx` (bottom bar adds `+ Section` on project routes)
  - `src/pages/ProjectPage.tsx` (remove menu action; handle create+focus inline edit)
  - `src/features/tasks/ProjectGroupedList.tsx` (remove no-section header; support inline section title editing row)
  - `src/features/tasks/TaskDetailPanel.tsx` and `src/features/tasks/TaskEditorPaper.tsx` (section dropdown placeholder for empty titles)
  - `src/index.css` (styling for section title input / placeholder, if needed)

- Shared schema validation (cross-process):
  - `shared/schemas/project.ts` (allow empty string titles for `ProjectSectionSchema` and create/rename inputs)
