## ADDED Requirements

### Requirement: Cancelling a project cancels open tasks in that project
The system SHALL allow the user to mark a Project as cancelled from project-level action surfaces.

When the user cancels a project:

- The Project status SHALL become `cancelled`.
- All non-deleted Tasks with `project_id = <that project>` and `status = open` SHALL become `cancelled`.
- Tasks in that project that are already `done` or `cancelled` SHALL remain unchanged.

#### Scenario: Cancel project with open tasks
- **WHEN** the user cancels a project that has open tasks
- **THEN** the project SHALL be updated to status `cancelled`
- **AND** all open tasks in the project SHALL be updated to status `cancelled`

#### Scenario: Cancel project preserves already-closed tasks
- **WHEN** the user cancels a project that already has tasks with statuses `done` and `cancelled`
- **THEN** those tasks SHALL keep their existing statuses

### Requirement: Project cancellation requires confirmation
Cancelling a project impacts multiple records and removes the project from active work, so the UI SHALL require explicit user confirmation before applying the change.

#### Scenario: User cancels project cancellation
- **WHEN** the user initiates project cancellation
- **AND** the user cancels the confirmation
- **THEN** the project SHALL remain unchanged
- **AND** tasks in the project SHALL remain unchanged

### Requirement: Project cancellation is atomic
Project cancellation (project status update + open task status updates) SHALL be applied atomically.

#### Scenario: No partial cancellation
- **WHEN** project cancellation fails
- **THEN** the project SHALL NOT be left in a partially-cancelled state

## MODIFIED Requirements

### Requirement: Reopening a project does not restore tasks
The system SHALL allow the user to reopen a closed Project.

When reopening a project:

- The Project status SHALL become `open`.
- Tasks in that project SHALL NOT be automatically restored to `open`.

#### Scenario: Reopen project keeps done and cancelled tasks closed
- **WHEN** the user reopens a project that has tasks with statuses `done` and `cancelled`
- **THEN** the project SHALL be updated to status `open`
- **AND** tasks in the project SHALL remain in their existing terminal statuses unless the user changes them individually
