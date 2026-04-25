# brainstorm: convert groups to projects

## Goal

Allow a project section/group to be converted into its own project, giving users the same promotion path that already exists for tasks.

## What I already know

* User wants groups to also be convertible into projects.
* Existing app has `task.convertToProject`, exposed from task context menus.
* The archived `task-to-project` PRD chose true conversion semantics: create the new project, move/derive child work, then remove the source item instead of duplicating it.
* Project-page groups are represented as `ProjectSection` rows in `project_sections`.
* Section headers already have a context menu through `useProjectSectionContextMenu`.
* Section context menu currently supports Move and Delete.
* Section move already moves the section and its tasks to another open project.
* Section delete currently moves tasks out of the section before soft-deleting the section.

## Assumptions (temporary)

* "Group" means a project section on the project detail page, not an Area group in the sidebar.
* The new project should use the section title as the project title.
* Tasks currently inside the section should become tasks in the new project.
* The source section should be removed from the original project after conversion.
* This feature should only be available in active scope, not trash scope.

## Open Questions

* None currently blocking.

## Requirements (evolving)

* Add a "Convert to Project" action to project section/group context menus.
* Convert an active project section into a new open project.
* MVP uses flattening conversion semantics:
  * create a new open project from the source section;
  * use the source section title as the new project title;
  * inherit relevant metadata from the parent project where applicable;
  * move all tasks from the source section into the new project's default unsectioned task list;
  * permanently remove the source section from the parent project after a successful conversion.
* Keep behavior consistent with `task.convertToProject` where practical.
* Navigate to the newly created project after conversion.
* Conversion must be atomic at the DB layer to avoid partial project creation or orphaned tasks/list positions.
* Conversion is only available for active sections, not trash scope.

## Acceptance Criteria (evolving)

* [ ] Right-clicking a section header shows "Convert to Project" in active project scope.
* [ ] Selecting the action creates a new open project.
* [ ] The new project title is derived from the section title.
* [ ] Tasks from the source section appear in the new project's default unsectioned list.
* [ ] The source section no longer appears in the source project.
* [ ] Source project section ordering remains compact and valid after conversion.
* [ ] Source and target task list ordering remains valid after conversion.
* [ ] The UI refreshes and navigates to the new project.
* [ ] The action is not available in trash scope.
* [ ] DB behavior is covered by tests.
* [ ] Renderer behavior is covered by tests.

## Definition of Done (team quality bar)

* Tests added or updated for DB and renderer behavior.
* Lint, typecheck, and relevant tests pass.
* Specs/context files are configured before implementation.
* Rollback behavior considered for partial conversion failures.

## Out of Scope (explicit)

* Converting Area/sidebar groups.
* Bulk conversion of multiple sections at once.
* Changing the existing task-to-project conversion behavior.
* New project nesting or parent/child project hierarchy.

## Technical Notes

* Existing DB action: `electron/workers/db/actions/task-actions.ts` handles `task.convertToProject`.
* Section DB actions live in `electron/workers/db/actions/project-actions.ts`.
* Existing section helpers include `listActiveSectionIds`, `compactActiveSectionPositions`, `listSectionTaskIdsInDisplayOrder`, and `replaceTaskListOrder`.
* Window API definitions live in `shared/window-api.ts`, preload bridge in `electron/preload.ts`.
* Section context menu lives in `src/features/tasks/use-project-section-context-menu.tsx`.
* Section header UI lives in `src/features/tasks/ProjectGroupedList.tsx`.
* Existing DB test reference: `tests/db/task-convert-to-project.test.ts`.
* Existing section context-menu renderer test reference: `tests/renderer/project-grouped-list.test.tsx`.
* Archived PRD reference: `.trellis/tasks/archive/2026-04/04-25-task-to-project/prd.md`.

## Expansion Sweep

### Future evolution

* This could later support converting a whole unsectioned task cluster or multiple selected sections, but MVP should stay single-section.
* If section-to-project keeps order metadata clean, later drag/drop or sync behavior can reuse the same section move/list-position contracts.

### Related scenarios

* The section context menu should remain consistent with existing Move and Delete actions.
* The behavior should align with task-to-project conversion by avoiding duplicate active work items.

### Failure and edge cases

* Conversion must be atomic: no half-created project, half-moved tasks, or orphaned section/list positions.
* Empty or untitled sections need a deterministic new project title.

## Feasible Approaches

### Approach A: Convert section into project and flatten tasks (selected)

* Create a new project from the section title and parent project metadata.
* Move all tasks from the source section into the new project's default unsectioned list.
* Soft-delete or purge the source section so it disappears from the parent project.
* Pros: simplest mental model; the section becomes the project, and its tasks become project tasks.
* Cons: if the source section itself was meaningful as an internal subheading, that structure is not preserved.

### Approach B: Convert section into project and preserve the section inside it

* Create a new project from the section title and parent project metadata.
* Move the source section into the new project and keep tasks under that section.
* Pros: preserves the exact source grouping and section task order.
* Cons: creates a project whose only section often repeats the project name, which may feel redundant.

## Decision (ADR-lite)

**Context**: A project section is already a container of tasks. Converting it to a project should avoid duplicated active work and follow existing task-to-project true conversion semantics.

**Decision**: Convert the source section into a new project and flatten its tasks into the new project's default unsectioned task list.

**Consequences**: This keeps the MVP simple and avoids a redundant "project with one section of the same name" shape. The implementation needs one atomic transaction that creates the project, moves section tasks, rewrites relevant list positions, records sync changes, compacts source section order, and removes the source section.

## Technical Approach

Add a typed `project.section.convertToProject` operation exposed through `window.api.project`.

The DB worker should handle conversion in one transaction:

* Load the active source section and parent project; reject missing, deleted, purged, trash-scope, or non-active cases.
* Insert a new open project with:
  * title from the source section title;
  * `area_id`, scheduling, someday, and due metadata inherited from the parent project where directly meaningful;
  * empty notes.
* Move all non-purged tasks from the source section to the new project with `section_id=null`.
* Preserve task display order by rewriting `list_positions` from the source section list to the new project's default list.
* Permanently remove the source section from the parent project and compact remaining source section positions.
* Record sync entity/list changes for the created project, moved tasks, deleted source section, source section order, and affected task list orders.

Renderer MVP:

* Add one "Convert to Project" action to the section right-click context menu.
* Hide the action in trash scope.
* On success, refresh app data and navigate to `/projects/:newProjectId`.
* On failure, show the typed error in the existing section context-menu error area.

## Implementation Plan

* Step 1: Add shared section convert input/result schemas plus `WindowApi` and preload wiring.
* Step 2: Implement transactional DB action and DB tests for task movement, list-position preservation, permanent source section removal, inherited metadata, empty/untitled sections, and rollback on invalid input.
* Step 3: Add section context-menu action, i18n labels, success navigation, and renderer test coverage.
* Step 4: Configure Trellis implementation/check context, then run focused tests plus project lint/typecheck or the closest available verification command.
