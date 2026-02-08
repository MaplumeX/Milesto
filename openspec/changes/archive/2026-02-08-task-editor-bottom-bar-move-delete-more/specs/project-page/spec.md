## MODIFIED Requirements

### Requirement: User can create a project section from the bottom bar and immediately edit its title inline
When the user is viewing `/projects/:projectId` and no task editor is currently open, the app SHALL provide a `+ Section` action in the global content bottom bar.

Clicking `+ Section` SHALL:

- Create a new project section persisted to the database.
- Immediately enter inline title editing for the new section header.

Project section titles MAY be an empty string when persisted. When displayed in UI, empty titles SHALL be rendered using a placeholder label `(untitled)`.

#### Scenario: Creating a section enters inline edit
- **WHEN** the user is on `/projects/:projectId`
- **AND** no task editor is currently open
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

### Requirement: Project page bottom bar continues to offer + Section alongside global bottom bar actions
When the user is viewing `/projects/:projectId` and no task editor is currently open, the content bottom bar SHALL offer the `+ Section` action.

If no task editor is currently open, the bottom bar SHALL also show the global bottom bar action group (`Schedule`, `Move`, `Search`).

If a task editor is currently open, the bottom bar SHALL instead show the edit-mode action set (`Move`, `Delete`, `More`) and MUST NOT show `+ Section`.

#### Scenario: + Section remains available on the Project page when no editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays a `+ Section` action

#### Scenario: Global action group is visible on Project page when no editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays `Schedule`, `Move`, and `Search`

#### Scenario: Edit-mode action group replaces bottom bar actions when an editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** a task editor is currently open
- **THEN** the content bottom bar displays `Move`, `Delete`, and `More`
- **AND** the content bottom bar MUST NOT display `+ Section`
- **AND** the content bottom bar MUST NOT display `Schedule`
- **AND** the content bottom bar MUST NOT display `Search`
