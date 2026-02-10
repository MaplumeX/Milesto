## MODIFIED Requirements

### Requirement: Project page uses a unified header/notes/tasks layout
The Project page SHALL present a single, consistent hierarchy:

- A header containing a project completion checkbox, the project title, and an overflow menu button.
- A project meta row directly below the header, containing project metadata chips (plan/due/tags) when present.
- A project notes section below the meta row.
- A project tasks section below notes.

#### Scenario: User opens a project
- **WHEN** the user navigates to `/projects/:projectId`
- **THEN** the page SHALL render the Project header, meta row (if applicable), notes section, and tasks section in that order

#### Scenario: User stays on the project page after completion
- **WHEN** the user completes the project from the Project page
- **THEN** the app SHALL remain on `/projects/:projectId` and SHALL NOT auto-navigate away

### Requirement: Project actions are available via an overflow menu
Project-level actions SHALL remain available from the Project page via an overflow menu.

The overflow menu action set for this change SHALL include:
- complete/reopen project
- edit plan (schedule)
- edit due
- move project to an area (including clearing the area)
- edit project tags
- delete project

The overflow menu root view MUST NOT display the current plan/due/tags values.

Section creation SHALL be available from the Project page without leaving the page, but SHALL NOT be available from the Project overflow menu.

#### Scenario: Actions are accessible without leaving the Project page
- **WHEN** the user opens the overflow menu
- **THEN** the user SHALL be able to perform project-level actions without leaving the Project page

#### Scenario: Create section is not in the overflow menu
- **WHEN** the user opens the overflow menu on the Project page
- **THEN** the menu SHALL NOT include an action to create a section
