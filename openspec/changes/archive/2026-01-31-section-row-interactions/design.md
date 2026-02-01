## Context

The Project page task list is implemented as a single `role="listbox"` container with a virtualized row model (`rows`) that mixes:

- task rows (selectable; Return/double-click opens inline task editor)
- project section/group header rows (currently not selectable; only newly-created sections enter inline title edit)

Today, keyboard navigation in the Project listbox intentionally skips section header rows, so section headers are not reachable via ArrowUp/ArrowDown. Additionally, existing sections can only be renamed via a `Rename` button that uses `prompt()`, not via the same Return/double-click affordances used for tasks.

We also have an important safety constraint: task inline editor drafts are flushed before switching tasks (`AppShell.openTask`) and before closing the editor (`TaskInlineEditorRow.attemptClose`). Entering section title edit MUST follow the same flush semantics to avoid data loss.

Relevant components/files:

- `src/features/tasks/ProjectGroupedList.tsx` (virtualized mixed rows + listbox keyboard handler)
- `src/pages/ProjectPage.tsx` (`editingSectionId` state + section CRUD)
- `src/app/AppShell.tsx` (task selection/open state + flush semantics for task switching)
- `src/features/tasks/TaskInlineEditorRow.tsx` and `src/features/tasks/TaskEditorPaper.tsx` (flush + focusLastErrorTarget)
- `src/index.css` (selection visuals)

## Goals / Non-Goals

**Goals:**

- Make project section header rows selectable in the Project listbox (ArrowUp/ArrowDown moves selection across both section header rows and task rows).
- Keep selection semantics consistent with tasks:
  - Click selects; selection MUST NOT auto-open editors.
  - Return/Enter activates the selected row.
- Row activation behavior:
  - Task row: Return/Enter opens inline task editor (existing behavior).
  - Section header row: Return/Enter enters inline section title editing for that section.
- Mouse behavior:
  - Click section header selects the section and clears task selection.
  - Double-click section title enters inline section title editing.
- Safety: Entering section title edit MUST first attempt to safely close any open task inline editor by flushing pending changes. If flush fails, do not enter section edit and focus the error target.

**Non-Goals:**

- Implement roving DOM focus across rows (focus may remain on the listbox container; selection is the highlighted row).
- Change ARIA roles/semantics of the list structure (we keep the existing composite with interactive children).
- Add section collapse/expand behaviors or reordering.

## Decisions

1) **ProjectGroupedList uses a local "selected row" model in addition to TaskSelectionContext**

- **Decision**: Add a local selection state for the mixed `rows` list (e.g. `selectedRowIndex` or a tagged union identifying either a task row or a section row).
- **Rationale**: `TaskSelectionContext.selectedTaskId` cannot represent selection of section header rows. We also need Arrow navigation to land on empty sections (a requirement in `openspec/specs/project-page/spec.md`).
- **Alternative**: Extend global `TaskSelectionContext` to represent non-task selection. Rejected: over-broad; impacts all list views.

2) **Entering section edit requires a safe-close API for the open task editor**

- **Decision**: Add a new capability exposed via `TaskSelectionContext` (implemented in `AppShell`) that attempts to close the current open task editor safely (flush drafts first, focus error target on failure).
- **Rationale**: `closeTask()` does not flush. We must reuse flush semantics already used for switching tasks (`AppShell.openTask`) and closing (`TaskInlineEditorRow.attemptClose`).
- **Alternative**: Invoke DOM events or reach into editor refs from ProjectGroupedList. Rejected: leaky, brittle, violates encapsulation.

3) **Selection of a section clears task selection**

- **Decision**: When selecting a section row (via click or Arrow navigation), set `TaskSelectionContext.selectTask(null)`.
- **Rationale**: Prevent "double selection" confusion (a task highlighted while a section is highlighted). Aligns with user choice 1A.

4) **Initial selection behavior**

- **Decision**: If no row is selected, first `ArrowDown` selects `rows[0]` (not automatic selection on focus).
- **Rationale**: Matches existing list behavior patterns and avoids surprising automatic changes.

## Risks / Trade-offs

- **[Risk] Mixed interactive children + listbox semantics can be tricky for accessibility** → **Mitigation**: Do not change existing ARIA model; keep keyboard interactions predictable and ensure selection highlight is visually distinct from focus.
- **[Risk] Virtualized rows + selection index drift after refresh** → **Mitigation**: When `rows` changes, if the selected row no longer exists, fall back to the nearest valid index; mirror the existing task selection fallback logic.
- **[Risk] Section header contains action buttons (Rename/Delete)** → **Mitigation**: Bind double-click-to-edit only to the title/left area and ensure action buttons stop propagation for pointer events.
- **[Risk] Safe-close blocks section edit when flush fails** → **Mitigation**: This is desired; focusLastErrorTarget ensures the user can resolve errors and retry.
