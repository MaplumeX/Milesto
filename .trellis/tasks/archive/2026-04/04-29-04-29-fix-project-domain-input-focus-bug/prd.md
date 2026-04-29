# Fix Project and Area Title Input Focus

## Goal

Fix an intermittent renderer bug where newly created Project/Area pages, or Project/Area pages reached after switching between entities, fail to let the user click the title input/title control to enter or continue editing.

## What I Already Know

* The user reports that after creating a project or area, the title input sometimes cannot be clicked to enter editing.
* The user also reports that switching between different projects/areas can leave title inputs on different entities unable to enter editing.
* Project and Area page titles are edited inline in `ProjectPage` and `AreaPage`.
* Creating a project/area navigates to `/projects/:id?editTitle=1` or `/areas/:id?editTitle=1`.
* `ProjectPage` and `AreaPage` currently suppress auto-title-edit if `hasUserInteractedRef.current` is true.
* User interaction is currently marked through capture-phase global `pointerdown` and `keydown` listeners, which may fire before the new route consumes `editTitle=1`.
* Sidebar Project/Area rows also use inline title inputs and dnd click suppression.

## Assumptions

* "领域" maps to the existing Area domain object and `/areas/:areaId` route.
* The intended behavior is that create-to-edit should reliably focus the new Project/Area title input without requiring a second action.
* Manual clicking a Project/Area title on an existing page should always enter edit mode unless another control intentionally owns the click.

## Requirements

* Creating a Project from the shell new menu must navigate to the Project page and reliably focus/select the page title input.
* Creating an Area from the shell new menu must navigate to the Area page and reliably focus/select the page title input.
* Creating a Project from an Area page bottom action must navigate to the Project page and reliably focus/select the page title input.
* Switching between Project/Area pages must not poison title edit state for later entities.
* Clicking a Project or Area page title button after navigation must enter inline title editing.
* The fix must preserve IME-safe Enter handling, Escape cancel behavior, blur commit behavior, sidebar drag/reorder behavior, and focus restoration expectations.

## Acceptance Criteria

* [ ] A renderer test covers create/navigate with `?editTitle=1` for Project title focus.
* [ ] A renderer test covers create/navigate with `?editTitle=1` for Area title focus.
* [ ] A renderer test or focused regression test covers clicking title controls after switching entities.
* [ ] Existing renderer tests remain green for project/area title editing and sidebar navigation.
* [ ] `npm run lint` and relevant renderer tests pass.

## Definition of Done

* Tests added or updated for the regression.
* Lint/typecheck or project build checks run as appropriate for this repo.
* No unrelated refactors or styling churn.
* Any new reusable focus/editing convention is recorded in specs if it is broadly useful.

## Out of Scope

* Redesigning Project/Area title UI.
* Changing persistence semantics for empty Project/Area titles.
* Reworking sidebar drag-and-drop behavior beyond what is necessary for this focus bug.
* Adding a new global state library or router abstraction.

## Technical Notes

* Likely affected files include `src/pages/ProjectPage.tsx`, `src/pages/AreaPage.tsx`, `src/app/AppShell.tsx`, and renderer tests under `tests/renderer/`.
* Relevant frontend specs: `.trellis/spec/frontend/index.md`, `component-guidelines.md`, `state-management.md`, and `quality-guidelines.md`.
* The existing global interaction guard in Project/Area title auto-edit logic is suspicious because the create button click can set `hasUserInteractedRef` before the destination page processes `editTitle=1`.
