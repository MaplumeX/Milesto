## MODIFIED Requirements

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

### Requirement: Month section task rows display a month-day prefix
Within the month section, each task row MUST display a date prefix in `M.D` form (example: `2.21`) adjacent to the task title.

The date prefix MUST be rendered at 12px font size with muted color and tabular-nums font variant for alignment.

Within the day section, task rows MUST NOT display a redundant date prefix.

#### Scenario: Month task prefix is rendered at 12px
- **WHEN** a task in the month section has `scheduled_at = 2026-02-21`
- **THEN** the row displays a `2.21` prefix at 12px font size alongside the title
