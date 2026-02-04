## Context

- The renderer uses React with virtualized lists via `@tanstack/react-virtual`.
  - `src/features/tasks/TaskList.tsx` renders task rows as absolutely-positioned elements with `transform: translateY(...)` from the virtualizer.
  - `src/features/tasks/ProjectGroupedList.tsx` renders a mixed virtual list (section header rows + task rows).
- Drag-and-drop is implemented with `@dnd-kit` (core + sortable) and `DragOverlay` is portaled to `document.body`.
- Existing UI uses explicit indicators:
  - Insertion lines via `data-drop-indicator` and CSS pseudo-elements.
  - Project header droppable highlight via `.project-group-header.is-drop-over`.
  - Dragged-row opacity via `.task-row.is-dragging`.
- Existing specs require a clear insertion indication and, for empty project sections, that the UI indicates dropping is allowed.

This change updates the interaction model so that the insertion position is indicated by live list reflow (items moving to reveal the slot), matching Trello-like behavior and removing the extra indicator chrome.

## Goals / Non-Goals

**Goals:**

- Remove insertion indicator lines (task rows and the no-section top dropzone line).
- Remove Project section header droppable highlight.
- Remove dragged-row opacity styling.
- Make Project cross-section drag behave like within-section sorting during drag: destination list reflows before drop.
- Keep drag preview overlay visible and reliable with virtualization and a single scroll container.
- Keep keyboard reorder behavior intact.
- Ensure empty-section drops remain usable without header highlight or insertion lines by using reflow/placeholder behavior.

**Non-Goals:**

- Introduce new drag-and-drop libraries or rewrite the list architecture.
- Add nested scroll containers.
- Add multi-select drag or cross-view drag.

## Decisions

1) Use reflow-driven insertion feedback (no explicit line/highlight)

- Decision: The insertion position SHALL be indicated by live list reflow only.
- Rationale: Matches Minimal UI principles while still providing immediate, clear feedback.
- Alternative: Keep an insertion line/highlight. Rejected per product direction for this change.

2) Maintain a draft ordering map during drag to enable cross-container reflow

- Decision: During Project drag operations, maintain a draft `itemsByContainer` map that is updated on drag-over.
- Rationale: Updating the rendered `SortableContext` items array is what causes other rows to animate out of the way. Computing a projected drop position without updating the items array cannot produce Trello-like reflow.

3) Treat empty destination sections as reflow-capable via a placeholder slot

- Decision: When the destination container is empty, render a placeholder slot by treating the dragged item as temporarily "in" the destination container during drag.
- Rationale: Without header highlight and without an insertion line, an empty container needs a visible slot for "dropping is allowed" feedback.

4) Preserve transform separation for virtualization

- Decision: Keep the virtualizer's translateY on the outer wrapper and apply `useSortable` transforms on an inner wrapper (`TaskRow.innerStyle`).
- Rationale: Avoids transform conflicts and jitter.

5) Persist on drop; allow UI-only reflow during drag

- Decision: Use draft state for drag-time UI only, and perform persistence on drag end:
  - Same-section: `task.reorderBatch(listId, orderedIds)`
  - Cross-section: `task.update({ section_id })` and reorder both source and destination list ids.
- Rationale: Avoids DB churn during drag and keeps rollback simple.

## Risks / Trade-offs

- [Reflow-only feedback may be less explicit in sparse lists] -> Mitigation: Ensure empty-section placeholder slot is visible and the drag overlay has sufficient contrast.
- [Virtualization + drag-over state updates may cause jank] -> Mitigation: Update draft state only when the computed insertion index/container changes; keep computations O(1)/O(log n) and avoid measuring offscreen DOM.
- [Source/destination confusion after cross-container drag-over mutations] -> Mitigation: Track the drag start container separately from the active container during drag; use refs to avoid stale closures.
- [Existing self-test expects `.is-drop-over`] -> Mitigation: Update `src/app/selfTest.ts` to assert behavior (task moved and persisted) rather than CSS classes.
- [Inline editor pointerdown capture can interfere with drag initiation] -> Mitigation: Ensure drag initiation is from a dedicated handle and consider bypassing editor-dismiss capture while a drag is active.
