## Why

Project section (group header) rows in the Project page are currently not part of keyboard selection/navigation, and existing sections cannot be entered into inline rename via Return/double-click the way task rows can. This creates an inconsistent interaction model and makes section organization slower, especially for keyboard-first workflows.

## What Changes

- Project page grouping headers (project sections) become selectable list rows (in addition to task rows).
- Keyboard navigation (ArrowUp/ArrowDown) in the Project listbox includes section header rows and task rows (no longer skipping section headers).
- Clicking a section header selects that section and clears task selection.
- Pressing Return/Enter on a selected section header enters inline title editing for that section.
- Double-clicking a section header title enters inline title editing for that section.
- Entering section title edit MUST safely close an open task inline editor first (flush drafts; if flush fails, do not enter section edit and keep focus on the error target).

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `project-page`: Define section header selection + keyboard navigation + inline rename entry semantics, including how section selection interacts with task selection and open task editors.

## Impact

- UI: `src/features/tasks/ProjectGroupedList.tsx` (row selection model, keyboard handler, group row click/dblclick)
- Page state: `src/pages/ProjectPage.tsx` (enter section edit for existing sections)
- Selection/editor coordination: `src/features/tasks/TaskSelectionContext.tsx`, `src/app/AppShell.tsx` (safe close/flush API for open task editor)
- Styles: `src/index.css` (selected state for `.project-group-header`)
- Self-test: `src/app/selfTest.ts` (new coverage for selecting section rows + Enter to edit)
