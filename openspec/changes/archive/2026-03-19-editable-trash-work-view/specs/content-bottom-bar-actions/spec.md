## MODIFIED Requirements

### Requirement: Schedule and Move are enabled only when a task is selected
When no task editor is currently open, the `Schedule` and `Move` buttons MUST be disabled when there is no selected task.

When no task editor is currently open and a task is selected, the `Schedule` and `Move` buttons MUST be enabled.

When a task editor is currently open in active scope, the edit-mode `Move` button MUST be enabled because it targets the open task.

When a task editor is currently open in `trash` scope, the content bottom bar MUST NOT display the `Move` button.

#### Scenario: No selected task disables Schedule and Move in list mode
- **WHEN** no task editor is currently open
- **AND** there is no selected task
- **THEN** the `Schedule` button is disabled
- **AND** the `Move` button is disabled

#### Scenario: Selected task enables Schedule and Move in list mode
- **WHEN** no task editor is currently open
- **AND** a task is selected
- **THEN** the `Schedule` button is enabled
- **AND** the `Move` button is enabled

#### Scenario: Active-scope edit-mode Move is enabled when a task editor is open
- **WHEN** a task editor is currently open in active scope
- **THEN** the `Move` button is enabled

#### Scenario: Trash-scope edit-mode does not show Move
- **WHEN** a task editor is currently open in `trash` scope
- **THEN** the content bottom bar does not display the `Move` button

### Requirement: Edit-mode content bottom bar provides Move / Delete / More actions
When a task editor is currently open in active scope, the content bottom bar SHALL display exactly three actions:

- `Move`
- `Delete`
- `More`

While an active-scope task editor is open, the content bottom bar MUST NOT display other bottom bar actions (e.g. `+ Task`, `+ Section`, `Schedule`, `Search`).

When a task editor is currently open in `trash` scope, the content bottom bar SHALL display only `More`.

While a `trash`-scope task editor is open, the content bottom bar MUST NOT display:

- `Move`
- `Delete`
- `+ Task`
- `+ Section`
- `Schedule`
- `Search`

#### Scenario: Active-scope edit-mode action set replaces the bottom bar actions
- **WHEN** a task editor is currently open in active scope
- **THEN** the content bottom bar displays `Move`, `Delete`, and `More`
- **AND** the content bottom bar MUST NOT display `+ Task`
- **AND** the content bottom bar MUST NOT display `+ Section`
- **AND** the content bottom bar MUST NOT display `Schedule`
- **AND** the content bottom bar MUST NOT display `Search`

#### Scenario: Trash-scope edit-mode only shows More
- **WHEN** a task editor is currently open in `trash` scope
- **THEN** the content bottom bar displays `More`
- **AND** the content bottom bar does not display `Move`
- **AND** the content bottom bar does not display `Delete`

