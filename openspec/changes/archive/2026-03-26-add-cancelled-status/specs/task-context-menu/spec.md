## MODIFIED Requirements

### Requirement: Context menu root shows exactly four task actions
When the task context menu root is open, it MUST always show these base actions:
- `Plan` / `Schedule`
- `Tags`
- `Due`

The task status actions shown in the root menu MUST depend on the current task status:

- open tasks show `Complete` and `Cancel`
- done tasks show `Restore`
- cancelled tasks show `Restore`

#### Scenario: Open task shows Complete and Cancel in the root menu
- **WHEN** the task context menu root is open for an open task
- **THEN** the root menu shows `Schedule`, `Tags`, `Due`, `Complete`, and `Cancel`

#### Scenario: Done task shows Restore in the root menu
- **WHEN** the task context menu root is open for a done task
- **THEN** the root menu shows `Schedule`, `Tags`, `Due`, and `Restore`

#### Scenario: Cancelled task shows Restore in the root menu
- **WHEN** the task context menu root is open for a cancelled task
- **THEN** the root menu shows `Schedule`, `Tags`, `Due`, and `Restore`

### Requirement: Complete and Restore act immediately from the menu root
Choosing `Complete`, `Cancel`, or `Restore` from the task context menu root MUST persist the task status change immediately.

After a successful status change, the system MUST close the entire task context menu.

#### Scenario: Complete saves immediately and closes the menu
- **WHEN** the user opens the task context menu root for an open task
- **AND** the user chooses `Complete`
- **THEN** the task is persisted with `status=open -> done`
- **AND THEN** the task context menu closes

#### Scenario: Cancel saves immediately and closes the menu
- **WHEN** the user opens the task context menu root for an open task
- **AND** the user chooses `Cancel`
- **THEN** the task is persisted with `status=open -> cancelled`
- **AND THEN** the task context menu closes

#### Scenario: Restore saves immediately and closes the menu
- **WHEN** the user opens the task context menu root for a task with `status = done` or `status = cancelled`
- **AND** the user chooses `Restore`
- **THEN** the task is persisted with `status -> open`
- **AND THEN** the task context menu closes
