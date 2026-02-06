## Why

Project sections are currently rendered in `position` order but cannot be reordered from the UI, which makes long projects hard to organize as priorities change. Users can already drag tasks, so adding section-level reordering now closes a core interaction gap on the Project page.

## What Changes

- Enable drag-and-drop reordering for project section header rows on the Project page.
- Persist section order changes to `project_sections.position` through a dedicated project section reorder API/IPC/DB action path.
- Add a section drag preview style using shadow-stacked edges (scheme 1): no real task thumbnails, only layered shadow/card depth.
- Keep existing task drag behavior (within-section reorder and cross-section move) intact and non-conflicting with section drag.
- Provide keyboard-equivalent section reorder behavior and reduced-motion-compatible drag/drop transitions.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `project-page`: change section-header drag behavior from non-draggable to draggable, add section reorder persistence semantics, and define section drag preview behavior.

## Impact

- Renderer DnD logic and row modeling in `src/features/tasks/ProjectGroupedList.tsx`.
- Drag preview styling in `src/index.css` and reduced-motion behavior alignment with existing DnD motion config.
- Project API and IPC surface in `shared/window-api.ts`, `electron/preload.ts`, and `electron/main.ts`.
- DB worker actions for project sections in `electron/workers/db/actions/project-actions.ts` (batch reorder action).
- Project page specification deltas in `openspec/changes/section-dnd/specs/project-page/spec.md`.
