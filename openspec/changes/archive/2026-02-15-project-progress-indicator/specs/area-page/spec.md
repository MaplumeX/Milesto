## ADDED Requirements

### Requirement: Area page project list shows project progress control
When rendering the Projects list on the Area page, the UI SHALL render the project progress control next to each project title.

The progress control SHALL be interactive and SHALL follow the complete/reopen behaviors defined by `project-progress-indicator`.

The progress control SHALL NOT be nested inside the project title navigation link.

#### Scenario: Projects list renders progress control for each project
- **WHEN** the user views `/areas/:areaId`
- **AND WHEN** the Projects list is rendered
- **THEN** each project row includes the project progress control next to its title
