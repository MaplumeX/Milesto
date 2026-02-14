# plan-page Specification

## Purpose
TBD - created by archiving change redesign-plan-page. Update Purpose after archive.

## Requirements

### Requirement: Plan page shows upcoming scheduled tasks
The plan page SHALL display only tasks that are:
- `status = open`
- `scheduled_at` is non-null
- `scheduled_at` is strictly after the user's local "today" date

Tasks outside this scope (including `scheduled_at = today`, `scheduled_at` null, or `status = done`) MUST NOT be shown on the plan page.

#### Scenario: Filtering to future scheduled open tasks
- **WHEN** the user opens the plan page
- **THEN** the page shows only tasks with `scheduled_at > today` and `status=open`

### Requirement: Plan page groups tasks into day and month sections
The plan page SHALL render two sections in order:
1) A "next 7 days" section comprised of 7 day group headers
2) A "next 5 months" section comprised of 5 month group headers

Tasks MUST be assigned to exactly one group based on `scheduled_at`, and groups MUST NOT overlap.

#### Scenario: Section order is stable
- **WHEN** the plan page renders
- **THEN** day groups appear before month groups

### Requirement: Next 7 days day headers are fixed and show no empty-state placeholder rows
Let `D0` be the local date for "tomorrow" (`today + 1 day`).

The plan page SHALL render day group headers for the following 7 local dates:
`D0, D0+1, D0+2, D0+3, D0+4, D0+5, D0+6`.

If a day group contains zero tasks, the UI MUST still render the header and MUST NOT render any empty-state placeholder content row (e.g. "No tasks") under that header.

The UI MAY render an inert spacer row between groups to preserve vertical rhythm, but that spacer MUST be non-interactive and MUST NOT participate in keyboard navigation.

#### Scenario: Empty day group renders header (no empty-state message row)
- **WHEN** a day in the next 7 days has zero tasks
- **THEN** the day header is visible and no empty-state message row is rendered for that day

### Requirement: Day header label format places weekday after date
Each day header SHALL render as two visually distinct elements:
1. A **day number** element displaying the numeric day of the month (e.g. `14`)
2. A **weekday** element displaying the abbreviated weekday name

For `zh-CN` locale, the weekday element MUST display `周X` (e.g. `周五`).
For `en` locale, the weekday element MUST display the abbreviated English weekday (e.g. `Fri`).

The `formatUpcomingDayHeader` function SHALL return a structured object `{ day: string; weekday: string }` instead of a single string.

The day number element MUST be rendered at a larger font size (18px) with semibold weight and primary text color. The weekday element MUST be rendered at a smaller font size (12px) with normal weight and muted color.

The day header MUST NOT have a background color or bottom border. Visual hierarchy SHALL be established through typography (font size, weight, color) and spacing only.

#### Scenario: Day header renders structured label in zh-CN
- **WHEN** locale is `zh-CN` and the date is February 14
- **THEN** the header renders a day number element showing `14` and a weekday element showing `周五`

#### Scenario: Day header renders structured label in en
- **WHEN** locale is `en` and the date is February 14 (Friday)
- **THEN** the header renders a day number element showing `14` and a weekday element showing `Fri`

#### Scenario: Day header has no decorative background
- **WHEN** a day header is rendered
- **THEN** it has a transparent background and no bottom border

### Requirement: Next 5 months month headers are fixed and start after the day section
Let `M0` be the local date `D0 + 7 days` (the "8th day" after today).

The plan page SHALL render 5 month group headers covering the natural months starting from the month containing `M0`, and then the next 4 consecutive natural months.

If a month group contains zero tasks, the UI MUST still render the header and MUST NOT render any empty-state placeholder content row (e.g. "No tasks") under that header.

The UI MAY render an inert spacer row between groups to preserve vertical rhythm, but that spacer MUST be non-interactive and MUST NOT participate in keyboard navigation.

Tasks scheduled after the end of the 5th rendered month MUST NOT be shown on the plan page.

#### Scenario: Month groups do not overlap the next 7 days section
- **WHEN** a task is scheduled within the next 7 days window
- **THEN** it is shown under its day header and is not shown under any month header

### Requirement: Month header label format supports partial first month
If `M0` is not the first day of its month, the first month header MUST include an explicit day-range within that month.

For `zh-CN` locale:
- Partial first month example: `2月（20-28）`
- Full month example: `3月`

For `en` locale:
- Partial first month example: `Feb (20-28)`
- Full month example: `Mar`

If the month displayed is not in the current year, the header MUST include the year to avoid ambiguity (e.g. `2027年1月` / `Jan 2027`).

#### Scenario: Partial first month shows range
- **WHEN** `M0` is February 20
- **THEN** the first month header displays `2月（20-28）` in `zh-CN`

### Requirement: Month section task rows display a month-day prefix
Within the month section, each task row MUST display a date prefix in `M.D` form (example: `2.21`) adjacent to the task title.

The date prefix MUST be rendered at 12px font size with muted color and tabular-nums font variant for alignment.

Within the day section, task rows MUST NOT display a redundant date prefix.

#### Scenario: Month task shows prefix
- **WHEN** a task in the month section has `scheduled_at = 2026-02-21`
- **THEN** the row displays a `2.21` prefix at 12px font size alongside the title

### Requirement: Month header visual style is distinct from day headers
Month headers SHALL be rendered at a larger font size (14px) with semibold weight and primary text color. A 1px bottom border using `var(--border)` SHALL appear below the month label text.

Month headers MUST NOT have a background color (transparent).

Month headers MUST be visually distinguishable from day headers through larger font size and the presence of a bottom border line.

#### Scenario: Month header has bottom border and no background
- **WHEN** a month header is rendered
- **THEN** it displays at 14px semibold with a bottom border line and transparent background

### Requirement: Day group spacing provides breathing room
The spacer row between day groups SHALL have a height of 24px.

#### Scenario: Day spacer height
- **WHEN** a day group spacer is rendered
- **THEN** its height is 24px

### Requirement: Month group spacing is larger than day spacing
The spacer row between month groups SHALL have a height of 36px to create a visual "chapter break" between months.

#### Scenario: Month spacer height
- **WHEN** a month group spacer is rendered
- **THEN** its height is 36px

### Requirement: Task ordering is chronological and stable
Within each group, tasks SHALL be ordered by `scheduled_at` ascending, then `created_at` ascending.

Across groups, the list SHALL be ordered by group chronology (day groups in date order, then month groups in month order).

#### Scenario: Stable ordering within a group
- **WHEN** two tasks share the same `scheduled_at`
- **THEN** the earlier `created_at` task is listed first

### Requirement: Plan page does not render quick jump buttons
The plan page MUST NOT render quick jump buttons (e.g. "tomorrow", "8th day", "next month") in the page header.

#### Scenario: Header contains only title
- **WHEN** the plan page renders
- **THEN** no quick jump buttons are visible in the header

### Requirement: Plan page supports keyboard navigation and opening a task
The plan page SHALL allow keyboard navigation across task rows and opening a task from the list.

#### Scenario: Arrow keys select tasks
- **WHEN** the list is focused and the user presses ArrowDown
- **THEN** the selection moves to the next task row

#### Scenario: Enter opens selected task
- **WHEN** a task row is selected and the user presses Enter
- **THEN** the task opens in the inline editor
