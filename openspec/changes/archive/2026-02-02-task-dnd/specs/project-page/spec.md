## ADDED Requirements

### Requirement: Project page supports drag-and-drop reordering within a section
On the Project page tasks list, the system SHALL allow users to reorder open tasks within the same section via drag-and-drop, with a visible drag preview.

#### Scenario: User reorders a task within its section
- **WHEN** the user drags a task within the same project section
- **THEN** the system SHALL show a drag preview
- **AND** releasing the pointer SHALL update the task order within that section
- **AND** the updated order SHALL persist after refresh

### Requirement: Project page supports moving tasks across sections via drag-and-drop
On the Project page tasks list, the system SHALL allow users to drag a task from one section group to another section group.

Dropping onto an empty section group SHALL be supported.

#### Scenario: User drags a task into a different section
- **WHEN** the user drags a task from one project section group to another
- **THEN** releasing the pointer SHALL move the task into the destination section
- **AND** the task SHALL appear in the destination section group after refresh

#### Scenario: User drops into an empty section
- **WHEN** a project section group is empty
- **AND** the user drags a task over that empty section group
- **THEN** the UI SHALL indicate that dropping is allowed
- **AND** releasing the pointer SHALL move the task into that empty section

### Requirement: Only tasks are draggable; section headers are not draggable
Project section header rows SHALL NOT be draggable.

#### Scenario: User cannot drag a section header
- **WHEN** the user attempts to drag a project section header row
- **THEN** the system SHALL NOT enter drag mode

### Requirement: Keyboard equivalent exists for reordering within a section
The system SHALL provide a keyboard-only interaction to reorder a selected task within its current section on the Project page.

#### Scenario: Keyboard reorder within a section
- **WHEN** the Project tasks list has focus
- **AND** a task row is selected
- **WHEN** the user invokes the reorder keyboard shortcut to move the task up or down by one position
- **THEN** the system SHALL reorder the task within its section accordingly
- **AND** the updated order SHALL persist after refresh

### Requirement: Project cross-section moves remain achievable without drag-and-drop
The system SHALL provide a non-drag interaction that allows moving a task to a different section (for keyboard-only or accessibility needs).

#### Scenario: Keyboard-only user can move a task to another section
- **WHEN** the user cannot or does not use drag-and-drop
- **THEN** the user SHALL still be able to move a task to another section using existing controls (e.g. task editor Section selector)
