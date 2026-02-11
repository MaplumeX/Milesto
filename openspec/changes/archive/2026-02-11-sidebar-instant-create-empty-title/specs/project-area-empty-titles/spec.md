## ADDED Requirements

### Requirement: Project titles may be an empty string when persisted
The system SHALL allow a Project title to be persisted as an empty string (`''`).

#### Scenario: Create a project with an empty title
- **WHEN** the system creates a Project with `title=''`
- **THEN** the Project SHALL be persisted successfully
- **AND THEN** reading the Project back through the API layer SHALL return `title=''`

### Requirement: Area titles may be an empty string when persisted
The system SHALL allow an Area title to be persisted as an empty string (`''`).

#### Scenario: Create an area with an empty title
- **WHEN** the system creates an Area with `title=''`
- **THEN** the Area SHALL be persisted successfully
- **AND THEN** reading the Area back through the API layer SHALL return `title=''`

### Requirement: UI renders a localized placeholder for empty Project/Area titles
When a Project or Area title is empty (or whitespace-only), the UI SHALL display a localized placeholder label using `common.untitled`.

#### Scenario: Sidebar displays placeholder instead of invisible row
- **WHEN** a Project title is empty
- **THEN** the Sidebar SHALL render the Project row label as `common.untitled`
- **WHEN** an Area title is empty
- **THEN** the Sidebar SHALL render the Area row label as `common.untitled`

#### Scenario: Lists and dropdowns display placeholder for empty titles
- **WHEN** a Project title is empty
- **THEN** any list or dropdown that displays the Project title SHALL display `common.untitled`
- **WHEN** an Area title is empty
- **THEN** any list or dropdown that displays the Area title SHALL display `common.untitled`

### Requirement: Inline title editing supports committing an empty title
Project and Area title inline editing SHALL allow committing an empty title.

#### Scenario: Commit empty title via inline title editor
- **WHEN** the user edits a Project or Area title
- **AND WHEN** the user commits an empty (or whitespace-only) value
- **THEN** the system SHALL persist the title as `''`
