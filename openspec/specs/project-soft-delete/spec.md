# project-soft-delete Specification

## Purpose
TBD - created by archiving change project-menu-meta-actions. Update Purpose after archive.

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

#### Scenario: Deleting a project soft-deletes its tasks and sections
- **WHEN** a project is deleted
- **THEN** tasks in that project are persisted with `deleted_at` set to a non-null timestamp
- **AND** project sections in that project are persisted with `deleted_at` set to a non-null timestamp

### Requirement: Soft-deleted projects are not visible in project surfaces
After a project is soft-deleted:
- it MUST NOT appear in project list surfaces (open or done)
- fetching `project.get` and `project.getDetail` MUST fail with a not-found result

#### Scenario: Deleted project no longer appears in lists
- **WHEN** a project is soft-deleted
- **THEN** project list surfaces MUST NOT include that project

#### Scenario: Deleted project cannot be fetched by detail
- **WHEN** a project is soft-deleted
- **THEN** fetching project detail for that project fails with a not-found result

### Requirement: UI navigates away after successful deletion
After successfully deleting a project from the Project page, the UI SHALL navigate away from `/projects/:projectId` to a safe route.

#### Scenario: After deletion, user is not left on a missing project route
- **WHEN** the user confirms project deletion
- **AND** deletion succeeds
- **THEN** the UI navigates away from `/projects/:projectId`
