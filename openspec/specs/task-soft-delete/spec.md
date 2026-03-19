# task-soft-delete Specification

## Purpose
Define how tasks are soft-deleted, surfaced through Trash, restored, and permanently removed.
## Requirements
### Requirement: User can soft-delete the open task from the edit-mode bottom bar
When a task editor is currently open, the user SHALL be able to delete the open task via the edit-mode bottom bar `Delete` action.

Deletion MUST be implemented as a soft delete by setting `deleted_at` to a non-null timestamp.

The system MUST ask for confirmation before deleting.

#### Scenario: Confirming Delete soft-deletes the open task and closes the editor
- **WHEN** a task editor is currently open for task `<taskId>`
- **AND** the user clicks `Delete`
- **AND** the user confirms the deletion
- **THEN** the task `<taskId>` is persisted with `deleted_at` set to a non-null timestamp
- **AND** the task editor closes

#### Scenario: Canceling Delete does nothing
- **WHEN** a task editor is currently open
- **AND** the user clicks `Delete`
- **AND** the user cancels the confirmation
- **THEN** the task is not deleted
- **AND** the task editor remains open

### Requirement: Delete safely flushes pending edits before deleting
Before deleting the open task, the system MUST attempt to flush the task editor's pending changes.

If flushing fails, the system MUST NOT delete the task.

#### Scenario: Flush failure prevents deletion and focuses the editor error target
- **WHEN** a task editor is currently open
- **AND** flushing pending changes for the open task editor fails
- **AND** the user confirms the deletion
- **THEN** the system SHALL NOT delete the task
- **AND** the task editor SHALL remain open
- **AND** the system SHALL move focus to the task editor's last error target

### Requirement: Soft-deleted tasks are not visible in task surfaces
The system SHALL hide soft-deleted tasks from active task surfaces while keeping directly deleted task roots recoverable through Trash until they are permanently removed.

After a task is soft-deleted:

- it MUST NOT appear in active task list surfaces
- fetching task detail for that task in `active` scope MUST fail with a not-found result

Until that task is permanently removed:

- fetching task detail for that task in `trash` scope MUST succeed
- the task SHALL remain recoverable through Trash semantics

If the task later becomes part of a deleted project tree, the task MUST stop appearing as a standalone Trash root and MUST instead be absorbed by that project's Trash root.

#### Scenario: Deleted task no longer appears in active lists
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** active task list surfaces MUST NOT include `<taskId>`

#### Scenario: Deleted task cannot be fetched by active detail
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** fetching task detail for `<taskId>` in `active` scope fails with a not-found result

#### Scenario: Directly deleted task remains recoverable until permanently removed
- **WHEN** task `<taskId>` is soft-deleted directly
- **AND** its parent project is not a deleted project root
- **THEN** `<taskId>` remains recoverable through Trash until it is permanently removed

#### Scenario: Deleted task can be fetched by trash detail
- **WHEN** task `<taskId>` is soft-deleted directly
- **AND** its parent project is not a deleted project root
- **WHEN** the client fetches task detail for `<taskId>` in `trash` scope
- **THEN** the request succeeds
- **AND** `<taskId>` remains recoverable through Trash until it is permanently removed

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

### Requirement: Soft-deleted tasks can be restored with parent-aware fallback
The system SHALL allow a soft-deleted task to be restored while it remains recoverable in Trash.

If the task's original active parent still exists, the task SHALL return to that parent.

If the task's original parent project or direct parent Area no longer exists, the task SHALL be restored into Inbox instead.

#### Scenario: Restoring a task returns it to its original active project
- **WHEN** task `T1` is soft-deleted
- **AND** `T1`'s original project still exists and is active
- **WHEN** the user restores `T1`
- **THEN** `T1` is restored to that project

#### Scenario: Restoring a task with a missing parent returns it to Inbox
- **WHEN** task `T1` is soft-deleted
- **AND** `T1`'s original parent project or direct parent Area no longer exists
- **WHEN** the user restores `T1`
- **THEN** `T1` is restored into Inbox

### Requirement: Permanently removed tasks are no longer recoverable
The system SHALL support permanently removing a previously soft-deleted task.

After a task has been permanently removed, it MUST NOT appear as a recoverable Trash task root.

#### Scenario: Permanently removed task is not recoverable
- **WHEN** task `T1` has already been soft-deleted
- **AND** the user permanently removes `T1`
- **THEN** `T1` no longer appears as a recoverable Trash task root
