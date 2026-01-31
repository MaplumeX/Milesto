## 1. Schema + Shared Types

- [x] 1.1 Update `shared/schemas/project.ts` to allow empty-string titles for project sections (schema + create/rename inputs)
- [x] 1.2 Audit any downstream parse/validation sites for `ProjectSectionSchema` (main/worker) and confirm they remain consistent

## 2. Bottom Bar Entry Point

- [x] 2.1 Update `src/app/AppShell.tsx` to show `+ Section` in `.content-bottom-bar` only when route matches `/projects/:projectId`
- [x] 2.2 Implement a scoped signaling mechanism from `AppShell` to `ProjectPage` to initiate section creation (e.g. CustomEvent with projectId)

## 3. Project Page + Section Creation Flow

- [x] 3.1 Remove `+ Section` action from `ProjectMenu` in `src/pages/ProjectPage.tsx`
- [x] 3.2 On `+ Section` trigger: call `window.api.project.createSection(projectId, '')`, refresh sections, and enter inline edit for the new section header
- [x] 3.3 Define keyboard behavior for inline section title edit (Enter commit rename, Escape cancel)
- [x] 3.4 Move the Completed toggle control below the full Project grouped list (after all sections)

## 4. Grouped List Presentation

- [x] 4.1 Update `src/features/tasks/ProjectGroupedList.tsx` to remove the no-section group header row while keeping ungrouped tasks visible at the top
- [x] 4.2 Add inline section title editor rendering for the “editing section” header row, including focus management and event propagation control
- [x] 4.3 Ensure virtualized row measurement remains correct after entering/exiting edit mode

## 5. Placeholder Rendering for Untitled Sections

- [x] 5.1 Update Project page section header title rendering to show `(untitled)` when title is empty
- [x] 5.2 Update task editor section dropdowns to show `(untitled)` when title is empty:
  - `src/features/tasks/TaskDetailPanel.tsx`
  - `src/features/tasks/TaskEditorPaper.tsx`

## 6. Verification

- [x] 6.1 Run `npx tsc -p tsconfig.json`
- [x] 6.2 Run `npm run build`
- [ ] 6.3 Manually verify: create section from bottom bar, inline edit works, Escape cancels but section remains, no-section header removed
