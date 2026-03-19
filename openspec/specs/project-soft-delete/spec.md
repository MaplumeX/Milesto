# project-soft-delete Specification

## Purpose
Define how projects are soft-deleted, surfaced through Trash, restored, and permanently removed.

## Requirements

### Requirement: User can soft-delete a project from the Project page overflow menu
The system SHALL allow the user to delete a project via the Project page overflow menu.

Deletion MUST be implemented as a soft delete by setting `deleted_at` to a non-null timestamp.

The system MUST ask for confirmation before deleting.

#### Scenario: Confirming Delete soft-deletes the project
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** the user opens the project overflow menu
- **AND** the user chooses `Delete`
- **AND** the user confirms the deletion
- **THEN** the project is persisted with `deleted_at` set to a non-null timestamp

#### Scenario: Canceling Delete does nothing
- **WHEN** the user initiates project deletion
- **AND** the user cancels the confirmation
- **THEN** the project is not deleted
- **AND** the user remains on the Project page

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
- fetching `project.get` and `project.getDetail` in `active` scope MUST fail with a not-found result

Until the project is permanently removed:

- fetching project detail in `trash` scope MUST succeed
- the project SHALL remain recoverable through Trash semantics

#### Scenario: Deleted project no longer appears in active project lists
- **WHEN** a project is soft-deleted
- **THEN** active project list surfaces MUST NOT include that project

#### Scenario: Deleted project cannot be fetched by active detail
- **WHEN** a project is soft-deleted
- **THEN** fetching project detail for that project in `active` scope fails with a not-found result

#### Scenario: Deleted project can be fetched by trash detail
- **WHEN** a project is soft-deleted
- **WHEN** the client fetches project detail for that project in `trash` scope
- **THEN** the request succeeds

#### Scenario: Deleted project remains recoverable until permanently removed
- **WHEN** a project is soft-deleted
- **THEN** that project remains recoverable through Trash until it is permanently removed

### Requirement: Deleted project trees accept new deleted descendants while remaining deleted
While a project remains recoverably deleted, the system SHALL allow new sections and tasks to be created inside that deleted project tree through `trash` scope.

New descendants created in this state:

- MUST start with non-null `deleted_at`
- MUST remain part of the deleted project tree
- MUST NOT appear as active descendants

#### Scenario: New task in deleted project starts as a deleted descendant
- **WHEN** project `P1` is soft-deleted and recoverable
- **WHEN** the user creates task `T2` inside `P1` in `trash` scope
- **THEN** `T2` is persisted as a deleted descendant of `P1`
- **AND THEN** `T2` does not appear in active task surfaces

#### Scenario: New section in deleted project starts as a deleted descendant
- **WHEN** project `P1` is soft-deleted and recoverable
- **WHEN** the user creates section `S2` inside `P1` in `trash` scope
- **THEN** `S2` is persisted as a deleted descendant of `P1`

### Requirement: Project-tree restore and purge include descendants created after deletion
When a recoverably deleted project is restored or permanently removed, the operation SHALL apply to all current recoverable deleted descendants in that project tree, including descendants created while the project remained deleted.

#### Scenario: Restoring a project restores a section created after deletion
- **WHEN** project `P1` is soft-deleted
- **AND** section `S2` is created under `P1` afterward in `trash` scope
- **WHEN** the user restores `P1`
- **THEN** `S2` is restored with `P1`

#### Scenario: Empty Trash purges a task created after project deletion
- **WHEN** project `P1` is soft-deleted
- **AND** task `T2` is created under `P1` afterward in `trash` scope
- **WHEN** the user empties Trash
- **THEN** `T2` is permanently removed with `P1`'s deleted tree

### Requirement: UI navigates away after successful deletion
After successfully deleting a project from the Project page, the UI SHALL navigate away from `/projects/:projectId` to a safe route.

#### Scenario: After deletion, user is not left on a missing project route
- **WHEN** the user confirms project deletion
- **AND** deletion succeeds
- **THEN** the UI navigates away from `/projects/:projectId`

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
