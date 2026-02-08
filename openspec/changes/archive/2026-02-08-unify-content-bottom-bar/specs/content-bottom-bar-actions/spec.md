## MODIFIED Requirements

### Requirement: Content bottom bar provides Schedule / Move / Search actions
When no task editor is open, the global content bottom bar SHALL provide three buttons:

- `Schedule`
- `Move`
- `Search`

#### Scenario: Actions are visible when no task editor is open
- **WHEN** no task editor is currently open
- **THEN** the content bottom bar displays the `Schedule`, `Move`, and `Search` buttons

#### Scenario: Actions are hidden when a task editor is open
- **WHEN** a task editor is currently open
- **THEN** the content bottom bar MUST NOT display the `Schedule`, `Move`, and `Search` buttons

