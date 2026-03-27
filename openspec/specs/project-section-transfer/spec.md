# project-section-transfer Specification

## Purpose
TBD - created by archiving change add-sidebar-area-project-section-context-menus. Update Purpose after archive.

## Requirements
### Requirement: Project section headers expose a context menu on secondary click
When the user is viewing an active Project page, the system MUST open a section context menu when the user secondary-clicks a Project section header row.

Opening the section context menu MUST NOT enter inline title editing.

The section context menu root view MUST expose:
- `Move`
- `Delete`

#### Scenario: Secondary click opens the section context menu
- **WHEN** the user is viewing an active Project page
- **AND** the user secondary-clicks a Project section header row
- **THEN** the system opens the section context menu for that section

#### Scenario: Secondary click does not enter title editing
- **WHEN** the user secondary-clicks a Project section header row
- **THEN** the system does not enter inline title editing for that section

### Requirement: Section move transfers the section and all child tasks to another open project
Choosing `Move` from the section context menu MUST open a Project picker that lists all open Projects, including the current Project.

The current Project MUST appear as the selected option.

Choosing the current Project MUST NOT persist a move.

Choosing a different open Project MUST atomically:
- update the section's owning `project_id` to the target Project
- update every task currently in the section so its `project_id` becomes the target Project
- keep every moved task's `section_id` pointing at the moved section
- append the moved section to the end of the target Project's section list
- migrate task ordering for the moved section from the source project's section list scope to the target project's section list scope

The system MUST NOT leave the section, tasks, or list ordering in a partially moved state if persistence fails.

#### Scenario: Current project selection is a no-op
- **WHEN** the user opens a section context menu
- **AND** the user enters `Move`
- **AND** the user chooses the current Project
- **THEN** the system does not persist a section move

#### Scenario: Moving a section to another open project carries all child tasks
- **WHEN** the user opens a section context menu
- **AND** the section belongs to Project A
- **AND** the section contains tasks `T1` and `T2`
- **AND** the user chooses open Project B in `Move`
- **THEN** the section is persisted with `project_id=Project B`
- **AND THEN** tasks `T1` and `T2` are persisted with `project_id=Project B`
- **AND THEN** tasks `T1` and `T2` keep their `section_id` pointing at the moved section

#### Scenario: Moved section is appended to the target project's section list tail
- **WHEN** the target Project currently has ordered sections `[S1, S2]`
- **AND** the user moves section `S3` into that target Project
- **THEN** the target Project's ordered sections become `[S1, S2, S3]`

#### Scenario: Move failure leaves the section in the source project
- **WHEN** the user chooses another Project in `Move`
- **AND** persistence fails before the transfer completes
- **THEN** the section remains owned by its original Project
- **AND THEN** the section's child tasks remain owned by their original Project

### Requirement: Deleting a section rehomes its tasks before deleting the section
Choosing `Delete` from the section context menu MUST delete the section using these rules:

- if the deleted section has a previous section in the same Project order, tasks in the deleted section MUST be moved into that previous section
- otherwise, tasks in the deleted section MUST become ungrouped in the same Project
- the section itself MUST be soft-deleted

#### Scenario: Delete rehomes tasks to the previous section
- **WHEN** a Project has ordered sections `[A, B]`
- **AND** section `B` contains open tasks
- **AND** the user deletes section `B`
- **THEN** section `B` is deleted
- **AND THEN** tasks that were in section `B` are moved into section `A`

#### Scenario: Delete rehomes tasks to ungrouped when no previous section exists
- **WHEN** a Project's first section contains tasks
- **AND** the user deletes that first section
- **THEN** the section is deleted
- **AND THEN** tasks that were in that section are persisted with `section_id=null`
