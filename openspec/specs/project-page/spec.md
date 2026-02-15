# project-page Specification

## Purpose
TBD - created by archiving change redesign-project-page. Update Purpose after archive.
## Requirements
### Requirement: Project page uses a unified header/notes/tasks layout
The Project page SHALL present a single, consistent hierarchy:

- A header containing a project completion checkbox, the project title, and an overflow menu button.
- A project meta row directly below the header, containing project metadata chips (plan/due/tags) when present.
- A project notes section below the meta row.
- A project tasks section below notes.

#### Scenario: User opens a project
- **WHEN** the user navigates to `/projects/:projectId`
- **THEN** the page SHALL render the Project header, meta row (if applicable), notes section, and tasks section in that order

#### Scenario: User stays on the project page after completion
- **WHEN** the user completes the project from the Project page
- **THEN** the app SHALL remain on `/projects/:projectId` and SHALL NOT auto-navigate away

### Requirement: Project header shows completion control and overflow menu
The Project header SHALL include:

- A completion control whose visual state reflects the project completion status.
- A visible project title.
- An overflow menu button for project-level actions.

If the persisted Project title is an empty string (or whitespace-only), the displayed title label SHALL render a localized placeholder using `common.untitled`.

The completion control in the Project header SHALL be the project progress control defined by `project-progress-indicator`.

#### Scenario: Header reflects open vs done
- **WHEN** the project status is `open`
- **THEN** the header completion control SHALL render in the open style
- **WHEN** the project status is `done`
- **THEN** the header completion control SHALL render in the done style

#### Scenario: Done project can be reopened from the header control
- **WHEN** the project status is `done`
- **AND WHEN** the user activates the header completion control
- **THEN** the project status SHALL become `open`
- **AND THEN** the system SHALL remain on `/projects/:projectId`

#### Scenario: Empty persisted title is displayed as a placeholder
- **WHEN** the Project title is an empty string (or whitespace-only)
- **THEN** the Project page title label SHALL display `common.untitled`

### Requirement: Project notes are visible and editable
The Project page SHALL display the project notes and SHALL allow the user to edit them.

#### Scenario: Empty notes show an affordance
- **WHEN** the project notes are empty
- **THEN** the notes section SHALL show an affordance to add notes (e.g. a placeholder)

#### Scenario: Editing notes persists
- **WHEN** the user edits the project notes
- **THEN** the updated notes SHALL be persisted and visible after a refresh

### Requirement: Project tasks are grouped by section and include empty sections
The Project page tasks area SHALL show tasks grouped into:

- Ungrouped tasks (tasks with no `section_id`) rendered first in the list, without an extra section header row.
- One group per project section, in section position order.

Empty section groups (sections with zero tasks) SHALL still be displayed.

#### Scenario: Ungrouped tasks render without a group header
- **WHEN** a task in the project has `section_id` set to null
- **THEN** the task SHALL be visible on the Project page
- **AND** the Project page SHALL NOT render an extra section header row for ungrouped tasks

#### Scenario: Empty section is shown
- **WHEN** a project section exists but has no tasks
- **THEN** the Project page SHALL still render that section group

### Requirement: Completed tasks are collapsible and collapsed by default
The Project page SHALL provide a single control to show/hide completed tasks.

- Completed tasks SHALL be collapsed by default when entering the Project page.
- The collapse state SHALL NOT be persisted (it resets on navigation / reload).
- The control label SHALL use a stable text label (e.g. `Completed`) and SHALL NOT include numeric totals.

#### Scenario: Completed tasks toggle expands and collapses
- **WHEN** the user toggles the Completed control from collapsed to expanded
- **THEN** completed tasks in the project SHALL become visible within their section groups
- **WHEN** the user toggles the Completed control from expanded to collapsed
- **THEN** completed tasks in the project SHALL become hidden

#### Scenario: Collapse state is not persisted
- **WHEN** the user expands completed tasks
- **AND** the user navigates away and returns to the Project page
- **THEN** completed tasks SHALL be collapsed again by default

#### Scenario: Completed label does not expose numeric count
- **WHEN** the user views the Project page
- **THEN** the Completed control label SHALL NOT include a numeric count

### Requirement: Project actions are available via an overflow menu
Project-level actions SHALL remain available from the Project page via an overflow menu.

The overflow menu action set for this change SHALL include:
- complete/reopen project
- edit plan (schedule)
- edit due
- move project to an area (including clearing the area)
- edit project tags
- delete project

The overflow menu root view MUST NOT display the current plan/due/tags values.

Section creation SHALL be available from the Project page without leaving the page, but SHALL NOT be available from the Project overflow menu.

#### Scenario: Actions are accessible without leaving the Project page
- **WHEN** the user opens the overflow menu
- **THEN** the user SHALL be able to perform project-level actions without leaving the Project page

#### Scenario: Create section is not in the overflow menu
- **WHEN** the user opens the overflow menu on the Project page
- **THEN** the menu SHALL NOT include an action to create a section

### Requirement: User can create a project section from the bottom bar and immediately edit its title inline
When the user is viewing `/projects/:projectId` and no task editor is currently open, the app SHALL provide a `+ Section` action in the global content bottom bar.

Clicking `+ Section` SHALL:

- Create a new project section persisted to the database.
- Immediately enter inline title editing for the new section header.

Project section titles MAY be an empty string when persisted. When displayed in UI, empty titles SHALL be rendered using a placeholder label `(untitled)`.

#### Scenario: Creating a section enters inline edit
- **WHEN** the user is on `/projects/:projectId`
- **AND** no task editor is currently open
- **AND** the user clicks `+ Section` in the bottom bar
- **THEN** a new section SHALL be created and appear in the Project task grouping
- **AND** the section title editor SHALL receive focus

#### Scenario: Empty title is displayed as a placeholder
- **WHEN** a project section title is an empty string
- **THEN** the Project page SHALL display the section title as `(untitled)`
- **AND** any section dropdowns (e.g. task editor Section selector) SHALL display the section as `(untitled)`

#### Scenario: Escape cancels editing but keeps the section
- **WHEN** the user is editing a section title inline
- **AND** the user presses Escape
- **THEN** the app SHALL exit edit mode
- **AND** the section SHALL remain persisted

### Requirement: Project task list selection includes section headers
On the Project page, the project tasks list (grouped by section) SHALL allow selection to move across both:

- Task rows
- Project section header rows (group headers)

Selection is a highlighted "current row" used for keyboard navigation and activation.

#### Scenario: Arrow keys navigate across task and section rows
- **WHEN** the user is on `/projects/:projectId`
- **AND** the project tasks listbox has focus
- **WHEN** the user presses `ArrowDown` or `ArrowUp`
- **THEN** the selected row SHALL move to the next/previous rendered row in the list
- **AND** the selected row MAY be either a task row or a section header row
- **AND** the list SHALL scroll as needed to keep the selected row visible

#### Scenario: First ArrowDown selects the first row
- **WHEN** the user is on `/projects/:projectId`
- **AND** the project tasks listbox has focus
- **AND** there is no currently selected row
- **WHEN** the user presses `ArrowDown`
- **THEN** the first rendered row in the list SHALL become selected

### Requirement: Selecting a section clears task selection
When a project section header row becomes selected, the system SHALL clear the selected task (if any).

#### Scenario: Click section header selects section and clears task selection
- **WHEN** the user clicks a project section header row
- **THEN** that section header row SHALL become the selected row
- **AND** the selected task (if any) SHALL become null
- **AND** the system SHALL NOT automatically enter section title edit mode

#### Scenario: Arrow navigation can select an empty section
- **WHEN** an empty project section group is rendered (a section exists with zero tasks)
- **AND** the project tasks listbox has focus
- **WHEN** the user navigates with `ArrowDown`/`ArrowUp`
- **THEN** the empty section header row SHALL be reachable as the selected row

### Requirement: Return enters section inline title editing
When a project section header row is selected, pressing `Return`/`Enter` SHALL enter inline title editing for that section.

If a task inline editor is currently open, the system MUST attempt to safely close it first by flushing pending changes.

#### Scenario: Return enters inline edit for selected section
- **WHEN** a project section header row is the selected row
- **AND** no task inline editor is currently open
- **WHEN** the user presses `Return`
- **THEN** the system SHALL enter inline title editing for that section
- **AND** the section title input SHALL receive focus

#### Scenario: Return closes open task editor before entering section edit
- **WHEN** a project section header row is the selected row
- **AND** a task inline editor is currently open
- **WHEN** the user presses `Return`
- **THEN** the system SHALL attempt to flush the open task editor's pending changes
- **AND** if flushing succeeds, the task inline editor SHALL close
- **AND** the system SHALL enter inline title editing for the selected section

#### Scenario: Flush failure prevents section edit and focuses the error target
- **WHEN** a project section header row is the selected row
- **AND** a task inline editor is currently open
- **AND** flushing pending changes for the open task editor fails
- **WHEN** the user presses `Return`
- **THEN** the system SHALL NOT enter section title edit mode
- **AND** the task editor SHALL remain open
- **AND** the system SHALL move focus to the task editor's last error target

### Requirement: Double-click enters section inline title editing
Double-clicking a project section header title area SHALL enter inline title editing for that section.

If a task inline editor is currently open, the system MUST attempt to safely close it first by flushing pending changes.

#### Scenario: Double-click enters inline edit for section
- **WHEN** the user double-clicks the title area of a project section header row
- **THEN** the system SHALL enter inline title editing for that section

### Requirement: Project page supports drag-and-drop reordering within a section
On the Project page tasks list, the system SHALL allow users to reorder open tasks within the same section via drag-and-drop, with a visible drag preview.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

Task drag behavior SHALL remain available after section-header drag-and-drop is enabled.

#### Scenario: User reorders a task within its section
- **WHEN** the user drags a task within the same project section
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL update the task order within that section
- **AND** the updated order SHALL persist after refresh

### Requirement: Project page supports moving tasks across sections via drag-and-drop
On the Project page tasks list, the system SHALL allow users to drag a task from one section group to another section group.

Dropping onto an empty section group SHALL be supported.

The drag preview SHALL use the same horizontal layout as the in-list task row being dragged to avoid a visible horizontal jump at drop.

#### Scenario: User drags a task into a different section
- **WHEN** the user drags a task from one project section group to another
- **THEN** the system SHALL show a drag preview
- **AND** the drag preview SHALL match the in-list row layout (no visible horizontal jump)
- **AND** if reduced motion is not enabled, releasing the pointer SHALL animate the drag preview to its final position with a short ease-out drop animation
- **AND** releasing the pointer SHALL move the task into the destination section
- **AND** the task SHALL appear in the destination section group after refresh

### Requirement: Keyboard equivalent exists for reordering within a section
The system SHALL provide a keyboard-only interaction to reorder a selected task within its current section on the Project page.

#### Scenario: Keyboard reorder within a section
- **WHEN** the Project tasks list has focus
- **AND** a task row is selected
- **WHEN** the user invokes the reorder keyboard shortcut to move the task up or down by one position
- **THEN** the system SHALL reorder the task within its section accordingly
- **AND** the updated order SHALL persist after refresh

### Requirement: Project cross-section moves remain achievable without drag-and-drop
The system SHALL provide a non-drag interaction that allows moving a task to a different section (for keyboard-only or accessibility needs).

#### Scenario: Keyboard-only user can move a task to another section
- **WHEN** the user cannot or does not use drag-and-drop
- **THEN** the user SHALL still be able to move a task to another section using existing controls (e.g. task editor Section selector)

### Requirement: Project drag-and-drop insertion feedback is reflow-based and consistent across sections
On the Project page, drag-and-drop sorting and cross-section moves SHALL use the same insertion feedback: live list reflow that makes the insertion slot clear.

The system SHALL NOT render a separate insertion indicator line.

#### Scenario: Cross-section drag shows list reflow in destination section
- **WHEN** the user drags a task from one section towards another section
- **THEN** the destination section's task list SHALL reflow during the drag to show the intended insertion slot

#### Scenario: Within-section drag shows list reflow without an insertion line
- **WHEN** the user drags a task within a project section
- **THEN** the task list within that section SHALL reflow during the drag to show the intended insertion slot
- **AND** the UI SHALL NOT render a separate insertion indicator line

### Requirement: Project page drag-and-drop drop animation respects reduced-motion preference
When the user has enabled reduced motion, the system SHALL disable (or reduce to effectively instant) the drag preview's drop animation on the Project page.

#### Scenario: Reduced motion disables drop animation on Project page
- **WHEN** the user has enabled reduced motion
- **AND** the user drags a task on the Project page
- **AND** the user releases the pointer to drop
- **THEN** the system SHALL complete the reorder or move
- **AND** the transition at drop SHALL NOT use a visible animated drop motion

### Requirement: Project page uses task title area as the drag activator
On the Project page tasks list, the system SHALL allow users to initiate pointer-based drag-and-drop by dragging the task title area.

The system SHALL NOT require a dedicated visible drag handle control to initiate drag-and-drop.

#### Scenario: User starts Project drag from the task title
- **WHEN** the user presses on a task title area on the Project page
- **AND** the user drags beyond the activation threshold
- **THEN** the system SHALL enter drag mode
- **AND** the system SHALL show a drag preview

### Requirement: Project page supports drag-and-drop reordering of section headers
On the Project page tasks list, the system SHALL allow users to drag project section header rows to reorder section groups.

The ungrouped tasks area (`section_id = null`) SHALL NOT be treated as a draggable section header.

#### Scenario: User drags a section header to a new position
- **WHEN** the user drags a project section header row and drops it between other section headers
- **THEN** the section group order SHALL update to the dropped position
- **AND** all tasks that belong to the moved section SHALL remain in that section
- **AND** refreshing the Project page SHALL preserve the new section order

#### Scenario: Ungrouped area is not draggable as a section
- **WHEN** the user attempts to drag the ungrouped tasks area
- **THEN** the system SHALL NOT enter section-header drag mode

### Requirement: Section drag preview uses shadow-stacked edges without task thumbnails
When dragging a project section header row, the drag preview SHALL use a section-level overlay with shadow-stacked edges.

The preview SHALL NOT render real task-row thumbnails behind the section.

#### Scenario: Dragging a section with tasks shows stacked-shadow preview
- **WHEN** the dragged section contains one or more tasks
- **THEN** the drag preview SHALL display stacked shadow/edge depth behind the section header card
- **AND** the preview SHALL NOT render individual task-row content

#### Scenario: Reduced motion disables visible section drop animation
- **WHEN** the user has enabled reduced motion
- **AND** the user drops a dragged section header
- **THEN** the reorder SHALL complete correctly
- **AND** the drop transition SHALL be instant or effectively non-animated

### Requirement: Keyboard equivalent exists for section reordering on Project page
The system SHALL provide a keyboard-only interaction to reorder a selected section header row on the Project page.

#### Scenario: Keyboard move up/down reorders selected section
- **WHEN** the Project tasks list has focus
- **AND** a section header row is selected
- **WHEN** the user invokes the section reorder keyboard shortcut to move the section up or down by one position
- **THEN** the system SHALL reorder the section accordingly
- **AND** refreshing the Project page SHALL preserve the updated section order

### Requirement: Project task surfaces do not display numeric counters
On the Project page, task-related UI surfaces SHALL NOT display numeric counters for `open`, `done`, or `total` values.

This rule applies to:
- project header meta summary
- section header meta summary
- section drag overlay meta summary
- project action labels (including completion action labels)

#### Scenario: Header and section surfaces are counter-free
- **WHEN** the user is on `/projects/:projectId`
- **THEN** the project header SHALL NOT show `open/done/total` numeric summaries
- **THEN** section headers and section drag overlays SHALL NOT show `open/done` numeric summaries

#### Scenario: Project completion action label is counter-free
- **WHEN** the user opens the Project actions menu
- **THEN** the completion action label SHALL NOT include a numeric count suffix (e.g. `(N)`)

### Requirement: Project page bottom bar continues to offer + Section alongside global bottom bar actions
When the user is viewing `/projects/:projectId` and no task editor is currently open, the content bottom bar SHALL offer the `+ Section` action.

If no task editor is currently open, the bottom bar SHALL also show the global bottom bar action group (`Schedule`, `Move`, `Search`).

If a task editor is currently open, the bottom bar SHALL instead show the edit-mode action set (`Move`, `Delete`, `More`) and MUST NOT show `+ Section`.

#### Scenario: + Section remains available on the Project page when no editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays a `+ Section` action

#### Scenario: Global action group is visible on Project page when no editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** no task editor is currently open
- **THEN** the content bottom bar displays `Schedule`, `Move`, and `Search`

#### Scenario: Edit-mode action group replaces bottom bar actions when an editor is open
- **WHEN** the user is viewing `/projects/:projectId`
- **AND** a task editor is currently open
- **THEN** the content bottom bar displays `Move`, `Delete`, and `More`
- **AND** the content bottom bar MUST NOT display `+ Section`
- **AND** the content bottom bar MUST NOT display `Schedule`
- **AND** the content bottom bar MUST NOT display `Search`

