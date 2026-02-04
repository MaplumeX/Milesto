## Why

Task drag-and-drop on the Project page currently relies on explicit visual indicators (insertion lines, droppable header highlight, and dragged-row opacity). This conflicts with the app's Minimal UI direction and creates inconsistent feedback between same-section reordering and cross-section moves.

We want a Trello-like drag feel where the insertion position is communicated by live list reflow (items sliding out of the way) and the drag preview overlay, with no extra indicator chrome.

## What Changes

- Remove explicit insertion indicators (task-row before/after lines) during drag-and-drop reordering.
- Remove Project section header droppable highlight during cross-section drag.
- Remove dragged-row opacity treatment; the dragged item is represented by the drag overlay and surrounding list reflow.
- Update Project cross-section dragging so that, during drag, tasks reflow in the destination section the same way they do for within-section sorting.
- Ensure dropping into an empty Project section remains usable by showing list reflow/placeholder behavior without using header highlight or insertion lines.
- Update self-test assertions that currently depend on `.is-drop-over`.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `task-list-reordering`: Replace the "drop indicator line" requirement with a reflow-based insertion indication (still clear and testable).
- `project-page`: Replace the "dropping is allowed" indication for empty sections from header highlight to reflow/placeholder behavior; ensure cross-section drag behaves like within-section sorting during drag.

## Impact

- Renderer UI and behavior:
  - `src/features/tasks/TaskList.tsx`
  - `src/features/tasks/ProjectGroupedList.tsx`
  - `src/features/tasks/TaskRow.tsx`
  - `src/index.css`
- Self-test:
  - `src/app/selfTest.ts`
- No new dependencies expected; remains on `@dnd-kit/*` + `@tanstack/react-virtual`.
