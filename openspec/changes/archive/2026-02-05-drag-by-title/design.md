## Context

- Drag-and-drop reordering is implemented in the renderer using `@dnd-kit/core` + `@dnd-kit/sortable` with a portal-mounted `DragOverlay`.
- Supported sortable task lists today:
  - `src/features/tasks/TaskList.tsx` (single list)
  - `src/features/tasks/ProjectGroupedList.tsx` (grouped by sections)
- Current activation model uses a dedicated visible handle button:
  - `useSortable()` provides `listeners`/`attributes` + `setActivatorNodeRef`.
  - These are applied to a `.task-dnd-handle` button that renders a `.task-dnd-grip` visual.
- The presentational row component `src/features/tasks/TaskRow.tsx` renders a `dragHandle` slot before the checkbox and title.
- Self-test automation (`src/app/selfTest.ts`) currently locates and drags via `.task-dnd-handle`.

This change removes the visible handle column and makes the task title area the drag activator.

## Goals / Non-Goals

**Goals:**

- Remove the visible drag handle UI from sortable task lists.
- Make the task title button/area the drag activator for pointer-based reordering.
- Preserve interaction safety boundaries:
  - Drag initiation MUST NOT occur from other row controls (e.g. completion checkbox, inline editors, restore button).
- Preserve the existing DnD architecture:
  - Virtualization and the “outer translateY vs inner dnd transform” split remains unchanged.
  - `DragOverlay` remains portal-mounted and uses the same row layout to avoid horizontal jumps.
- Update automation/self-tests to match the new activator.

**Non-Goals:**

- Switching drag-and-drop libraries or introducing new dependencies.
- Changing persistence semantics (`task.reorderBatch`, list id conventions, or DB schema).
- Enabling DnD in views that intentionally do not support it (Upcoming/Logbook/Search).
- Overhauling keyboard reordering shortcuts.

## Decisions

### 1) Use the title button as the sortable activator

- Decision: Move `setActivatorNodeRef`, `listeners`, and `attributes` from the dedicated handle to the task title button.
- Rationale: Removes the handle column entirely while keeping drag initiation constrained to a predictable, single control area.
- Alternatives considered:
  - Whole-row drag: simpler wiring, but higher accidental-drag and text-selection risk in a row with multiple controls.
  - Hidden handle (hover-only): lower risk, but still reserves layout space and retains a “mystery” affordance.

### 2) Extend `TaskRow` with an explicit “title activator” hook-up point

- Decision: Introduce a stable way to pass an activator `ref` and props to the title button inside `TaskRow`.
- Rationale: Both `TaskList` and `ProjectGroupedList` reuse `TaskRow`; pushing DnD activation into the title requires wiring at that specific node.
- Alternatives considered:
  - Render the title button from the sortable wrapper (instead of `TaskRow`): larger structural churn and risk of layout/style divergence.
  - Attach listeners at the `.task-row-inner` container and stopPropagation for nested controls: broader event surface and more edge cases.

### 3) Keep the existing activation constraint, with room to tune

- Decision: Start by keeping the current `activationConstraint.distance` values (TaskList: 6px, ProjectGroupedList: 8px) and tune only if click-vs-drag conflicts are observed.
- Rationale: These constraints already exist and are expected by self-tests; they also reduce accidental drags when the activator is an interactive element.
- References:
  - `@dnd-kit` supports separate activator nodes via `setActivatorNodeRef` (official docs).
  - Practical guidance suggests a small distance threshold (e.g. 5-10px) to distinguish click from drag.

### 4) Remove handle-only overlay layout workarounds

- Decision: Remove the drag-handle placeholder column in `DragOverlay` rows once the in-list row no longer contains a handle column.
- Rationale: The placeholder exists solely to prevent a horizontal jump between in-list rows and overlay rows. With no handle column, the rows naturally align.

### 5) Scope any “grab cursor” styling to DnD-enabled lists

- Decision: Do not globally style `.task-title-button` as draggable because it is reused in non-DnD views (e.g. Upcoming list).
- Rationale: Prevents implying draggable behavior where DnD is not enabled.
- Implementation approach: apply a wrapper class/data attribute only on DnD-enabled list implementations and scope cursor/hover styling under it.

## Risks / Trade-offs

- [Click and double-click conflicts on the title] 
  → Mitigation: rely on `activationConstraint.distance` to preserve click semantics; validate with self-tests and manual use.
- [Accessibility semantics when spreading `attributes` onto a `<button>`] 
  → Mitigation: prefer parity with current handle wiring (spread `attributes` + `listeners` together); adjust only if we observe duplicate role/tabIndex issues.
- [Automation breakage due to selector changes] 
  → Mitigation: update `selfTest.ts` to drag from the title activator; keep the same “move enough distance to activate” logic.
- [Loss of discoverability (no explicit handle)] 
  → Mitigation: optional scoped `cursor: grab` / hover affordance on the title within DnD-enabled lists.

## Migration Plan

- Renderer-only change; no migrations.
- Rollback: revert the activator move and restore the handle UI + CSS + self-test selectors.

## Open Questions

- Do we want to increase the activation distance threshold (e.g. 10-12px) if we observe accidental drags during click/double-click?
- Should the title show a drag affordance (cursor/hover) when DnD is enabled, or remain visually neutral?
