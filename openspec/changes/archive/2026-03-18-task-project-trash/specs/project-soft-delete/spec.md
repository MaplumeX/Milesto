## MODIFIED Requirements

### Requirement: Project deletion cascades to project tasks and sections
When a project is soft-deleted, the system MUST also soft-delete:
- all tasks with `project_id=<deleted project>`
- all project sections under that project

While that project remains recoverable, the deleted project SHALL be represented as a single project Trash root for the full deleted project tree.

Tasks and sections within that project MUST NOT appear as separate Trash roots while the deleted project root is present.

#### Scenario: Deleting a project soft-deletes its tasks and sections
- **WHEN** a project is deleted
- **THEN** tasks in that project are persisted with `deleted_at` set to a non-null timestamp
- **AND** project sections in that project are persisted with `deleted_at` set to a non-null timestamp

#### Scenario: Deleted project is the only Trash root for its tree
- **WHEN** project `P1` is soft-deleted
- **THEN** the system exposes `P1` as the recoverable Trash root for that project tree
- **AND** the system does not expose `P1`'s deleted tasks or sections as separate Trash roots

### Requirement: Soft-deleted projects are not visible in project surfaces
The system SHALL hide soft-deleted projects from active project surfaces while keeping them recoverable through Trash until they are permanently removed.

After a project is soft-deleted:
- it MUST NOT appear in active project list surfaces
- fetching `project.get` and `project.getDetail` MUST fail with a not-found result

Until the project is permanently removed, it SHALL remain recoverable through Trash semantics.

#### Scenario: Deleted project no longer appears in active project lists
- **WHEN** a project is soft-deleted
- **THEN** active project list surfaces MUST NOT include that project

#### Scenario: Deleted project cannot be fetched by detail
- **WHEN** a project is soft-deleted
- **THEN** fetching project detail for that project fails with a not-found result

#### Scenario: Deleted project remains recoverable until permanently removed
- **WHEN** a project is soft-deleted
- **THEN** that project remains recoverable through Trash until it is permanently removed

## ADDED Requirements

### Requirement: Soft-deleted projects can be restored as complete project trees
The system SHALL allow a soft-deleted project to be restored as a complete project tree.

Restoring a project SHALL restore:

- the project itself
- deleted sections belonging to that project
- deleted descendant tasks belonging to that project

If the project's original Area no longer exists, the restored project SHALL be returned to the ungrouped project list instead of recreating the missing Area.

#### Scenario: Restoring a project restores sections and descendant tasks
- **WHEN** project `P1` is soft-deleted
- **AND** `P1` has deleted sections and deleted descendant tasks
- **WHEN** the user restores `P1`
- **THEN** `P1` is restored
- **AND** `P1`'s deleted sections are restored
- **AND** `P1`'s deleted descendant tasks are restored

#### Scenario: Restoring a project from a deleted area falls back to ungrouped projects
- **WHEN** project `P1` is soft-deleted
- **AND** `P1`'s original Area no longer exists
- **WHEN** the user restores `P1`
- **THEN** `P1` is restored without recreating the missing Area
- **AND** `P1` appears in the ungrouped project list

### Requirement: Permanently removed projects are no longer recoverable
The system SHALL support permanently removing a previously soft-deleted project root.

After a project root has been permanently removed, that project tree MUST NOT appear as a recoverable Trash root.

#### Scenario: Permanently removed project root is not recoverable
- **WHEN** project `P1` has already been soft-deleted
- **AND** the user permanently removes `P1`
- **THEN** `P1` no longer appears as a recoverable Trash project root
