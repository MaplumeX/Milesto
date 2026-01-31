## Context

- Project page is rendered at `src/pages/ProjectPage.tsx` and task grouping is implemented in `src/features/tasks/ProjectGroupedList.tsx` (virtualized).
- Global bottom bar is rendered in `src/app/AppShell.tsx` as `.content-bottom-bar`.
- Project sections are currently created via overflow menu + `prompt('New section title')` and validated by `ProjectSectionCreateInputSchema` (currently `min(1)`).

Constraints / decisions already agreed:

- `+ Section` is on the global bottom bar (only for `/projects/:projectId`).
- No-section group header is removed from the Project page list.
- Sections can be persisted with empty-string titles; UI must show a placeholder label for empty titles.

## Goals / Non-Goals

**Goals:**

- Reduce friction for creating sections on the Project page by moving the entrypoint to the bottom bar.
- After creation, immediately focus an inline title editor in the new section header.
- Maintain keyboard-first behavior (focus, Enter/Escape, propagation vs listbox handlers) and preserve virtualization performance.
- Ensure empty-title sections remain usable and readable via consistent placeholder rendering.

**Non-Goals:**

- Redesign the full Project page layout, typography, or the section header actions beyond what is required.
- Change section ordering/reordering behavior.
- Add new persistence for the completed toggle state.

## Decisions

1) Allow empty-string section titles in schema validation

- Decision: Update `shared/schemas/project.ts` so `ProjectSectionSchema.title`, `ProjectSectionCreateInputSchema.title`, and `ProjectSectionRenameInputSchema.title` allow empty strings.
- Rationale: Required to support “create first, name later” with an immediately persisted section.
- Alternatives:
  - Create with placeholder title and immediately rename: avoids empty titles in DB but violates requirement.
  - Use temporary UI-only section until name is provided: cleaner data but violates requirement.

2) Placeholder label for empty titles

- Decision: UI renders empty titles as `(untitled)` (display-only; stored title remains empty string).
- Rationale: Avoid blank labels in section headers and dropdowns.

3) Triggering project-only bottom bar actions

- Decision: Add `+ Section` button in `AppShell` only when route matches `/projects/:projectId`.
- Decision: Use a small, explicit signaling mechanism from `AppShell` to `ProjectPage` to initiate section creation.
  - Preferred: dispatch a `CustomEvent` (e.g. `milesto:project.createSection`) with `{ projectId }`.
  - Alternative: lift state into a context provider; heavier change.

4) Inline section title editing within a virtualized list

- Decision: `ProjectGroupedList` receives “editing section id” state (or a dedicated “newly created section id”) and renders an inline `<input>` for that section header row.
- Decision: Key handling:
  - Enter: commit rename if value differs from current title.
  - Escape: cancel edit (keep persisted empty title).
  - All editor keystrokes must stop propagation so listbox-level Arrow/Space/Enter handlers do not interfere.

5) Remove no-section header row

- Decision: do not create a separate group header for `section_id = null`. Those tasks render first in the list without an extra header row.
- Rationale: reduces noise while retaining discoverability of ungrouped tasks.

## Risks / Trade-offs

- [Empty title persists in DB] → Mitigation: consistent placeholder rendering in headers and dropdowns; avoid empty option labels.
- [Inline edit + virtualization focus/measurement pitfalls] → Mitigation: focus after refresh/render; ensure row is measured; stop propagation; avoid scroll anchoring issues.
- [Coupling between AppShell and ProjectPage] → Mitigation: use explicit event name + typed payload, and keep it project-route-scoped.
