## MODIFIED Requirements

### Requirement: Soft-deleted tasks are not visible in task surfaces
The system SHALL hide soft-deleted tasks from active task surfaces while keeping directly deleted task roots recoverable through Trash until they are permanently removed.

After a task is soft-deleted:

- it MUST NOT appear in active task list surfaces
- fetching task detail for that task in `active` scope MUST fail with a not-found result

Until that task is permanently removed:

- fetching task detail for that task in `trash` scope MUST succeed
- the task MUST remain recoverable through Trash semantics

If the task later becomes part of a deleted project tree, the task MUST stop appearing as a standalone Trash root and MUST instead be absorbed by that project's Trash root.

#### Scenario: Deleted task no longer appears in active lists
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** active task list surfaces MUST NOT include `<taskId>`

#### Scenario: Deleted task cannot be fetched by active detail
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** fetching task detail for `<taskId>` in `active` scope fails with a not-found result

#### Scenario: Deleted task can be fetched by trash detail
- **WHEN** task `<taskId>` is soft-deleted directly
- **AND** its parent project is not a deleted project root
- **WHEN** the client fetches task detail for `<taskId>` in `trash` scope
- **THEN** the request succeeds
- **AND** `<taskId>` remains recoverable through Trash until it is permanently removed

## ADDED Requirements

### Requirement: Soft-deleted tasks can be edited in trash scope without being restored
The system SHALL allow a recoverable soft-deleted task to be edited in `trash` scope while keeping it deleted.

Editing in `trash` scope:

- MUST preserve `deleted_at`
- MUST keep the task in Trash
- MUST allow normal task content changes, including title, notes, schedule, due date, tags, checklist, and done/open status

#### Scenario: Editing a deleted task title keeps it deleted
- **WHEN** task `T1` is soft-deleted and not purged
- **WHEN** the user edits `T1`'s title in `trash` scope
- **THEN** the title change is persisted
- **AND THEN** `T1.deleted_at` remains non-null

#### Scenario: Toggling a deleted task done state keeps it deleted
- **WHEN** task `T1` is soft-deleted and not purged
- **WHEN** the user toggles `T1` from `open` to `done` in `trash` scope
- **THEN** the status change is persisted
- **AND THEN** `T1.deleted_at` remains non-null

