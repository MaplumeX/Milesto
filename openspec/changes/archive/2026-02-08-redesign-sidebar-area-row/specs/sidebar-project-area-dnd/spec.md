## MODIFIED Requirements

### Requirement: Sidebar supports manual ordering of Areas
The system SHALL allow the user to reorder Areas from the Sidebar.

#### Scenario: Reorder areas with pointer drag
- **WHEN** the user drags an Area entry in the Sidebar to a new position
- **THEN** the Sidebar SHALL immediately reflect the new order
- **AND THEN** the new Area order SHALL be persisted
- **AND THEN** reopening the app (or refreshing the Sidebar model) SHALL keep the same Area order

#### Scenario: Reorder areas with keyboard equivalent
- **WHEN** the user focuses an Area entry in the Sidebar and triggers the keyboard reorder shortcut (e.g. Cmd/Ctrl+Shift+ArrowUp/ArrowDown)
- **THEN** the Sidebar SHALL move the focused Area up/down by one position
- **AND THEN** the new Area order SHALL be persisted

#### Scenario: Reorder areas while focus is on an Area control
- **WHEN** the user focuses a focusable control within the Area entry (e.g. the Area collapse button)
- **AND WHEN** the user triggers the keyboard reorder shortcut (e.g. Cmd/Ctrl+Shift+ArrowUp/ArrowDown)
- **THEN** the Sidebar SHALL move the owning Area up/down by one position
- **AND THEN** the new Area order SHALL be persisted

### Requirement: Sidebar supports manual ordering of Projects within a group
The system SHALL allow the user to reorder Projects within the same Sidebar group.

#### Scenario: Reorder projects within an Area group
- **WHEN** the user drags a Project within the same Area group to a new position
- **THEN** the Sidebar SHALL immediately reflect the new order
- **AND THEN** the new Project order for that Area group SHALL be persisted

#### Scenario: Reorder projects within the unassigned group
- **WHEN** the user drags a Project within the unassigned (no Area) group to a new position
- **THEN** the Sidebar SHALL immediately reflect the new order
- **AND THEN** the new Project order for the unassigned group SHALL be persisted

#### Scenario: Reorder projects with keyboard equivalent
- **WHEN** the user focuses a Project entry in the Sidebar and triggers the keyboard reorder shortcut (e.g. Cmd/Ctrl+Shift+ArrowUp/ArrowDown)
- **THEN** the Sidebar SHALL move the focused Project up/down by one position within its current group
- **AND THEN** the new Project order for that group SHALL be persisted
