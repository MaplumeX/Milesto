## ADDED Requirements

### Requirement: Completing a project completes all tasks in that project
The system SHALL allow the user to mark a Project as completed from the Project page.

When the user completes a project:

- The Project status SHALL become `done`.
- All non-deleted Tasks with `project_id = <that project>` SHALL become `done`.

#### Scenario: Complete project with open tasks
- **WHEN** the user completes a project that has open tasks
- **THEN** the project SHALL be updated to status `done`
- **AND** all tasks in the project SHALL be updated to status `done`

#### Scenario: Complete project with already-done tasks
- **WHEN** the user completes a project that already has some done tasks
- **THEN** those tasks SHALL remain `done`

### Requirement: Project completion requires confirmation
Completing a project impacts multiple records (the project and its tasks), so the UI SHALL require explicit user confirmation before applying the change.

#### Scenario: User cancels completion
- **WHEN** the user initiates project completion
- **AND** the user cancels the confirmation
- **THEN** the project SHALL remain unchanged
- **AND** tasks in the project SHALL remain unchanged

### Requirement: Project completion is atomic
Project completion (project status update + task status updates) SHALL be applied atomically.

#### Scenario: No partial completion
- **WHEN** project completion fails
- **THEN** the project SHALL NOT be left in a partially-completed state

### Requirement: Reopening a project does not restore tasks
The system SHALL allow the user to reopen a completed Project.

When reopening a project:

- The Project status SHALL become `open`.
- Tasks in that project SHALL NOT be automatically restored to `open`.

#### Scenario: Reopen project keeps tasks done
- **WHEN** the user reopens a project that has done tasks
- **THEN** the project SHALL be updated to status `open`
- **AND** tasks in the project SHALL remain status `done` unless the user changes them individually
