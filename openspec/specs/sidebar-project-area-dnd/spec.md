# sidebar-project-area-dnd Specification

## Purpose
TBD - created by archiving change sidebar-project-area-dnd. Update Purpose after archive.
## Requirements
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

### Requirement: Sidebar supports moving Projects across Areas (change ownership)
The system SHALL allow the user to move a Project between Sidebar groups by drag-and-drop, changing the Project's owning Area.

#### Scenario: Move a project from one Area to another
- **WHEN** the user drags a Project from Area A and drops it into Area B at a specific insertion position
- **THEN** the system SHALL update the Project's `area_id` to Area B
- **AND THEN** the Sidebar SHALL reflect the Project in Area B at the intended position
- **AND THEN** the ordering of Projects in both Area A and Area B groups SHALL be persisted

#### Scenario: Move a project between Area and unassigned
- **WHEN** the user drags a Project from an Area group and drops it into the unassigned group
- **THEN** the system SHALL set the Project's `area_id` to null
- **AND THEN** the Sidebar SHALL reflect the Project in the unassigned group at the intended position

#### Scenario: Drop into an empty Area group
- **WHEN** the user drags a Project and drops it into an Area group that currently has no Projects
- **THEN** the Project SHALL become a member of that Area group
- **AND THEN** the Sidebar SHALL show the Project as the first item in that group

### Requirement: Default ordering remains alphabetical until manual ordering is used
The system SHALL preserve the existing alphabetical ordering behavior for users who have not used manual ordering.

Alphabetical ordering MUST be based on the user-visible display label. If a Project or Area title is empty (or whitespace-only), the display label SHALL be `common.untitled` and ordering SHALL use that label.

#### Scenario: Fresh data shows alphabetical order
- **WHEN** the user has never manually reordered Areas or Projects in the Sidebar
- **THEN** Areas SHALL be ordered by display title (case-insensitive)
- **AND THEN** Projects within each group (unassigned or an Area) SHALL be ordered by display title (case-insensitive)

#### Scenario: Empty titles have stable ordering using display label
- **WHEN** one or more Projects or Areas have an empty (or whitespace-only) persisted title
- **THEN** Sidebar ordering rules SHALL treat their display title as `common.untitled` for ordering purposes

### Requirement: Drag-and-drop persistence failures are safe and recoverable
The system SHALL not leave the Sidebar in a partial or inconsistent state when persistence fails.

#### Scenario: Persistence fails during reorder
- **WHEN** the user reorders Areas or Projects in the Sidebar
- **AND WHEN** the persistence operation fails
- **THEN** the Sidebar SHALL revert to the pre-drag ordering
- **AND THEN** the UI SHALL present a user-visible error using only `code` and `message`

#### Scenario: Persistence fails during cross-Area move
- **WHEN** the user moves a Project across groups by drag-and-drop
- **AND WHEN** the persistence operation fails
- **THEN** the Sidebar SHALL revert to the pre-drag state (original group + ordering)
- **AND THEN** the Project's ownership (`area_id`) SHALL remain unchanged from the user's perspective

