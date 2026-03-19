## 1. Shared Contracts and DB Scope Support

- [x] 1.1 Add shared `scope: 'active' | 'trash'` inputs/results for the task and project APIs that need deleted-scope behavior.
- [x] 1.2 Extend `task.*` DB actions to support `scope=trash` for deleted task detail, updates, done toggles, and project-scoped creation without restoring the task.
- [x] 1.3 Extend `project.*` DB actions to support `scope=trash` for deleted project detail, section/task lists, done counts, updates, and section creation without restoring the project.
- [x] 1.4 Confirm project restore/purge flows still include descendants created after deletion, and tighten the SQL if needed.

## 2. Trash Work List Renderer

- [x] 2.1 Refactor `/trash` to render an open-first mixed work list with only the title and `Empty Trash` in the page chrome.
- [x] 2.2 Remove per-row restore/purge buttons from Trash rows and keep stable row identity/hooks for future context-menu actions.
- [x] 2.3 Wire Trash task rows into the existing task selection + inline editor flow so `Enter`/double-click opens deleted tasks in place.
- [x] 2.4 Wire Trash project rows to navigate to `/projects/:projectId?scope=trash` while preserving single-click selection behavior.

## 3. Project Page Trash Scope

- [x] 3.1 Add `scope=trash` routing/context detection to the Project page and load deleted project data through the new scoped APIs.
- [x] 3.2 Keep deleted project editing on the normal Project page layout while preserving deleted state for project/task/section saves.
- [x] 3.3 Support `+ Task` and `+ Section` inside a deleted project so new descendants start deleted and stay in the deleted tree.
- [x] 3.4 Hide trash-unsafe project and task actions in trash scope, including move/delete actions that assume active destinations or active deletion semantics.

## 4. Verification

- [x] 4.1 Add DB-level coverage for active-vs-trash detail visibility, trash-scope saves, deleted-project descendant creation, and restore/purge propagation.
- [x] 4.2 Extend renderer/self-test coverage for open-first Trash interactions, inline editing of deleted tasks, and navigation/editing on `/projects/:projectId?scope=trash`.
- [x] 4.3 Run the relevant verification commands and confirm the change is apply-ready.
