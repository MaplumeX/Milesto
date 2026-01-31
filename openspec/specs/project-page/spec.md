# project-page Specification

## Purpose
TBD - created by archiving change redesign-project-page. Update Purpose after archive.
## Requirements
### Requirement: Project page uses a unified header/notes/tasks layout
The Project page SHALL present a single, consistent hierarchy:

- A header containing a project completion checkbox, the project title, and an overflow menu button.
- A project notes section directly below the header.
- A project tasks section below notes.

#### Scenario: User opens a project
- **WHEN** the user navigates to `/projects/:projectId`
- **THEN** the page SHALL render the Project header, notes section, and tasks section in that order

#### Scenario: User stays on the project page after completion
- **WHEN** the user completes the project from the Project page
- **THEN** the app SHALL remain on `/projects/:projectId` and SHALL NOT auto-navigate away

### Requirement: Project header shows completion control and overflow menu
The Project header SHALL include:

- A checkbox whose checked state reflects the project completion status.
- A visible project title.
- An overflow menu button for project-level actions.

#### Scenario: Header reflects open vs done
- **WHEN** the project status is `open`
- **THEN** the header checkbox SHALL be unchecked
- **WHEN** the project status is `done`
- **THEN** the header checkbox SHALL be checked

### Requirement: Project notes are visible and editable
The Project page SHALL display the project notes and SHALL allow the user to edit them.

#### Scenario: Empty notes show an affordance
- **WHEN** the project notes are empty
- **THEN** the notes section SHALL show an affordance to add notes (e.g. a placeholder)

#### Scenario: Editing notes persists
- **WHEN** the user edits the project notes
- **THEN** the updated notes SHALL be persisted and visible after a refresh

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

### Requirement: Completed tasks are collapsible and collapsed by default
The Project page SHALL provide a single control to show/hide completed tasks.

- Completed tasks SHALL be collapsed by default when entering the Project page.
- The collapse state SHALL NOT be persisted (it resets on navigation / reload).
- The control label SHALL include the total number of completed tasks in the project.

#### Scenario: Completed tasks toggle expands and collapses
- **WHEN** the user toggles the Completed control from collapsed to expanded
- **THEN** completed tasks in the project SHALL become visible within their section groups
- **WHEN** the user toggles the Completed control from expanded to collapsed
- **THEN** completed tasks in the project SHALL become hidden

#### Scenario: Collapse state is not persisted
- **WHEN** the user expands completed tasks
- **AND** the user navigates away and returns to the Project page
- **THEN** completed tasks SHALL be collapsed again by default

### Requirement: Project actions are available via an overflow menu
Project-level actions that exist today (e.g. rename project, move to area, reopen project) SHALL remain available from the Project page.

Section creation SHALL be available from the Project page without leaving the page, but SHALL NOT be available from the Project overflow menu.

#### Scenario: Actions are accessible without leaving the Project page
- **WHEN** the user opens the overflow menu
- **THEN** the user SHALL be able to perform project-level actions without leaving the Project page

#### Scenario: Create section is not in the overflow menu
- **WHEN** the user opens the overflow menu on the Project page
- **THEN** the menu SHALL NOT include an action to create a section

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

