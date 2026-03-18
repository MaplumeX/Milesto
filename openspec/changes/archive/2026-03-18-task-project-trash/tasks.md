## 1. Data Model and DB Actions

- [x] 1.1 Add `purged_at` migrations for `tasks`, `projects`, and `project_sections`, and update active-surface queries to exclude purged rows.
- [x] 1.2 Implement DB read models for Trash root entries, including mixed ordering, project-root absorption, and open descendant task counts.
- [x] 1.3 Implement transactional Trash actions for restoring task roots with Inbox fallback and restoring full project trees with Area fallback.
- [x] 1.4 Implement transactional Trash purge actions for single task roots, single project roots, and emptying the current Trash set.

## 2. Shared Contracts and IPC

- [x] 2.1 Add shared Trash schemas and result types for mixed root entries and Trash action payloads/results.
- [x] 2.2 Expose `db:trash.*` handlers through DB dispatch, preload, and `window.api.trash.*` without reusing Logbook restore APIs.
- [x] 2.3 Ensure sync-facing entity updates record `purged_at` consistently so permanently removed roots stay hidden and non-restorable.

## 3. Renderer Integration

- [x] 3.1 Add the `/trash` route and Sidebar navigation entry after `Logbook`, including localized labels.
- [x] 3.2 Implement `TrashPage` data loading, error handling, and empty state around the new Trash APIs.
- [x] 3.3 Build the Trash mixed list UI for task roots and project roots, including the project open-task count indicator and restore/purge affordances.
- [x] 3.4 Wire Trash actions to refresh the page and keep selection/focus behavior stable after restore, purge, and empty-trash operations.

## 4. Verification

- [x] 4.1 Add DB-level tests for project-root absorption, Area-delete descendant surfacing, Inbox fallback restore, and ungrouped-project fallback restore.
- [x] 4.2 Extend renderer/self-test coverage for Trash navigation, mixed root ordering, restore flows, single purge, and empty-trash behavior.
- [x] 4.3 Run the relevant verification commands and confirm the change is apply-ready.
