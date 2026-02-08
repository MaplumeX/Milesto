## ADDED Requirements

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
After a task is soft-deleted, it MUST NOT appear in task list surfaces or in task detail fetching.

#### Scenario: Deleted task no longer appears in lists
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** task list surfaces MUST NOT include `<taskId>`

#### Scenario: Deleted task cannot be fetched by detail
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** fetching task detail for `<taskId>` fails with a not-found result
