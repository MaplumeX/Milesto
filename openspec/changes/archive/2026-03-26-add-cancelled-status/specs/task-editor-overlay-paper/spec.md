## ADDED Requirements

### Requirement: Overlay task editor exposes explicit close-status actions
When the overlay task editor renders a task, it SHALL expose explicit status actions that reflect the current task state.

In this change:

- open tasks MUST show `Mark Done` and `Cancel`
- tasks with `status = done` or `status = cancelled` MUST show `Restore`
- activating any of these actions MUST persist the state change immediately
- after a successful state change, the overlay task editor MUST remain open and refresh to the new state

#### Scenario: Open task shows Mark Done and Cancel
- **WHEN** the user opens the overlay editor for a task with `status = open`
- **THEN** the editor shows `Mark Done`
- **AND THEN** the editor shows `Cancel`

#### Scenario: Closed task shows Restore
- **WHEN** the user opens the overlay editor for a task with `status = done` or `status = cancelled`
- **THEN** the editor shows `Restore`
- **AND THEN** the editor does not show `Cancel`

#### Scenario: Cancelling from the overlay keeps the editor open
- **WHEN** the user opens the overlay editor for a task with `status = open`
- **AND WHEN** the user activates `Cancel`
- **THEN** the task status becomes `cancelled`
- **AND THEN** the overlay editor remains open

### Requirement: Overlay task editor reflects cancelled status visually
When the overlay task editor renders a cancelled task, the editor SHALL distinguish that state from a done task.

In this change:

- the status badge label MUST display `Cancelled`
- the leading task status control MUST render the cancelled `x` affordance
- the task title field SHALL render with a line-through decoration while the task remains cancelled

#### Scenario: Cancelled task shows cancelled badge and line-through title
- **WHEN** the user opens the overlay editor for a task with `status = cancelled`
- **THEN** the status badge reads `Cancelled`
- **AND THEN** the title field is rendered with a line-through decoration
- **AND THEN** the leading status control shows an `x`
