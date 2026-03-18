## MODIFIED Requirements

### Requirement: Soft-deleted tasks are not visible in task surfaces
The system SHALL hide soft-deleted tasks from active task surfaces while keeping directly deleted task roots recoverable through Trash until they are permanently removed.

After a task is soft-deleted, it MUST NOT appear in active task list surfaces or in task detail fetching.

Until that task is permanently removed, the system SHALL keep it recoverable through Trash semantics.

If the task later becomes part of a deleted project tree, the task MUST stop appearing as a standalone Trash root and MUST instead be absorbed by that project's Trash root.

#### Scenario: Deleted task no longer appears in active lists
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** active task list surfaces MUST NOT include `<taskId>`

#### Scenario: Deleted task cannot be fetched by detail
- **WHEN** task `<taskId>` is soft-deleted
- **THEN** fetching task detail for `<taskId>` fails with a not-found result

#### Scenario: Directly deleted task remains recoverable until permanently removed
- **WHEN** task `<taskId>` is soft-deleted directly
- **AND** its parent project is not a deleted project root
- **THEN** `<taskId>` remains recoverable through Trash until it is permanently removed

## ADDED Requirements

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
