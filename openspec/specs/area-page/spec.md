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

