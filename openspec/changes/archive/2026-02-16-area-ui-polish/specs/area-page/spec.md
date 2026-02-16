## ADDED Requirements

### Requirement: Area page renders the Projects list above the task list
When the user is viewing `/areas/:areaId`, the Area page SHALL render the list of open Projects for that Area above the task list content.

The Projects list and the task list MUST share the same main content scroll container (no nested scroll regions).

#### Scenario: Projects list appears above tasks
- **WHEN** the user navigates to `/areas/:areaId`
- **THEN** the Projects list is rendered above the task list
- **AND** scrolling the content area scrolls both Projects and tasks together (single main scroller)

### Requirement: Area page does not render a Projects section heading
When the user is viewing `/areas/:areaId`, the Area page MUST NOT render a section heading label for the Projects list (e.g. no "Projects" / "项目" title above the list).

#### Scenario: No Projects heading is displayed
- **WHEN** the user views `/areas/:areaId`
- **THEN** the UI does not display a Projects list heading label

### Requirement: Area Projects rows support selection on click and navigation on double-click
When rendering the Projects list on the Area page, each project row SHALL behave like a task row:

- Single click SHALL select the project row (visual highlight and focus) and MUST NOT navigate.
- Double click SHALL navigate to the project page at `/projects/:projectId`.
- Pressing `Enter` while the project row is focused SHALL navigate to `/projects/:projectId`.

#### Scenario: Single click selects a project row without navigating
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** the Projects list is visible
- **AND** the user single-clicks a project row
- **THEN** that project row becomes selected (highlighted)
- **AND** keyboard focus moves to the project row
- **AND** the current route remains `/areas/:areaId`

#### Scenario: Double click navigates to the project
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** the Projects list is visible
- **AND** the user double-clicks a project row
- **THEN** the app navigates to `/projects/:projectId` for that project

#### Scenario: Enter navigates to the focused project
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** a project row has keyboard focus
- **WHEN** the user presses `Enter`
- **THEN** the app navigates to `/projects/:projectId` for that project

### Requirement: Project row selection highlight spans the full row including the progress control
When a project row is selected on the Area page, the selection highlight MUST apply to the entire row.

The selection highlight MUST include the area occupied by the project progress control (the circular `ProjectProgressControl`).

#### Scenario: Selected project row highlights the progress control area
- **WHEN** the user selects a project row in the Projects list
- **THEN** the selection highlight spans the full width of the row
- **AND** the progress control area is included in the highlighted region
