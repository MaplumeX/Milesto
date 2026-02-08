## ADDED Requirements

### Requirement: Moving a task via bottom bar Move is treated as processing and clears Inbox
When the user moves a task via the content bottom bar `Move` action, the system MUST treat the task as processed and MUST clear the Inbox flag.

This requirement is scoped to the bottom bar Move action and does not change the general invariants for bucket flags.

#### Scenario: Move to Area clears Inbox flag
- **WHEN** the user uses the bottom bar `Move` action to move a task to an Area
- **THEN** the task is persisted with `is_inbox=false`

#### Scenario: Move to Project clears Inbox flag
- **WHEN** the user uses the bottom bar `Move` action to move a task to a Project
- **THEN** the task is persisted with `is_inbox=false`
