## Context

Milesto already has three adjacent but distinct interaction models:

- task rows use a true secondary-click context menu anchored to pointer coordinates
- Area and Project pages use overflow menus anchored to `...` buttons
- Sidebar Areas / Projects and Project section headers support selection, drag/drop, and inline editing, but not entity context menus

This change adds non-task context menus without collapsing those interaction models into one product surface. The largest technical risk is section transfer: today `project_sections` belong to a project, tasks reference both `project_id` and `section_id`, and per-section task ordering is stored in `list_positions` under `project:<projectId>:<sectionId>`. A cross-project section move therefore needs one transactional operation that keeps all three in sync.

## Goals / Non-Goals

**Goals:**
- Add secondary-click context menus for Sidebar Area and Project entries.
- Add secondary-click context menus for Project section headers.
- Reuse existing entity action semantics where practical without forcing parity with overflow menus.
- Introduce a safe cross-project section move operation that moves the section and all child tasks together.
- Preserve keyboard focus, list selection, and route stability after menu actions.

**Non-Goals:**
- Do not redesign existing Area or Project overflow menus to mirror the new context menus.
- Do not add context menus to non-entity Sidebar navigation items.
- Do not support moving sections into Trash, into deleted projects, or into closed projects.
- Do not change the visual information architecture of Sidebar rows or Project section headers beyond the new secondary-click affordance.

## Decisions

### 1. Keep overflow menus and context menus as separate product surfaces

The change intentionally keeps secondary-click menus separate from `...` overflow menus. They can share low-level action helpers and subviews, but they do not have to present the same root actions.

Alternative considered:
- Reuse overflow menu contents verbatim for all right-click menus. Rejected because the user explicitly does not want content parity to be a design constraint, and Sidebar / section workflows are more context-specific.

### 2. Use inline Sidebar rename editors for Area and Project rows

Sidebar `Rename` actions for Areas and Projects will close the context menu and switch the clicked Sidebar row into inline title editing without changing the current route. The inline editor follows the existing title-editing semantics: `Enter` commits, `Escape` cancels, and `blur` commits unless cancellation already consumed the blur event.

Alternative considered:
- Reuse page title editing by navigating to `/areas/:id?editTitle=1` or `/projects/:id?editTitle=1`. Rejected because the user expects the rename action to have an immediate visible effect on the Sidebar row they acted on, even when they are currently viewing a different route.

### 3. Add a dedicated `project.section.move` DB action

Section transfer cannot be safely composed from current `project.update` and `task.update` calls because current validation does not guarantee that `tasks.project_id` and `tasks.section_id` remain project-consistent across a cross-project move.

The new action should:
- validate source section and target project
- restrict targets to active, open projects
- treat choosing the current project as a no-op
- update `project_sections.project_id`
- update `tasks.project_id` for every task currently in the section
- keep `tasks.section_id` unchanged
- append the moved section to the target project's section order
- compact source-project section order
- migrate affected `list_positions` rows from `project:<sourceProjectId>:<sectionId>` to `project:<targetProjectId>:<sectionId>`
- record sync/list mutations in one transaction

Alternative considered:
- Recreate the section under a new ID in the target project and remap all tasks. Rejected because it adds unnecessary identity churn and makes list-position migration more complex.

### 4. Sidebar project move uses an area-picker subview with current selection state

Sidebar Project context menus will expose `Move` as an area-picker subview that lists all Areas plus the unassigned state. The current Area assignment remains visible as the selected option. Choosing the current option is a no-op.

Alternative considered:
- Trigger move via direct drag-only ownership changes. Rejected because the user explicitly wants a right-click path in addition to drag/drop.

### 5. Project section move uses a project-picker subview with deterministic target placement

Project section context menus will expose `Move` as a project-picker subview listing all open projects, including the current project in a selected state. Selecting another project moves the section and all child tasks, and the section is appended to the target project's section list.

Alternative considered:
- Ask for both target project and target position. Rejected because the user explicitly chose “append to target project section list tail”.

### 6. The current Project page remains in place after section move or delete

After moving or deleting a section from the current Project page, the app stays on the current route and refreshes the current project view. If the removed section was selected, selection falls forward to the next visible row, otherwise backward to the previous visible row, otherwise clears.

Alternative considered:
- Navigate to the target project after a move. Rejected because the user explicitly chose to stay on the current page.

## Risks / Trade-offs

- [Cross-project consistency bugs] → Implement section transfer as one DB transaction with explicit validation and ordering migration.
- [Menu duplication across surfaces] → Share internal action helpers/subviews where it reduces duplication, but keep separate surface-level menu definitions.
- [Selection/focus churn after section removal] → Use deterministic row fallback and explicit focus restoration to the section header opener when dismissing without mutation.
- [Future closed-project edge cases] → Restrict section move targets to open projects and document Trash / closed-project moves as out of scope for this change.

## Migration Plan

- No database schema migration is required.
- Add the new DB action, preload bridge, and window API method for section transfer.
- Update renderer context-menu entrypoints and menu content.
- Extend self-tests to cover Sidebar Area menu, Sidebar Project menu, section delete exposure, and cross-project section move behavior.
- Rollback strategy: remove the new renderer entrypoints and stop calling the new DB action; no persistent schema cleanup is required.

## Open Questions

- None at this stage.
