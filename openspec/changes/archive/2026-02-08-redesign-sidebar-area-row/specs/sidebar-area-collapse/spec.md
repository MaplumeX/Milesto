## ADDED Requirements

### Requirement: Sidebar Area groups can be collapsed and expanded
The system SHALL allow the user to collapse and expand each Area group in the Sidebar.

#### Scenario: Default state is expanded
- **WHEN** the Sidebar is rendered and there is no persisted collapse preference for an Area
- **THEN** the Area group SHALL be expanded
- **AND THEN** the Area’s nested Project entries (if any) SHALL be visible

#### Scenario: Collapse hides the nested Project list
- **WHEN** the user collapses an Area group in the Sidebar
- **THEN** the Area group header SHALL remain visible
- **AND THEN** the nested Project entries for that Area SHALL NOT be visible

#### Scenario: Expand reveals the nested Project list
- **WHEN** the user expands a previously-collapsed Area group in the Sidebar
- **THEN** the nested Project entries for that Area SHALL become visible

### Requirement: Area collapse control is accessible and does not navigate
The system SHALL provide a dedicated collapse/expand control on each Area header.

#### Scenario: Keyboard toggle updates expanded state without changing route
- **WHEN** the user focuses the Area collapse control and presses Enter or Space
- **THEN** the system SHALL toggle the expanded/collapsed state for that Area group
- **AND THEN** the collapse control SHALL reflect the state via `aria-expanded`
- **AND THEN** the current route SHALL remain unchanged

### Requirement: Collapsed Area state is persisted across restarts
The system SHALL persist the collapsed/expanded state per Area and restore it on app launch.

#### Scenario: Collapsed state is restored on restart
- **WHEN** the user collapses one or more Area groups
- **AND WHEN** the user closes and reopens the app
- **THEN** the Sidebar SHALL restore the same set of collapsed Area groups

#### Scenario: Invalid persisted state is ignored safely
- **WHEN** the persisted collapsed Area state is missing, invalid, or cannot be parsed
- **THEN** the system SHALL treat the collapsed set as empty (all Areas expanded)

### Requirement: Sidebar Area header renders as a row with a folder icon
The system SHALL render the Area header as a row-style interactive element consistent with Project rows, including a leading folder icon.

#### Scenario: Folder icon is decorative and inherits state styling
- **WHEN** the Sidebar renders an Area header row
- **THEN** a folder icon SHALL be shown before the Area title
- **AND THEN** the icon SHALL be decorative (not the accessible name)
- **AND THEN** the icon’s visual styling SHALL follow the row’s current state (e.g., hover/active) by inheriting the row’s color
