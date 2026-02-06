## 1. Section Reorder API & Persistence

- [x] 1.1 Add shared section-reorder input/output schemas in `shared/schemas/project.ts` and export them from schema index.
- [x] 1.2 Extend `shared/window-api.ts` and `electron/preload.ts` with `project.reorderSections(projectId, orderedSectionIds)`.
- [x] 1.3 Register `db:project.section.reorderBatch` in `electron/main.ts` with zod validation and DB response validation.
- [x] 1.4 Implement `project.section.reorderBatch` in `electron/workers/db/actions/project-actions.ts` to transactionally update `project_sections.position` using stable rank gaps.

## 2. Project Page Section DnD Behavior

- [x] 2.1 Extend `ProjectGroupedList` row/drag modeling to support section drag items and task drag items without conflict.
- [x] 2.2 Add section-header sortable wiring and section-specific drag start/over/end handling while preserving existing task reorder and cross-section move behavior.
- [x] 2.3 Persist section order on section drop and keep selection/focus behavior coherent for section rows.
- [x] 2.4 Add keyboard-equivalent section reorder behavior for selected section headers and persist updates.

## 3. Section Drag Preview (Scheme 1: Shadow-Stacked Edges)

- [x] 3.1 Add a section drag overlay view that renders section-level preview only (no task thumbnails).
- [x] 3.2 Add CSS for shadow-stacked edge layers and ensure overlay uses `pointer-events: none` with lightweight transform-based rendering.
- [x] 3.3 Integrate reduced-motion behavior so section drop animation is disabled or effectively instant when motion reduction is enabled.

## 4. Validation & Regression Coverage

- [x] 4.1 Update `src/app/selfTest.ts` to cover pointer-based section reordering and verify persistence after refresh/reload flows.
- [x] 4.2 Add/extend self-test assertions for reduced-motion section drop behavior and overlay lifecycle.
- [x] 4.3 Run project validation commands and verify task DnD regressions are not introduced by section DnD changes.
