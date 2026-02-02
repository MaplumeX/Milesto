## Context

- The renderer uses React and virtualized lists via `@tanstack/react-virtual`.
  - `src/features/tasks/TaskList.tsx` renders task rows as absolutely-positioned elements with `transform: translateY(...)` from the virtualizer.
  - `src/features/tasks/ProjectGroupedList.tsx` renders a mixed virtual list (section header rows + task rows) and sorts tasks by `rank` then `created_at`.
- The app is keyboard-first in list views today:
  - `TaskList` uses ArrowUp/ArrowDown for navigation, Enter to open, Space to toggle done.
- Ordering persistence infrastructure already exists:
  - `list_positions(list_id, task_id, rank)` exists in DB.
  - IPC action `task.reorderBatch` upserts ranks for a given `list_id`.
- Project uses a list-id convention in SQL: `project:<projectId>:<sectionId|none>`.

This change adds drag-and-drop reordering with a drag preview for supported list views, and Project cross-section moves, while keeping virtualization and keyboard navigation stable.

## Goals / Non-Goals

**Goals:**

- Users can reorder tasks via drag-and-drop with a clear drag preview in: Inbox, Anytime, Someday, Today, Area, Project.
- Reorder persistence is per list context (list-scoped ordering), using `list_positions` + `task.reorderBatch`.
- Project: users can drag tasks within a section and across sections (including empty sections).
- Provide a keyboard equivalent for reordering that does not conflict with existing list controls.
- Preserve the single-scroll-container constraint (see `openspec/specs/task-list-single-scroll/spec.md`).
- Maintain virtualization performance and avoid jank/jumps during drag.

**Non-Goals:**

- Drag-and-drop sorting for Upcoming, Logbook, or Search.
- Cross-view drag-and-drop moves (e.g., dragging from Inbox to Today).
- OS-level drag (dragging out of the app), nested/tree DnD, or multi-select drag.

## Decisions

1) Use `@dnd-kit` (core + sortable) with `DragOverlay` for preview

- Decision: Standardize on `@dnd-kit` to implement drag-and-drop.
- Rationale: Built-in support for a drag overlay, keyboard sensor support, and a sortable preset that explicitly supports virtualized lists (`verticalListSortingStrategy`).
- Alternatives:
  - Native HTML5 drag-and-drop: limited control over preview and inconsistent behavior in complex/virtualized UIs.
  - react-dnd: powerful but heavier mental model; `@dnd-kit` fits the current needs better.

2) Drag preview is always rendered as a portal-mounted overlay

- Decision: Render the drag preview via `DragOverlay`, and portal it to `document.body`.
- Rationale: List views live inside a scroll container and are virtualized. Overlay must not be clipped by overflow/stacking contexts, and must remain visible even if the source row unmounts.

3) Avoid transform conflicts with virtualization by splitting positioning vs dragging transforms

- Decision: Keep the virtualizer's `translateY(...)` on the outer row wrapper, and apply dnd-kit transforms on an inner wrapper.
- Rationale: Both virtualizer and dnd-kit use CSS transforms. Applying both on the same element causes conflict/jitter.

4) List-scoped ordering via stable `list_id` strings

- Decision: Define list ids for supported views:
  - `inbox`, `anytime`, `someday`, `today`
  - `area:<areaId>`
  - `project:<projectId>:<sectionId|none>`
- Rationale: A single task can appear in multiple derived views (e.g., Anytime + Project). Ordering must be independent per view.
- Alternative: Global task order field. Rejected because it conflicts with multiple contexts and derived lists.

5) Project cross-section move = update task + reorder both source and destination lists

- Decision: On drop across sections, persist:
  - `task.update({ id, section_id: <destSectionId|null> })`
  - `task.reorderBatch(sourceListId, orderedSourceTaskIds)` and `task.reorderBatch(destListId, orderedDestTaskIds)`
- Rationale: Section membership and ordering are separate concerns. Keeping ordering per list id matches the DB model.
- Trade-off: Old `list_positions` rows for the task in the source list id may remain (orphaned). This does not affect correctness but may accumulate; see Risks.

6) Keyboard equivalent uses a modifier chord (not Space)

- Decision: Do not overload Space for drag mode because Space already toggles completion in list views.
- Candidate: `Cmd/Ctrl + Shift + ArrowUp/ArrowDown` to move the selected task by one position within the current list context.
- Rationale: Preserves existing keyboard semantics and minimizes collisions.

7) Interaction boundaries: drag handle vs whole-row drag

- Decision: Start with drag activation from a specific handle/zone (e.g., title area), not from checkbox or inputs.
- Rationale: Prevent accidental drags when toggling done or editing.

## Risks / Trade-offs

- [Virtualized list + DnD can jitter if transforms conflict] -> Mitigation: separate wrappers for virtual position vs drag transform; rely on `DragOverlay`.
- [Keyboard conflicts with existing list bindings] -> Mitigation: use a modifier chord for reorder; keep Arrow/Enter/Space behaviors unchanged.
- [Orphaned `list_positions` rows when tasks leave a list] -> Mitigation: accept initially; optionally add cleanup later (e.g., on reorder or on task attribute changes) if growth becomes measurable.
- [Project list includes section header rows] -> Mitigation: only tasks are draggable; headers are droppable targets for "move to section" and for empty-section drops.
- [Auto-scroll during drag inside the main content scroller] -> Mitigation: use dnd-kit auto-scrolling behavior or implement edge-triggered scrolling against the existing single scroll container.

## Open Questions

- Exact keyboard shortcut for reorder: do we need a settings-backed binding, or is a fixed chord acceptable?
- Should completed tasks be draggable/reorderable (both in list views and in Project's completed section)?
- Do we want to proactively prune orphaned `list_positions` rows, or treat it as acceptable technical debt?
