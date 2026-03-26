# task-context-menu Specification

## Purpose
TBD - created by archiving change add-task-context-menu. Update Purpose after archive.

## Requirements
### Requirement: Task rows expose a context menu on secondary click
The system MUST open a task context menu when the user performs a secondary-click / right-click on a task row.

The task context menu MUST be available on task rows rendered in:
- active task lists
- completed task lists
- Logbook task rows

The system MUST NOT open this menu for non-task Logbook entries such as completed project rows.

#### Scenario: Secondary click opens the menu for an active task row
- **WHEN** the user secondary-clicks a task row in an active task list
- **THEN** the system opens a task context menu for that task

#### Scenario: Secondary click opens the menu for a completed task row
- **WHEN** the user secondary-clicks a completed task row
- **THEN** the system opens a task context menu for that task

#### Scenario: Secondary click does not open a task menu for a Logbook project row
- **WHEN** the user secondary-clicks a completed project row in Logbook
- **THEN** the system does not open a task context menu

### Requirement: Context menu root shows status-aware task actions
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

### Requirement: Opening the menu coordinates with the inline task editor
Before opening a task context menu, the system MUST preserve the single-editor invariant of the task UI.

If any inline task editor is currently open, the system MUST attempt to flush and close that editor before showing the task context menu.

If flushing the open editor fails, the task context menu MUST NOT open and the system MUST focus the editor's error target.

#### Scenario: Menu closes an open task editor before opening
- **WHEN** an inline task editor is currently open
- **AND WHEN** the user secondary-clicks a task row
- **THEN** the system attempts to flush and close the open editor
- **AND THEN** if flushing succeeds, the task context menu opens

#### Scenario: Flush failure prevents the menu from opening
- **WHEN** an inline task editor is currently open
- **AND** flushing that editor fails
- **AND WHEN** the user secondary-clicks a task row
- **THEN** the task context menu does not open
- **AND THEN** the system focuses the editor's error target

### Requirement: Schedule panel edits the task schedule state in-place
Choosing `Schedule` from the task context menu root MUST open a secondary panel in the same anchored menu surface.

The schedule panel MUST allow the user to set the task schedule state to one of:
- `Someday`
- `Today`
- a concrete scheduled date
- cleared schedule

Selecting a schedule action MUST persist the change immediately and MUST close the entire task context menu on success.

#### Scenario: Choosing Someday saves and closes the menu
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Schedule` panel
- **AND** the user chooses `Someday`
- **THEN** the task is persisted with `is_someday=true`
- **AND THEN** the task is persisted with `scheduled_at=null`
- **AND THEN** the task context menu closes

#### Scenario: Choosing a date saves and closes the menu
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Schedule` panel
- **AND** the user chooses a date
- **THEN** the task is persisted with `scheduled_at=<date>`
- **AND THEN** the task is persisted with `is_someday=false`
- **AND THEN** the task context menu closes

#### Scenario: Clearing schedule saves and closes the menu
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Schedule` panel
- **AND** the user chooses to clear schedule
- **THEN** the task is persisted with `scheduled_at=null`
- **AND THEN** the task is persisted with `is_someday=false`
- **AND THEN** the task context menu closes

### Requirement: Due panel edits the task due date in-place
Choosing `Due` from the task context menu root MUST open a secondary panel in the same anchored menu surface.

The due panel MUST allow the user to set a concrete due date or clear the due date.

Selecting a due-date action MUST persist the change immediately and MUST close the entire task context menu on success.

#### Scenario: Choosing a due date saves and closes the menu
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Due` panel
- **AND** the user chooses a date
- **THEN** the task is persisted with `due_at=<date>`
- **AND THEN** the task context menu closes

#### Scenario: Clearing due saves and closes the menu
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Due` panel
- **AND** the user chooses to clear due
- **THEN** the task is persisted with `due_at=null`
- **AND THEN** the task context menu closes

### Requirement: Tags panel edits existing tag membership only
Choosing `Tags` from the task context menu root MUST open a secondary panel in the same anchored menu surface.

The tags panel MUST:
- load the task's current `tag_ids` only when the panel is opened
- load the available tag list only when the panel is opened
- show existing tags only
- allow checking and unchecking tags

The tags panel MUST NOT provide controls to create, rename, recolor, or delete tags.

Checking or unchecking a tag MUST persist the new tag membership immediately and MUST keep the tags panel open after the save succeeds.

#### Scenario: Opening Tags loads existing membership and available tags
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Tags` panel
- **THEN** the system loads the task's current tag membership
- **AND THEN** the system loads the existing tag list

#### Scenario: Toggling a tag saves immediately and keeps the panel open
- **WHEN** the user opens the task context menu for a task
- **AND** the user enters the `Tags` panel
- **AND** the user checks or unchecks a tag
- **THEN** the system persists the updated tag membership immediately
- **AND THEN** the `Tags` panel remains open

#### Scenario: Tags panel does not expose tag-management controls
- **WHEN** the user enters the `Tags` panel
- **THEN** the panel does not show controls to create a new tag
- **AND THEN** the panel does not show controls to rename, recolor, or delete a tag

### Requirement: Status actions act immediately from the menu root
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

### Requirement: The context menu supports dismissal and focus recovery
The task context menu MUST be dismissible via `Escape` and outside click.

When the menu closes without moving the task to another list context, the system MUST restore focus to the task row interaction target that opened the menu.

#### Scenario: Escape dismisses the menu
- **WHEN** the task context menu is open
- **AND WHEN** the user presses `Escape`
- **THEN** the task context menu closes

#### Scenario: Outside click dismisses the menu
- **WHEN** the task context menu is open
- **AND WHEN** the user clicks outside the menu
- **THEN** the task context menu closes
