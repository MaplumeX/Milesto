## MODIFIED Requirements

### Requirement: Project header shows completion control and overflow menu
The Project header SHALL include:

- A completion control whose visual state reflects the project completion status.
- A visible project title.
- An overflow menu button for project-level actions.

If the persisted Project title is an empty string (or whitespace-only), the displayed title label SHALL render a localized placeholder using `common.untitled`.

The completion control in the Project header SHALL be the project progress control defined by `project-progress-indicator`.

#### Scenario: Header reflects open vs done
- **WHEN** the project status is `open`
- **THEN** the header completion control SHALL render in the open style
- **WHEN** the project status is `done`
- **THEN** the header completion control SHALL render in the done style

#### Scenario: Done project can be reopened from the header control
- **WHEN** the project status is `done`
- **AND WHEN** the user activates the header completion control
- **THEN** the project status SHALL become `open`
- **AND THEN** the system SHALL remain on `/projects/:projectId`

#### Scenario: Empty persisted title is displayed as a placeholder
- **WHEN** the Project title is an empty string (or whitespace-only)
- **THEN** the Project page title label SHALL display `common.untitled`
