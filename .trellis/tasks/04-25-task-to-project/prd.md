# brainstorm: task to project

## Goal

Allow an existing task to be converted into a project so that work that starts small can be promoted into a higher-level planning and tracking unit when its scope grows.

## What I already know

* User wants to start a new task.
* User wants tasks to be able to turn into projects.
* Milesto is an Electron + React + SQLite desktop task manager inspired by Things.
* `Task` and `Project` are separate persisted entities with shared planning fields (`title`, `notes`, `scheduled_at`, `is_someday`, `due_at`, `area_id`) and separate tag relation tables.
* Tasks can have checklist items; projects can contain project sections and child tasks.
* Planning views already support mixed task/project rows via `ViewListItem` and `view_positions`.

## Assumptions (temporary)

* "Task" and "Project" are existing domain concepts in the app.
* Conversion should preserve meaningful task data instead of forcing users to recreate it.
* The expected behavior may involve UI, persistence, and possibly sync/export flows.
* MVP should be a single-task conversion, not bulk conversion.
* MVP should run only for active tasks, not tasks in Trash.

## Open Questions

* None currently blocking.

## Requirements (evolving)

* A task can be promoted or converted into a project.
* MVP uses true conversion semantics:
  * create a project from the source task;
  * copy direct project fields from the source task (`title`, `notes`, planning fields, area, tags);
  * convert checklist items into child tasks under the new project;
  * delete the source task after conversion.
* Source task deletion should use permanent purge semantics: it should not enter Trash and should not be restorable.
* Tasks that already belong to a project are convertible in the MVP.
* When converting a task that belongs to a project, the new project should inherit the parent project's `area_id`.
* When converting a task that does not belong to a project, the new project should use the source task's direct `area_id`.
* MVP exposes conversion from the task right-click context menu only.
* Conversion should be atomic at the DB layer to avoid a half-created project or half-mutated source task.
* Conversion should preserve common planning metadata where there is a direct project equivalent.

## Acceptance Criteria (evolving)

* [x] User can initiate conversion from an appropriate task surface.
* [x] Converted project contains the expected data from the source task.
* [x] The system handles the source task state consistently after conversion.
* [x] The source task is permanently purged after a successful conversion and no longer appears in active task lists or Trash.
* [x] A source task inside a project can be converted into a new project.
* [x] A project-task conversion inherits the source task's parent project area.
* [x] Conversion is available from the task right-click context menu.
* [x] Conversion is not added to the task editor in MVP.
* [x] Conversion failure returns a typed `Result` error and does not partially mutate the DB.
* [x] A successful conversion refreshes affected lists and navigates or exposes the new project predictably.

## Definition of Done (team quality bar)

* Tests added/updated where appropriate.
* Lint / typecheck / CI green.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Technical Approach

Add a typed `task.convertToProject` operation exposed through `window.api.task`.

The DB worker should handle conversion in one transaction:

* Load the active source task and reject missing, deleted, or purged tasks.
* Resolve the new project `area_id`:
  * if source task has `project_id`, inherit that parent project's `area_id`;
  * otherwise use the source task's direct `area_id`.
* Insert a new project with source task `title`, `notes`, `scheduled_at`, `is_someday`, `due_at`, and resolved `area_id`.
* Copy source task tags into `project_tags` preserving their existing order.
* Convert each source checklist item into a child task under the new project:
  * checklist item title becomes child task title;
  * checked items become `done` child tasks; unchecked items become `open` child tasks;
  * child task order follows checklist item position.
* Permanently purge the source task with app tombstone semantics by setting both `deleted_at` and `purged_at`.

Renderer MVP:

* Add one "Convert to Project" action to the task right-click context menu.
* On success, refresh app data and navigate to the new project page.
* On failure, show the typed error in the existing context-menu error area.

## Implementation Plan

* Step 1: Add shared convert input/result schemas and `WindowApi`/preload wiring.
* Step 2: Implement transactional DB action and DB tests for standalone tasks, project tasks, tags, checklist conversion, purge behavior, and rollback on invalid input.
* Step 3: Add the right-click menu item, i18n labels, success navigation, and renderer test coverage.
* Step 4: Run focused DB/renderer tests plus typecheck/build or the closest available verification command.

## Out of Scope (explicit)

* Full project-management redesign.
* Bulk converting multiple tasks at once unless confirmed as MVP.
* New nested project model.
* Trash-scope conversion unless confirmed.
* Task-editor conversion entry point.

## Technical Notes

* Likely cross-layer files:
  * `shared/schemas/task.ts` or a new shared schema for convert input/result.
  * `shared/window-api.ts` for typed renderer API.
  * `electron/preload.ts` for `window.api` exposure.
  * `electron/workers/db/actions/task-actions.ts` and/or `project-actions.ts` for the transaction.
  * `src/features/tasks/use-task-context-menu.tsx` for task list context-menu action.
  * `shared/i18n/messages.ts` for English and Simplified Chinese labels.
  * `tests/db/*` and `tests/renderer/*` for behavior coverage.
* Existing schemas enforce bucket invariants:
  * task `is_inbox=true` requires `project_id`, `scheduled_at` null and `is_someday=false`;
  * task/project `is_someday=true` requires `scheduled_at=null`.
* Existing `project.create` only creates a project shell; it does not copy task tags/checklist or mutate the source task.
* Existing `task.delete` soft-deletes the task by setting `deleted_at`; Trash purge is a separate flow.
* Existing Trash purge/empty semantics update `purged_at` as a tombstone; they are permanent from the app UX perspective but not physical SQL row deletion.
* Existing `project.delete` soft-deletes a project plus child tasks/sections, so conversion should avoid reusing delete semantics blindly.
* For source tasks inside projects, conversion must query the parent project to determine inherited `area_id`.
* Existing renderer pattern: mutate through `window.api`, then `bumpRevision()` or refresh owner state.
* Existing quality rules require shared Zod schemas for cross-process contracts and typed `WindowApi` mocks in tests.

## Feasible Approaches

### Approach A: Promote and replace source task (recommended if user expects true conversion)

* Create a project from the task title/notes/planning metadata/tags.
* Convert checklist items into child tasks in the new project.
* Permanently purge the original task after the project is created.
* Pros: matches the mental model of "this task became a project"; avoids duplicate work items.
* Cons: needs clear rollback/undo expectations because the original task leaves active lists.
* Decision: selected for MVP.

### Approach B: Copy to project and keep source task

* Create a project from the task fields, copy tags/checklist-derived data, leave the original task untouched.
* Pros: lowest destructive risk; easy to reason about.
* Cons: not a true conversion; duplicates the same work in lists unless the user manually cleans up.

### Approach C: Create project and move source task into it

* Create a project and move the original task into the new project as the first child task.
* Pros: preserves the original task record and history.
* Cons: project and first task often have the same title; checklist mapping is awkward; feels more like "wrap in project" than "convert".

## Decision (ADR-lite)

**Context**: A task that grows in scope should become a project without forcing the user to manually recreate title, notes, planning state, tags, and checklist items.

**Decision**: Use true conversion semantics for MVP. The system creates a new project from the source task, converts checklist items into project child tasks, and permanently purges the source task after successful conversion.

**Consequences**: This gives the clearest user model and avoids duplicate active work items. The implementation must be transactional, and source task deletion should follow existing purge/tombstone semantics rather than moving the source task into Trash.
