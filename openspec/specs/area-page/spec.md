# area-page Specification

## Purpose
TBD - created by archiving change area-page-overflow-tags-and-bottom-add-project. Update Purpose after archive.
## Requirements
### Requirement: Area page header uses a single overflow menu for area-level actions
When the user is viewing `/areas/:areaId`, the Area page SHALL render a header that contains the Area title and a single overflow menu button for Area-level actions.

The Area page header MUST NOT render additional direct action buttons for:
- rename area
- delete area
- create project

#### Scenario: Area header shows a single overflow entrypoint
- **WHEN** the user navigates to `/areas/:areaId`
- **THEN** the Area page header renders the Area title
- **AND** the header renders an overflow menu button
- **AND** the header does not render separate buttons for rename, delete, or create project

### Requirement: Area overflow menu provides Tags and Delete actions
The Area overflow menu root view SHALL include:
- an action to manage Area tags
- an action to delete the Area

The overflow menu root view MUST NOT display the current tags values.

#### Scenario: Overflow menu root shows Tags and Delete
- **WHEN** the user opens the Area overflow menu
- **THEN** the root view includes an action to manage tags
- **AND** the root view includes an action to delete the area
- **AND** the root view does not display the current tag values

### Requirement: Area overflow menu supports managing ordered Area tags
From the Area overflow menu, the user SHALL be able to manage the Area's tags by:
- creating a new tag
- selecting and unselecting existing tags

Persisted tag order semantics:
- The UI SHALL treat the Area's current selected tags as an ordered list.
- Selecting a previously-unselected tag SHALL append it to the end of the ordered list.
- Unselecting a tag SHALL remove it from the ordered list.

#### Scenario: Selecting a tag appends it to the end of the ordered selection
- **WHEN** the Area has an ordered tag list `[A, B]`
- **AND** the user selects tag `C` from the tags view
- **THEN** the persisted ordered tag list becomes `[A, B, C]`

#### Scenario: Unselecting a tag removes it from the ordered selection
- **WHEN** the Area has an ordered tag list `[A, B, C]`
- **AND** the user unselects tag `B` from the tags view
- **THEN** the persisted ordered tag list becomes `[A, C]`

#### Scenario: Creating a new tag can immediately associate it with the Area
- **WHEN** the user is in the Area tags view
- **AND** the user enters a new tag title and confirms creation
- **THEN** a new Tag is created and becomes available in the tag list
- **AND** if the new Tag was not already associated, it becomes associated with the Area

### Requirement: Deleting an Area navigates away to Today
From the Area overflow menu, the user SHALL be able to delete the Area.

After a successful delete, the app SHALL navigate to `/today`.

#### Scenario: User deletes an Area and is taken to Today
- **WHEN** the user opens the Area overflow menu
- **AND** the user confirms deletion of the Area
- **THEN** the Area is deleted
- **AND** the app navigates to `/today`

### Requirement: Content bottom bar provides + Project on Area pages in list mode
When the user is viewing `/areas/:areaId` and no task editor is currently open, the content bottom bar SHALL provide a `+ Project` action.

Clicking `+ Project` SHALL:
- create a new Project that is assigned to the current Area
- navigate to `/projects/:projectId?editTitle=1`

The `+ Project` action MUST NOT be visible while a task editor is open.

#### Scenario: + Project is visible on Area page when no editor is open
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays a `+ Project` action

#### Scenario: + Project creates an Area-assigned project and navigates to edit title
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** no task editor is currently open
- **AND** the user clicks `+ Project`
- **THEN** a new Project is created with `area_id=<currentAreaId>`
- **AND** the app navigates to `/projects/:newProjectId?editTitle=1`

#### Scenario: + Project is hidden while a task editor is open
- **WHEN** the user is viewing `/areas/:areaId`
- **AND** a task editor is currently open
- **THEN** the content bottom bar does not display a `+ Project` action

### Requirement: Area page project list shows project progress control
When rendering the Projects list on the Area page, the UI SHALL render the project progress control next to each project title.

The progress control SHALL be interactive and SHALL follow the complete/reopen behaviors defined by `project-progress-indicator`.

The progress control SHALL NOT be nested inside the project title navigation link.

#### Scenario: Projects list renders progress control for each project
- **WHEN** the user views `/areas/:areaId`
- **AND WHEN** the Projects list is rendered
- **THEN** each project row includes the project progress control next to its title

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

