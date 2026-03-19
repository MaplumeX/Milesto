# trash-editing-mode Specification

## Purpose
Define how deleted task and project work surfaces behave in explicit `trash` scope without restoring the underlying entities.

## Requirements

### Requirement: Trash scope can read recoverable deleted entities without restoring them
The system SHALL support an explicit `trash` scope for task and project detail surfaces.

When a task or project is soft-deleted and not permanently removed:

- fetching detail in `active` scope MUST continue to fail
- fetching detail in `trash` scope MUST succeed
- fetching detail in `trash` scope MUST NOT clear `deleted_at`

Purged entities MUST remain unreadable in both scopes.

#### Scenario: Trash scope can fetch a deleted task
- **WHEN** task `T1` is soft-deleted and not purged
- **AND WHEN** the client requests task detail with `scope=trash`
- **THEN** the system returns detail for `T1`
- **AND THEN** `T1` remains soft-deleted

#### Scenario: Active scope still rejects a deleted project
- **WHEN** project `P1` is soft-deleted and not purged
- **WHEN** the client requests project detail with `scope=active`
- **THEN** the request fails with a not-found result

#### Scenario: Purged entity is unreadable in trash scope
- **WHEN** task `T1` has been permanently removed
- **WHEN** the client requests task detail with `scope=trash`
- **THEN** the request fails with a not-found result

### Requirement: Saving in trash scope preserves deleted state
When a recoverable deleted task or project is edited in `trash` scope, the system SHALL persist the edited fields without restoring the entity.

Saving in `trash` scope:

- MUST update only the requested business fields plus `updated_at`
- MUST keep `deleted_at` non-null
- MUST keep the entity recoverable through Trash until restored or purged

#### Scenario: Editing a deleted task title keeps the task in Trash
- **WHEN** task `T1` is soft-deleted and not purged
- **AND WHEN** the user updates `T1`'s title in `scope=trash`
- **THEN** the new title is persisted
- **AND THEN** `T1.deleted_at` remains non-null
- **AND THEN** `T1` remains visible through Trash semantics

#### Scenario: Editing deleted project metadata does not restore the project
- **WHEN** project `P1` is soft-deleted and not purged
- **AND WHEN** the user updates `P1`'s notes, plan, due date, tags, or status in `scope=trash`
- **THEN** the edited fields are persisted
- **AND THEN** `P1.deleted_at` remains non-null

### Requirement: Trash scope project work surfaces operate on deleted descendants
When a deleted project is opened in `trash` scope, project sub-surfaces SHALL operate on that deleted project's recoverable deleted descendants.

This includes:

- section listing
- open task listing
- done task listing
- done count calculation

These sub-surfaces MUST NOT mix in active descendants from outside the deleted project tree.

#### Scenario: Trash-scope project lists deleted open tasks
- **WHEN** project `P1` is soft-deleted
- **AND** task `T1` belongs to `P1` and is a recoverable deleted open task
- **WHEN** the client requests `P1`'s open task list in `scope=trash`
- **THEN** the result includes `T1`

#### Scenario: Trash-scope project sections include deleted sections
- **WHEN** project `P1` is soft-deleted
- **AND** section `S1` belongs to `P1` and is recoverably deleted
- **WHEN** the client requests `P1`'s sections in `scope=trash`
- **THEN** the result includes `S1`

### Requirement: Creating descendants inside a deleted project keeps them in the deleted tree
When the user creates a task or project section inside a deleted project in `trash` scope, the new descendant SHALL be created as part of the deleted project tree rather than restoring the project.

New descendants created in this way:

- MUST be persisted with a non-null `deleted_at`
- MUST remain visible only through the deleted project's `trash` scope surfaces
- MUST participate in later project restore and purge operations

#### Scenario: New task inside deleted project starts deleted
- **WHEN** project `P1` is soft-deleted and opened in `scope=trash`
- **WHEN** the user creates task `T2` inside `P1`
- **THEN** `T2` is persisted with `project_id=P1`
- **AND THEN** `T2.deleted_at` is non-null
- **AND THEN** `T2` does not appear in active task surfaces

#### Scenario: New section inside deleted project starts deleted
- **WHEN** project `P1` is soft-deleted and opened in `scope=trash`
- **WHEN** the user creates section `S2` inside `P1`
- **THEN** `S2` is persisted with `project_id=P1`
- **AND THEN** `S2.deleted_at` is non-null
