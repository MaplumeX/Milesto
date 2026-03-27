## Why

Sidebar Area and Project entries currently only support click, drag, and keyboard reorder flows, while Project sections only support rename and same-project reordering. That leaves several high-frequency entity actions buried in page-specific overflow menus or unavailable entirely, and makes section moves across projects impossible.

## What Changes

- Add secondary-click context menus for Sidebar Area entries with rename, delete, and tags actions.
- Add secondary-click context menus for Sidebar Project entries with plan, move, tags, due, mark done, cancel project, rename, and delete actions.
- Add secondary-click context menus for Project section headers with move and delete actions.
- Introduce a transactional section-move capability that moves a section and all of its tasks to another project, appending the section to the target project's section list.
- Keep context menus distinct from existing overflow menus; they may reuse underlying actions but do not need to mirror overflow menu contents.
- Keep the user on the current Project page after moving a section away; the moved section disappears from the current page after refresh.

## Capabilities

### New Capabilities
- `sidebar-entity-context-menus`: secondary-click menus for Sidebar Area and Project entries, including entity-specific actions and dismissal/focus behavior.
- `project-section-transfer`: section-level context menu actions and transactional cross-project section moves that carry all child tasks and preserve ordering invariants.

### Modified Capabilities
- `project-page`: project section headers gain a context-menu entrypoint and page-level selection/refresh behavior after section move or delete.

## Impact

- Affected renderer surfaces: [AppShell.tsx](/Users/maplume/.codex/worktrees/22fe/Milesto/src/app/AppShell.tsx), [ProjectPage.tsx](/Users/maplume/.codex/worktrees/22fe/Milesto/src/pages/ProjectPage.tsx), [ProjectGroupedList.tsx](/Users/maplume/.codex/worktrees/22fe/Milesto/src/features/tasks/ProjectGroupedList.tsx).
- Affected DB/API surfaces: project section actions in [project-actions.ts](/Users/maplume/.codex/worktrees/22fe/Milesto/electron/workers/db/actions/project-actions.ts), preload/window API, and list-position migration for moved sections.
- No new external dependencies are required.
