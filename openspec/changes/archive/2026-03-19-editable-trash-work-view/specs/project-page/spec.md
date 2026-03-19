## ADDED Requirements

### Requirement: Project page supports a trash scope for deleted projects
The Project page SHALL support opening a recoverable deleted project in `trash` scope via `/projects/:projectId?scope=trash`.

When opened in `trash` scope, the Project page SHALL reuse the same high-level layout as the active Project page:

- header
- meta row
- notes
- grouped task section

The rendered project, sections, and task lists SHALL come from the deleted project tree rather than active project surfaces.

#### Scenario: Deleted project opens in Project page trash scope
- **WHEN** project `P1` is soft-deleted and not purged
- **WHEN** the user navigates to `/projects/P1?scope=trash`
- **THEN** the Project page renders `P1` instead of failing with not-found
- **AND** the page uses the same header/notes/tasks layout as the active Project page

#### Scenario: Trash-scope Project page uses deleted descendants
- **WHEN** project `P1` is opened in `scope=trash`
- **AND** `P1` has recoverably deleted sections and tasks
- **THEN** the Project page renders those deleted sections and tasks

### Requirement: Editing a deleted project from the Project page keeps it deleted
When the Project page is opened in `trash` scope, editing the project or its existing descendants SHALL NOT restore them automatically.

This includes:

- project title
- notes
- plan
- due
- tags
- project open/done status
- section rename
- task content edits performed within the page

#### Scenario: Editing deleted project notes keeps the project in Trash
- **WHEN** project `P1` is opened in `scope=trash`
- **WHEN** the user edits the project notes
- **THEN** the notes change is persisted
- **AND THEN** `P1.deleted_at` remains non-null

#### Scenario: Reopening a deleted project in trash scope does not restore it
- **WHEN** project `P1` is opened in `scope=trash`
- **AND** `P1.status` is `done`
- **WHEN** the user reopens `P1` from the Project page
- **THEN** `P1.status` becomes `open`
- **AND THEN** `P1.deleted_at` remains non-null

### Requirement: Trash-scope Project page can create deleted descendants
When a deleted project is opened in `trash` scope, project-scoped creation affordances SHALL remain available for new tasks and sections.

New descendants created from these affordances SHALL remain part of the deleted project tree.

#### Scenario: Creating a section in trash scope enters inline title editing
- **WHEN** the user is viewing `/projects/P1?scope=trash`
- **AND** project `P1` is recoverably deleted
- **WHEN** the user clicks `+ Section`
- **THEN** a new deleted section is created under `P1`
- **AND** the section title enters inline edit mode

#### Scenario: Creating a task in trash scope opens a deleted task editor
- **WHEN** the user is viewing `/projects/P1?scope=trash`
- **AND** project `P1` is recoverably deleted
- **WHEN** the user clicks `+ Task`
- **THEN** a new deleted task is created under `P1`
- **AND** the task opens in the inline editor

### Requirement: Trash-scope Project page hides active-only structural actions
When the Project page is opened in `trash` scope, the page MUST NOT expose active-only structural actions that would conflict with deleted-tree semantics.

In this change, the `trash` scope MUST NOT expose:

- project move-to-area
- project delete

Other project editing actions MAY remain available if they preserve deleted state.

#### Scenario: Trash-scope project overflow menu omits move and delete
- **WHEN** the user opens the Project page overflow menu in `scope=trash`
- **THEN** the menu does not include `Move`
- **AND** the menu does not include `Delete`

