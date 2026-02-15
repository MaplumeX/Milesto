## ADDED Requirements

### Requirement: Logbook completed projects list shows project progress control
When rendering the Completed Projects list on the Logbook page, the UI SHALL render the project progress control next to each project title.

The progress control SHALL be interactive and SHALL follow the complete/reopen behaviors defined by `project-progress-indicator`.

The progress control SHALL NOT be nested inside the project title navigation link.

#### Scenario: Completed projects list renders progress control for each project
- **WHEN** the user views `/logbook`
- **AND WHEN** the Completed Projects list is rendered
- **THEN** each completed project row includes the project progress control next to its title
