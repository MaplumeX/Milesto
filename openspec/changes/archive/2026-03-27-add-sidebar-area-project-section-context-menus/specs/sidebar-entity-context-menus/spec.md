## ADDED Requirements

### Requirement: Sidebar entity rows expose context menus on secondary click
The system MUST open an entity context menu when the user secondary-clicks:

- a Sidebar Area entry
- a Sidebar Project entry

Opening the menu from a Sidebar entity row MUST NOT trigger navigation or drag-and-drop.

The system MUST NOT open this entity context menu for non-entity Sidebar navigation items such as Inbox, Today, Logbook, Trash, or Settings.

#### Scenario: Secondary click opens the menu for a Sidebar Area entry
- **WHEN** the user secondary-clicks a Sidebar Area entry
- **THEN** the system opens the Area context menu for that Area
- **AND THEN** the current route does not change

#### Scenario: Secondary click opens the menu for a Sidebar Project entry
- **WHEN** the user secondary-clicks a Sidebar Project entry
- **THEN** the system opens the Project context menu for that Project
- **AND THEN** the current route does not change

#### Scenario: Secondary click does not open an entity context menu for non-entity navigation
- **WHEN** the user secondary-clicks a non-entity Sidebar navigation item
- **THEN** the system does not open an Area or Project entity context menu

### Requirement: Sidebar Area context menu supports rename, delete, and tags
The Sidebar Area context menu root view MUST expose these actions:

- `Rename`
- `Delete`
- `Tags`

Choosing `Rename` MUST close the menu and place the clicked Sidebar Area row into inline title editing without changing the current route.

Choosing `Delete` MUST delete the Area. If the current route is `/areas/:areaId` for the deleted Area, the app MUST navigate to `/today`.

Choosing `Tags` MUST open an in-menu tags management view that allows:
- creating a new tag
- selecting an existing tag
- unselecting an existing tag

The Area tags view MUST preserve ordered tag semantics:
- selecting a previously unselected tag appends it to the end of the persisted ordered selection
- unselecting a tag removes it from the persisted ordered selection

#### Scenario: Rename enters inline Area title editing
- **WHEN** the user opens a Sidebar Area context menu
- **AND** the user chooses `Rename`
- **THEN** the clicked Sidebar Area row enters inline title editing
- **AND THEN** the current route stays the same

#### Scenario: Delete removes the Area and escapes the deleted Area page
- **WHEN** the user opens a Sidebar Area context menu for the Area currently being viewed at `/areas/:areaId`
- **AND** the user confirms `Delete`
- **THEN** the Area is deleted
- **AND THEN** the app navigates to `/today`

#### Scenario: Tags view can append a newly selected tag
- **WHEN** the user opens a Sidebar Area context menu
- **AND** the user enters `Tags`
- **AND** the Area currently has ordered tags `[A, B]`
- **AND** the user selects tag `C`
- **THEN** the persisted ordered Area tag list becomes `[A, B, C]`

### Requirement: Sidebar Project context menu supports project actions
The Sidebar Project context menu root view for an open Project MUST expose these actions:

- `Plan`
- `Move`
- `Tags`
- `Due`
- `Mark Done`
- `Cancel Project`
- `Rename`
- `Delete`

Choosing `Plan` MUST open an in-menu plan view that allows the user to set:
- `Someday`
- `Today`
- a concrete plan date
- cleared plan

Choosing `Due` MUST open an in-menu due-date view that allows the user to set:
- `Today`
- a concrete due date
- cleared due date

Choosing `Move` MUST open an in-menu Area picker that includes:
- every active Area
- an unassigned option
- the Project's current Area assignment shown as the selected state

Choosing the currently selected Move option MUST NOT persist a change.

Choosing `Tags` MUST open an in-menu tags management view that allows creating tags and toggling Project tag membership using persisted ordered tag semantics.

Choosing `Mark Done` MUST complete the Project immediately.

Choosing `Cancel Project` MUST cancel the Project immediately.

Choosing `Rename` MUST close the menu and place the clicked Sidebar Project row into inline title editing without changing the current route.

Choosing `Delete` MUST delete the Project. If the current route is `/projects/:projectId` for the deleted Project, the app MUST navigate to `/today`.

Because the Sidebar only renders open Projects, a Project completed or cancelled from this menu MUST be removed from the Sidebar after the action succeeds.

#### Scenario: Sidebar Project menu exposes open-project actions
- **WHEN** the user opens a Sidebar Project context menu
- **THEN** the root view includes `Plan`, `Move`, `Tags`, `Due`, `Mark Done`, `Cancel Project`, `Rename`, and `Delete`

#### Scenario: Choosing the current Area in Move does nothing
- **WHEN** the user opens a Sidebar Project context menu
- **AND** the user enters `Move`
- **AND** the user chooses the Project's current Area assignment
- **THEN** the system does not persist a Project area change

#### Scenario: Mark Done removes the Project from the Sidebar
- **WHEN** the user opens a Sidebar Project context menu for an open Project
- **AND** the user chooses `Mark Done`
- **THEN** the Project is persisted as done
- **AND THEN** the Project is no longer rendered in the Sidebar

#### Scenario: Cancel Project removes the Project from the Sidebar
- **WHEN** the user opens a Sidebar Project context menu for an open Project
- **AND** the user chooses `Cancel Project`
- **THEN** the Project is persisted as cancelled
- **AND THEN** the Project is no longer rendered in the Sidebar

#### Scenario: Rename enters inline Project title editing
- **WHEN** the user opens a Sidebar Project context menu
- **AND** the user chooses `Rename`
- **THEN** the clicked Sidebar Project row enters inline title editing
- **AND THEN** the current route stays the same

### Requirement: Sidebar entity context menus support dismissal and focus recovery
Sidebar Area and Project context menus MUST be dismissible via `Escape` and outside click.

When the menu closes without navigating away or entering inline rename, focus MUST return to the Sidebar entity row that opened the menu.

#### Scenario: Escape closes a Sidebar entity context menu
- **WHEN** a Sidebar Area or Project context menu is open
- **AND** the user presses `Escape`
- **THEN** the context menu closes

#### Scenario: Outside click closes a Sidebar entity context menu and restores focus
- **WHEN** a Sidebar Area or Project context menu is open
- **AND** the user clicks outside the menu
- **THEN** the context menu closes
- **AND THEN** focus returns to the Sidebar entity row that opened the menu
