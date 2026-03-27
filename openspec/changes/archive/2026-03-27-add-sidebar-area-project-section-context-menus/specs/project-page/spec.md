## ADDED Requirements

### Requirement: Project page section headers support context-menu selection and dismissal
On the Project page, secondary-clicking a section header row MUST select that section header row and open its section context menu.

Closing the section context menu with `Escape` or outside click, without moving or deleting the section, MUST keep the user on the current Project page and restore focus to the section header row that opened the menu.

#### Scenario: Secondary click selects the section and opens the menu
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** the user secondary-clicks a section header row
- **THEN** that section header row becomes the selected row
- **AND THEN** the section context menu opens for that section

#### Scenario: Dismissing the section menu restores focus to the section header
- **WHEN** the user opens a section context menu from a section header row
- **AND** the user dismisses it with `Escape` or outside click
- **THEN** the app remains on `/projects/:projectId`
- **AND THEN** focus returns to the section header row that opened the menu

### Requirement: Project page stays in place after section move or delete
When a section is moved away from the current Project or deleted from the current Project, the app MUST remain on the current Project page route and refresh the current Project view in place.

If the affected section was the selected row, the system MUST recover selection deterministically:
- first select the next visible row after refresh if one exists
- otherwise select the previous visible row if one exists
- otherwise clear selection

#### Scenario: Moving a section away keeps the current route
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** the user moves a section from the current Project to another Project
- **THEN** the app remains on `/projects/:projectId`
- **AND THEN** the moved section is no longer rendered in the current Project page

#### Scenario: Deleting a selected section falls forward to the next visible row
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** a section header row is selected
- **AND** the user deletes that section
- **AND** another visible row exists after refresh
- **THEN** the next visible row becomes selected

#### Scenario: Removing the last visible section clears selection when no rows remain
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** the selected section is removed by move or delete
- **AND** no visible row remains after refresh
- **THEN** the Project page clears the current row selection
