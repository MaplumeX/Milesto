# trash-page Specification

## Purpose
Define the top-level Trash surface for deleted task roots and project roots, including restore and permanent removal behavior.

## Requirements

### Requirement: Trash is a top-level navigation surface for soft-deleted task and project roots
The system SHALL provide a top-level Trash page at `/trash`.

The Sidebar SHALL render a `Trash` navigation entry immediately after `Logbook`.

The Trash page SHALL list only soft-deleted task roots and project roots.

- Area entries MUST NOT appear in Trash.
- Project Section entries MUST NOT appear in Trash as standalone rows.

#### Scenario: User opens Trash from the Sidebar
- **WHEN** the user views the main Sidebar navigation
- **THEN** the Sidebar shows a `Trash` entry immediately after `Logbook`
- **AND** activating that entry navigates to `/trash`

#### Scenario: Trash excludes area entries
- **WHEN** an Area has been soft-deleted
- **THEN** the Trash page does not show a standalone Area row for that deletion

### Requirement: Trash renders a mixed root list ordered by deletion recency without search or filters
The Trash page SHALL render a single mixed list of task roots and project roots.

The list SHALL be ordered by root `deleted_at` descending.

The Trash page MUST NOT provide search, type filters, or grouping in this change.

#### Scenario: More recently deleted roots appear first
- **WHEN** Trash contains a deleted task root with deletion time `T1`
- **AND** Trash contains a deleted project root with deletion time `T2`
- **AND** `T2` is more recent than `T1`
- **THEN** the deleted project root appears before the deleted task root in the Trash list

#### Scenario: Trash provides no search or filter controls
- **WHEN** the user views `/trash`
- **THEN** the page shows the mixed root list
- **AND** the page does not show search input, type filters, or grouping controls

### Requirement: Deleted projects absorb their descendant tasks and sections into a single project root
When a project is soft-deleted, the Trash page SHALL render that project as the only visible root entry for the deleted project tree.

Tasks and sections belonging to that deleted project MUST NOT render as standalone Trash rows while the project root remains restorable.

Project Trash rows SHALL display:

- the project title
- a compact count indicator for the number of descendant tasks with `status = open` that would be restored with the project

Project Trash rows MUST NOT display the deletion timestamp in-row in this change.

#### Scenario: Earlier deleted task is absorbed after project deletion
- **WHEN** task `T1` inside project `P1` was soft-deleted earlier
- **AND** project `P1` is later soft-deleted
- **THEN** the Trash page shows `P1` as a project root row
- **AND** the Trash page does not show `T1` as a separate task row

#### Scenario: Project row shows open descendant count only
- **WHEN** a deleted project has 2 deleted open tasks and 1 deleted done task under it
- **THEN** the project Trash row shows a compact count indicator with value `2`
- **AND** the done task is not included in that indicator

### Requirement: Area deletion surfaces descendant projects and direct tasks as Trash roots
When an Area is soft-deleted, the Area itself SHALL NOT become a Trash row.

Instead:

- each deleted project under that Area SHALL appear as a project Trash root
- each deleted task directly assigned to that Area and not belonging to a deleted project SHALL appear as a task Trash root

#### Scenario: Deleted area surfaces project roots but not the area
- **WHEN** Area `A1` with projects `P1` and `P2` is soft-deleted
- **THEN** the Trash page does not show an `A1` row
- **AND** the Trash page shows `P1` and `P2` as project Trash roots

#### Scenario: Deleted direct area task appears as a task root
- **WHEN** Area `A1` has direct task `T1` with no project
- **AND** `A1` is soft-deleted
- **THEN** the Trash page shows `T1` as a task Trash root

### Requirement: Trash supports deterministic restore semantics for tasks and projects
The Trash page SHALL allow the user to restore a task root or a project root.

Restoring a task root:

- SHALL remove the task from Trash
- SHALL return the task to its original active parent when that parent still exists
- SHALL return the task to Inbox when its original parent project or direct parent Area no longer exists

Restoring a project root:

- SHALL restore the project
- SHALL restore that project's deleted descendant tasks and sections together
- SHALL restore the project into the ungrouped project list when its original Area no longer exists

#### Scenario: Restoring a task with missing parent falls back to Inbox
- **WHEN** task `T1` is a Trash task root
- **AND** `T1`'s original parent project or direct parent Area no longer exists
- **WHEN** the user restores `T1`
- **THEN** `T1` is removed from Trash
- **AND** `T1` appears in Inbox

#### Scenario: Restoring a project restores its sections and tasks
- **WHEN** project `P1` is a Trash project root
- **AND** `P1` has deleted sections and deleted descendant tasks
- **WHEN** the user restores `P1`
- **THEN** `P1` is removed from Trash
- **AND** `P1` returns to active project surfaces
- **AND** its deleted sections and descendant tasks are restored with it

#### Scenario: Restoring a project from a deleted area falls back to ungrouped projects
- **WHEN** project `P1` is a Trash project root
- **AND** `P1`'s original Area no longer exists
- **WHEN** the user restores `P1`
- **THEN** `P1` is removed from Trash
- **AND** `P1` appears in the ungrouped project list instead of under an Area

### Requirement: Trash supports permanent removal for single roots and the full Trash contents
The Trash page SHALL allow the user to permanently remove a single task root, permanently remove a single project root, and empty the entire Trash.

After a root is permanently removed:

- it MUST NOT appear in Trash
- it MUST NOT be restorable from Trash

Emptying Trash SHALL permanently remove every currently visible Trash root.

#### Scenario: Permanently removing a task root removes it from Trash
- **WHEN** task `T1` appears as a Trash task root
- **WHEN** the user permanently removes `T1`
- **THEN** `T1` no longer appears in Trash
- **AND** `T1` cannot be restored from Trash afterward

#### Scenario: Empty Trash removes all current roots
- **WHEN** Trash contains multiple task and project roots
- **WHEN** the user empties Trash
- **THEN** the Trash page shows no remaining root rows from that pre-existing set

### Requirement: Trash page uses an open-first work-list presentation
The Trash page SHALL present its mixed task/project root list as a normal work list rather than a row-action management table.

The page header SHALL show:

- the `Trash` title
- a single `Empty Trash` action

The Trash list MUST NOT render per-row restore or permanent-delete buttons in this change.

The Trash page MUST NOT expose a primary create affordance from the page chrome.

#### Scenario: Trash header only shows title and Empty Trash
- **WHEN** the user views `/trash`
- **THEN** the page header shows the `Trash` title
- **AND** the page header shows an `Empty Trash` action
- **AND** the page header does not show row-level restore or purge controls

#### Scenario: Trash rows do not show inline restore or purge buttons
- **WHEN** the user views Trash rows
- **THEN** task rows do not render inline `Restore` buttons
- **AND** task rows do not render inline permanent-delete buttons
- **AND** project rows do not render inline `Restore` buttons
- **AND** project rows do not render inline permanent-delete buttons

### Requirement: Trash rows open deleted entities in their native work surfaces
Trash rows SHALL support open-first interaction.

For task roots:

- single click SHALL only select the row
- `Enter` or double-click SHALL open the task's inline editor in place

For project roots:

- single click SHALL only select the row
- `Enter` or double-click SHALL navigate to the project page in `trash` scope

#### Scenario: Clicking a Trash task row only selects it
- **WHEN** the user single-clicks a Trash task row
- **THEN** that row becomes selected
- **AND** the task editor remains closed

#### Scenario: Enter opens a Trash task inline editor
- **WHEN** a Trash task row is selected
- **WHEN** the user presses `Enter`
- **THEN** the task opens in the inline editor within `/trash`

#### Scenario: Double-click opens a Trash project in trash scope
- **WHEN** the user double-clicks a Trash project row
- **THEN** the app navigates to `/projects/:projectId?scope=trash`
