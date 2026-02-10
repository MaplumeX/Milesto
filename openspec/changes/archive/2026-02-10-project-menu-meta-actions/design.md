## Context

The Project page currently uses a header + notes + grouped tasks layout with an overflow menu ("...") for project-level actions. The existing menu action set is not aligned with common project workflows (complete, plan/schedule, due, move, tags, delete), and project metadata (schedule/due/tags) is not visible near the title.

Relevant existing behaviors to preserve:
- Header contains completion checkbox, editable title, and an overflow menu button.
- Project completion requires confirmation and is atomic (project + tasks).
- Reopen affects the project status only; tasks remain done.
- Tags infrastructure exists for projects via `project.getDetail` (ordered `tags: Tag[]`) and `project.setTags` (atomic replace).

Constraints:
- Renderer must interact through `window.api.*` only (no direct Electron primitives).
- Existing popovers use `role="dialog"` with Escape and click-outside to dismiss.
- Data model uses soft delete (`deleted_at`) for entities like areas/tasks/tags; projects currently lack a first-class delete action.

## Goals / Non-Goals

**Goals:**
- Replace Project overflow menu contents with the target action set: Complete/Reopen, Plan (schedule incl. Someday), Due, Move, Tags, Delete.
- Surface current schedule/due/tags as a compact meta row under the title and above notes.
- Provide one-click clear/remove controls ("x") for schedule/due/tags similar to the task editor chips.
- Implement missing backend support required by the UI:
  - Project-level Someday scheduling state.
  - Project soft delete with cascade.
- Keep the menu root view value-free; metadata values are shown in the meta row.

**Non-Goals:**
- Redesign task grouping, section editing, or DnD behavior on the Project page.
- Add a global settings toggle for showing/hiding the meta row.
- Introduce new external UI libraries.

## Decisions

### 1) Single popover with internal subviews (no nested popovers)

Decision: Implement the menu as a single anchored popover that switches internal "views" for Plan/Due/Move/Tags instead of stacking nested popovers.

Rationale:
- Avoids focus/stacking bugs common to nested popovers.
- Matches existing popover patterns used elsewhere (anchored dialog-like surfaces).

Alternatives considered:
- Nested popovers (rejected: more brittle; harder focus restore and outside-click semantics).
- Navigate to a separate page for metadata (rejected: too heavy for quick actions).

Accessibility / focus notes:
- Escape always closes the entire popover.
- A visible Back control is used to return to the root view.
- Entering a subview moves focus to the Back control (or the search/new-tag input for Tags).
- Returning to root view restores focus to the triggering root menu item.
- Closing the popover restores focus to the "..." trigger.

### 2) Project meta row uses the existing chip interaction language

Decision: Render schedule/due/tags as chips under the title using the same "chip + x" affordance style as the task editor.

Rationale:
- Reuses a proven interaction: a visible value with a close button that clears/removes.
- Keeps metadata readable without expanding menus.

Alternative:
- Show values as plain text with separate "Clear" buttons (rejected: less compact and less consistent).

### 3) Fetch Project data via `project.getDetail` on ProjectPage

Decision: Use `project.getDetail` as the primary fetch for the Project page state so tags are available without additional round trips.

Rationale:
- The meta row requires tags; `project.get` alone is insufficient.
- `getDetail` already returns ordered tags and uses existing backend capability.

Alternative:
- Fetch `project.get` + `project.getDetail` (rejected: redundant; higher chance of state divergence).

### 4) Add project-level Someday scheduling state

Decision: Add a boolean `is_someday` to the Project model, analogous to tasks, to support a three-state Plan schedule:
- None: `scheduled_at=null`, `is_someday=false`
- Date: `scheduled_at=YYYY-MM-DD`, `is_someday=false`
- Someday: `scheduled_at=null`, `is_someday=true`

Rationale:
- User requirement: projects can be planned for a specific day or Someday.
- Aligns with existing task scheduling semantics and UI vocabulary.

Data model implications:
- DB migration adds `projects.is_someday` defaulting to 0.
- Invariant enforced by validation/write-path: `is_someday=true` implies `scheduled_at` is null; `scheduled_at!=null` implies `is_someday=false`.

### 5) Implement `project.delete` as soft delete with cascade

Decision: Add `project.delete` end-to-end (schema -> window api -> preload -> main -> db worker) using soft delete by setting `deleted_at`.

Cascade scope:
- Soft-delete the project itself.
- Soft-delete all tasks with `project_id=<project>`.
- Soft-delete all project sections under that project.

UI behavior:
- Delete requires confirmation.
- After successful deletion, navigate away from `/projects/:projectId` to a safe route (e.g., `/today`).

Alternatives:
- Hard delete (rejected: inconsistent with existing entity deletion strategy).
- Orphan tasks to Inbox (rejected: violates user intent; inconsistent with area.delete cascade).

## Risks / Trade-offs

- [DB migration constraints] SQLite `ALTER TABLE` cannot add CHECK constraints easily. 
  -> Mitigation: enforce invariants in schemas and update logic; keep migration minimal.

- [Cross-cutting schema change] Adding `ProjectSchema.is_someday` impacts export/import and any `ProjectSchema.parse` call sites.
  -> Mitigation: update all SQL SELECTs that parse projects to include the new column; update data transfer actions.

- [UI test coupling] The self-test relies on stable labels and the overflow menu containing Reopen.
  -> Mitigation: keep the overflow trigger text stable and preserve a Reopen action with the same visible label; update self-test only if necessary.

- [Popover focus traps] Adding internal navigation increases the chance of focus loss.
  -> Mitigation: explicitly manage focus on view transitions and on close; keep Escape behavior uniform.

## Migration Plan

1) DB migration
- Add `projects.is_someday` with default 0 and backfill existing rows.
- Bump DB `user_version`.

2) Backend wiring
- Extend shared schemas and window api types.
- Add `project.delete` IPC handler and db worker action.

3) Renderer changes
- Switch ProjectPage fetch to `project.getDetail`.
- Add meta row and chips with clear/remove.
- Replace ProjectMenu contents with multi-view popover.

4) Verification
- Run the existing self-test flow and confirm Project complete/reopen remains stable.

Rollback
- UI changes can be reverted independently.
- DB migration is additive (new column) and safe to keep even if UI is rolled back.

## Open Questions

- Should the meta row chips be clickable to jump directly into the corresponding menu subview (Plan/Due/Tags), or be display-only with clears only?
- Should Due include a "Today" quick action, or only Date + Clear?
