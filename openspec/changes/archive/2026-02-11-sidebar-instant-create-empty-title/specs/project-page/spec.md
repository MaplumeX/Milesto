## MODIFIED Requirements

### Requirement: Project header shows completion control and overflow menu
The Project header SHALL include:

- A checkbox whose checked state reflects the project completion status.
- A visible project title.
- An overflow menu button for project-level actions.

If the persisted Project title is an empty string (or whitespace-only), the displayed title label SHALL render a localized placeholder using `common.untitled`.

#### Scenario: Header reflects open vs done
- **WHEN** the project status is `open`
- **THEN** the header checkbox SHALL be unchecked
- **WHEN** the project status is `done`
- **THEN** the header checkbox SHALL be checked

#### Scenario: Empty persisted title is displayed as a placeholder
- **WHEN** the Project title is an empty string (or whitespace-only)
- **THEN** the Project page title label SHALL display `common.untitled`
