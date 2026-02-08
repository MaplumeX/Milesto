## ADDED Requirements

### Requirement: Project page bottom bar continues to offer + Section alongside global bottom bar actions
When the user is viewing `/projects/:projectId`, the content bottom bar SHALL continue to offer the `+ Section` action.

If no task editor is currently open, the bottom bar SHALL also show the global bottom bar action group (`Schedule`, `Move`, `Search`).

#### Scenario: + Section remains available on the Project page
- **WHEN** the user is viewing `/projects/:projectId`
- **THEN** the content bottom bar displays a `+ Section` action

#### Scenario: Global action group is visible on Project page when no editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays `Schedule`, `Move`, and `Search`

#### Scenario: Global action group is hidden on Project page when an editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** a task editor is currently open
- **THEN** the content bottom bar MUST NOT display `Schedule`, `Move`, and `Search`
