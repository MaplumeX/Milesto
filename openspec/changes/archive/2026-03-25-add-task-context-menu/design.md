## Context

- Task rows are rendered through several renderer surfaces, not a single list:
  - `src/features/tasks/TaskList.tsx`
  - `src/features/tasks/ProjectGroupedList.tsx`
  - `src/features/tasks/UpcomingGroupedList.tsx`
  - `src/features/logbook/LogbookGroupedList.tsx`
- The codebase already uses custom renderer-side portal popovers instead of a menu library or Electron native menus:
  - `TaskEditorPaper` uses `createPortal`, fixed positioning, outside-click dismissal, and `DayPicker`.
  - `ContentBottomBarActions` uses the same anchored popover pattern for scheduling and moving tasks.
- Existing task metadata APIs already cover the required mutations:
  - `window.api.task.update` for `scheduled_at` / `due_at`
  - `window.api.task.setTags`
  - `window.api.task.toggleDone`
  - `window.api.task.getDetail` for loading `tag_ids`
  - `window.api.tag.list` for loading the available tag set
- Task list payloads intentionally omit tag membership (`TaskListItem` has no `tag_ids`) to keep list rendering lightweight and aligned with the redline that large lists only load required fields.
- Task editing already has a separate “selection” and “open editor” model through `TaskSelectionContext`, including `requestCloseTask()` so the shell can flush and close an inline editor before another interaction takes over.

Constraints:
- Renderer must stay inside `window.api.*` boundaries.
- Existing virtualized lists and project DnD interactions must keep working.
- The UI should stay consistent with current minimal popover patterns and must not introduce a new dependency just for menus.

## Goals / Non-Goals

**Goals:**
- Add a shared task context menu that opens from right click / secondary click on task rows.
- Support exactly four task actions from the menu root:
  - Schedule / Plan
  - Tags
  - Due
  - Complete / Restore
- Reuse existing task scheduling, due-date, tags, and done-state APIs without changing list payload shape.
- Keep behavior consistent across active task rows, completed task rows, and Logbook task rows.
- Ensure the context menu coordinates with the existing inline editor so the UI has only one active task editing surface at a time.
- Keep tags editing lightweight:
  - only existing tags
  - immediate save on toggle
  - keep the tags panel open after each toggle

**Non-Goals:**
- Adding tag creation, renaming, deletion, or color editing to the context menu.
- Adding Electron native context menus.
- Changing task data schema or task list queries to eagerly include tag membership.
- Replacing the existing inline editor or bottom-bar scheduling interactions.
- Extending the menu to project rows or Logbook project entries.

## Decisions

### Decision: Use a renderer-side context panel, not an Electron native context menu

Decision:
- Implement the task context menu as a custom renderer portal anchored to the pointer position.

Rationale:
- The required interactions include embedded calendars and an in-panel tag checklist, which do not fit a native application menu.
- The app already uses renderer-managed popovers with explicit dismissal and focus restore semantics, so this keeps the interaction model consistent.

Alternatives considered:
- Electron native `Menu` / `MenuItem`
  - Rejected because it cannot cleanly host `DayPicker` and a persistent multi-select tags panel.
- A new third-party context menu library
  - Rejected because the current codebase already has the primitives needed and adding a dependency is unnecessary here.

### Decision: Keep a small menu root and switch to internal secondary panels

Decision:
- The root menu shows only the four high-level actions.
- `Schedule`, `Due`, and `Tags` switch the same menu surface into a secondary panel instead of opening nested popovers.

Rationale:
- This matches the interaction pattern already used by project/task popovers: one anchored surface with internal view changes is easier to reason about than stacked overlays.
- It keeps escape, click-outside, and focus-restore behavior uniform.

Alternatives considered:
- Cascading submenus
  - Rejected because the date and tag interactions are too rich for a narrow submenu affordance.
- Separate popovers for each action
  - Rejected because it increases stacking/focus complexity and creates more edge cases around outside-click handling.

### Decision: Introduce a shared row-level context menu wrapper instead of duplicating menu state per list

Decision:
- Add a shared task context menu controller and expose row-level hooks/props so each task-rendering surface can opt in without rewriting the behavior.
- `TaskRow` becomes the default trigger surface, while `UpcomingGroupedList` and any custom-composed rows call the same shared open handler.

Rationale:
- Task rows are rendered from multiple places. If each list reimplements right-click behavior independently, state handling and semantics will drift.
- A shared controller centralizes:
  - current task target
  - pointer anchor coordinates
  - active view (`root` / `schedule` / `due` / `tags`)
  - outside-click / Escape dismissal
  - refresh and focus-restore behavior

Alternatives considered:
- Only add `onContextMenu` inside `TaskRow`
  - Rejected because `UpcomingGroupedList` does not fully render via `TaskRow`, and this would still leave duplicate state handling elsewhere.

### Decision: Close any open inline editor before opening the context menu

Decision:
- Opening a task context menu first attempts `requestCloseTask()` when any inline task editor is open.
- If flush/close fails, the menu does not open and focus returns to the editor’s error target.

Rationale:
- The inline editor already owns draft state and auto-save sequencing. Running a second editing surface against the same task, or even another task, would create conflicting write timing and confusing state.
- This matches the existing shell behavior for switching task-editing focus safely.

Alternatives considered:
- Allow context menu and inline editor to coexist
  - Rejected because it creates ambiguous ownership of the active task editing session.
- Only block when the same task is open
  - Rejected because the shell’s current editing model is single-open-editor, and preserving that invariant is simpler and safer.

### Decision: Load tag membership lazily only when the Tags panel opens

Decision:
- The menu root uses only row data.
- On entering the Tags panel, fetch:
  - `window.api.task.getDetail(taskId, scope)` to read current `tag_ids`
  - `window.api.tag.list()` to load available tags

Rationale:
- Keeps list payloads unchanged and cheap, which matters for virtualized lists and the 10k-task performance constraints.
- Avoids prefetching data for rows that never open the tags panel.

Alternatives considered:
- Extend `TaskListItem` to include `tag_ids`
  - Rejected because it expands all list payloads for a secondary interaction.

### Decision: Save semantics differ by action type

Decision:
- `Schedule`, `Due`, `Complete`, and `Restore` save immediately and close the entire context menu on success.
- `Tags` saves immediately on each toggle but keeps the Tags panel open.

Rationale:
- Date/done changes are usually single-action edits; closing immediately keeps the interaction crisp.
- Tags commonly require multiple toggles in one session; keeping the panel open reduces repetitive reopen cost.

### Decision: Use global revision bumps to refresh list views after successful mutations

Decision:
- After each successful context-menu mutation, call `bumpRevision()` so the current page reloads its data via the existing refresh mechanism.

Rationale:
- This matches how the app already refreshes list views after structural task changes.
- It avoids adding bespoke in-memory row mutation logic in every list surface.

Trade-off:
- The change is intentionally refresh-driven rather than optimistic for all fields except existing title behavior.

## Risks / Trade-offs

- [Virtualized row remount after mutation] → Refresh-driven updates may cause the current row to move or disappear (for example, changing schedule moves a task between buckets).
  → Mitigation: rely on the existing selection fallback logic in list views and keep menu close behavior deterministic after success.

- [Project DnD event interference] → Right click and drag sensors both live on task rows in project/task lists.
  → Mitigation: keep the context menu trigger on `contextmenu` / secondary-click semantics only; do not alter primary-button drag activation behavior.

- [Logbook and completed-task semantics] → Done rows need the same metadata editing actions but must surface `Restore` instead of `Complete`.
  → Mitigation: compute the final action label from task status and always allow metadata panels for both open and done tasks.

- [Lazy tag loading latency] → Opening the Tags panel adds a fetch round trip.
  → Mitigation: keep the root menu lightweight and only load detail when the user explicitly asks for tags; show a small loading/error state in the Tags panel if needed.

- [Custom menu accessibility] → Manual popovers need explicit keyboard and focus behavior.
  → Mitigation: follow the existing renderer popover conventions: Escape closes, outside click dismisses, and focus returns to the trigger or row target.

## Migration Plan

1. Add the new capability spec and implementation tasks for the shared task context menu.
2. Build renderer-side coverage first for open/close behavior and menu action semantics.
3. Implement the shared menu controller and wire it into all task row surfaces.
4. Reuse the existing task APIs for persistence and refresh through `bumpRevision()`.

Rollback:
- The change is renderer-only and reuses existing APIs, so rollback is limited to removing the new context menu components and row wiring.
- No database migration or IPC contract expansion is required.

## Open Questions

- Should keyboard users later get an equivalent “open context menu for selected task” command, or is this strictly mouse/secondary-click for this change?
- Should the menu anchor to pointer coordinates exactly, or should it snap to the row edge for more stable positioning in dense lists?
