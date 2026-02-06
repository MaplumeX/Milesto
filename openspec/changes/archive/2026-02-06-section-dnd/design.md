## Context

- The Project page uses a mixed virtualized list (`@tanstack/react-virtual`) in `src/features/tasks/ProjectGroupedList.tsx` where section header rows and task rows are rendered together.
- Drag-and-drop is implemented with `@dnd-kit` and a portal-mounted `DragOverlay`; current sortable behavior is task-only.
- Project sections already have a persistent ordering field (`project_sections.position`) and list queries already sort by this field.
- Current `project-page` spec still states that section headers are not draggable, so this change must intentionally replace that requirement.
- User-selected preview style is shadow-stacked edges (scheme 1): section drag preview must not render real task thumbnails.

## Goals / Non-Goals

**Goals:**
- Allow dragging project section headers to reorder section groups on the Project page.
- Persist section order updates to `project_sections.position` via a dedicated section reorder action path.
- Keep task DnD behavior unchanged and non-conflicting (within-section reorder + cross-section move).
- Add section drag preview with shadow-stacked edges only (no child task preview cards).
- Preserve reduced-motion support and keyboard-equivalent reorder behavior.

**Non-Goals:**
- No cross-project section dragging.
- No multi-select section dragging.
- No changes to task persistence semantics (`task.reorderBatch` / `task.update`).
- No replacement of DnD library or virtualization architecture.

## Decisions

1) Use distinct drag item types for section and task

- Decision: Keep a single `DndContext`, but use typed IDs/data (e.g. `section:<id>` vs `task:<id>`) and branch event handling by drag type.
- Rationale: Prevents section/task drag conflicts while preserving current task DnD implementation.
- Alternatives considered:
  - Separate nested DnD roots for section/task: rejected due to complexity and collision edge cases with virtualized rows.

2) Add batch section reorder persistence through project section action path

- Decision: Introduce a dedicated `project.section.reorderBatch` chain:
  - Renderer `window.api.project.reorderSections(projectId, orderedSectionIds)`
  - Preload IPC channel `db:project.section.reorderBatch`
  - Main `handleDb` registration
  - DB worker action updates `project_sections.position` transactionally using stable gaps (e.g. `(index + 1) * 1000`).
- Rationale: Aligns with existing section schema and query ordering; avoids overloading task list-position tables.
- Alternatives considered:
  - Reuse `list_positions`: rejected because section ordering is already modeled natively by `project_sections.position`.

3) Reflow-based section reorder feedback in virtualized mixed rows

- Decision: Extend Project page row modeling to support section-level sortable order and live reflow while dragging section headers.
- Rationale: Existing product direction already prefers reflow over explicit insertion lines for DnD feedback.
- Alternatives considered:
  - Indicator-line-only feedback: rejected for inconsistency with current DnD interaction model.

4) Section drag preview uses scheme-1 shadow-stacked edges

- Decision: Render a section-specific overlay card with layered shadow/edge depth; do not render real task cards in overlay.
- Rationale: Matches user preference, keeps rendering light, and avoids heavy overlay DOM when sections contain many tasks.
- Alternatives considered:
  - Render top N task thumbnails: rejected by selected UX direction.

5) Preserve accessibility and reduced-motion behavior

- Decision: Reuse existing reduced-motion detection and disable visible drop animation in reduced-motion mode; keep keyboard reorder path for section rows.
- Rationale: Required by current UI standards and existing DnD behavior contracts.
- Alternatives considered:
  - Pointer-only section reorder: rejected due to keyboard-first requirements.

## Risks / Trade-offs

- [Section/task gesture conflicts in shared DnD context] -> Mitigation: strict drag type discrimination and scoped activator bindings.
- [Virtualized mixed-row reflow can jitter on large projects] -> Mitigation: update draft order only on effective index changes; avoid expensive per-frame recomputation.
- [IPC/data-path drift across Renderer/Preload/Main/Worker] -> Mitigation: add one explicit section reorder API contract and validate payloads with zod at each boundary.
- [Spec conflict with existing non-draggable section requirement] -> Mitigation: include explicit MODIFIED requirement delta in this change.

## Migration Plan

- No schema migration needed; `project_sections.position` already exists.
- Rollout sequence:
  1. Add section reorder API/contracts (shared schema + window API + preload + main + db worker).
  2. Add renderer section sortable behavior and overlay style.
  3. Update/extend self-tests for section drag reorder persistence and reduced-motion behavior.
- Rollback strategy: revert the section reorder action/API and renderer section-sortable logic; existing task DnD remains intact.

## Open Questions

- Should section keyboard reorder use the same chord as task reorder (`Cmd/Ctrl + Shift + Arrow`), or require an explicit section-only shortcut?
- Should a section with zero tasks still show the same shadow-stacked overlay depth, or downgrade to a single-card preview for clarity?
