## ADDED Requirements

### Requirement: User can create a project section from the bottom bar and immediately edit its title inline
When the user is viewing `/projects/:projectId`, the app SHALL provide a `+ Section` action in the global content bottom bar.

Clicking `+ Section` SHALL:

- Create a new project section persisted to the database.
- Immediately enter inline title editing for the new section header.

Project section titles MAY be an empty string when persisted. When displayed in UI, empty titles SHALL be rendered using a placeholder label `(untitled)`.

#### Scenario: Creating a section enters inline edit
- **WHEN** the user is on `/projects/:projectId`
- **AND** the user clicks `+ Section` in the bottom bar
- **THEN** a new section SHALL be created and appear in the Project task grouping
- **AND** the section title editor SHALL receive focus

#### Scenario: Empty title is displayed as a placeholder
- **WHEN** a project section title is an empty string
- **THEN** the Project page SHALL display the section title as `(untitled)`
- **AND** any section dropdowns (e.g. task editor Section selector) SHALL display the section as `(untitled)`

#### Scenario: Escape cancels editing but keeps the section
- **WHEN** the user is editing a section title inline
- **AND** the user presses Escape
- **THEN** the app SHALL exit edit mode
- **AND** the section SHALL remain persisted

## MODIFIED Requirements

### Requirement: Project tasks are grouped by section and include empty sections
The Project page tasks area SHALL show tasks grouped into:

- Ungrouped tasks (tasks with no `section_id`) rendered first in the list, without an extra section header row.
- One group per project section, in section position order.

Empty section groups (sections with zero tasks) SHALL still be displayed.

#### Scenario: Ungrouped tasks render without a group header
- **WHEN** a task in the project has `section_id` set to null
- **THEN** the task SHALL be visible on the Project page
- **AND** the Project page SHALL NOT render an extra section header row for ungrouped tasks

#### Scenario: Empty section is shown
- **WHEN** a project section exists but has no tasks
- **THEN** the Project page SHALL still render that section group

### Requirement: Project actions are available via an overflow menu
Project-level actions that exist today (e.g. rename project, move to area, reopen project) SHALL remain available from the Project page.

Section creation SHALL be available from the Project page without leaving the page, but SHALL NOT be available from the Project overflow menu.

#### Scenario: Actions are accessible without leaving the Project page
- **WHEN** the user opens the overflow menu
- **THEN** the user SHALL be able to perform project-level actions without leaving the Project page

#### Scenario: Create section is not in the overflow menu
- **WHEN** the user opens the overflow menu on the Project page
- **THEN** the menu SHALL NOT include an action to create a section
