## Why

Task list views (Inbox/Anytime/Someday/Today/Area/Project) currently have no user-controlled ordering. Most lists are implicitly ordered by `created_at`, and Project is only partially order-aware (rank support exists but there is no drag interaction).

Users need to quickly reprioritize by reordering tasks directly in the list, with a clear drag preview and predictable persistence.

## What Changes

- Add drag-and-drop task reordering with a drag preview in these views: Inbox, Anytime, Someday, Today, Area, and Project.
- Persist ordering per list context using `list_positions(list_id, task_id, rank)` and `task.reorderBatch`.
- Project page: allow dragging tasks across sections (including into empty sections) as part of the Project list interaction.
- Provide a keyboard equivalent for reordering (drag-and-drop MUST NOT be pointer-only).
- Explicitly do NOT support drag-and-drop sorting in Upcoming, Logbook, or Search (these views have semantic/derived ordering where manual reordering would be confusing or unstable).

## Capabilities

### New Capabilities
- `task-list-reordering`: Users can reorder tasks within supported list views (Inbox/Anytime/Someday/Today/Area) with drag preview, persistence, and keyboard equivalent.

### Modified Capabilities
- `project-page`: Add task drag-and-drop reordering within sections and moving tasks across sections (including empty sections), with drag preview and keyboard equivalent.

## Impact

- Renderer (React): `src/features/tasks/TaskList.tsx`, `src/features/tasks/ProjectGroupedList.tsx`, and related selection/open-editor behavior.
- DB worker: list queries for Inbox/Anytime/Someday/Area/Project likely need to join `list_positions` for `rank` ordering (as Today already does).
- IPC / window API: reuse existing `window.api.task.reorderBatch(...)` and `window.api.task.update(...)`.
- Dependencies: likely standardize on `@dnd-kit` primitives (core + sortable) to support virtualized lists and drag overlays.
