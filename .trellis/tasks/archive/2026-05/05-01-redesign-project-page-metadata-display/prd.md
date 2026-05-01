# Redesign Project Page Metadata Display

## Problem
The current `ProjectMetaRow` on the project page uses uniform pill/capsule chips (`border-radius: 999px`) for all metadata (schedule, due date, tags). This creates visual monotony — all metadata types have the same visual weight, making it hard to distinguish time-based attributes from categorical tags.

## Scope
**Only `ProjectMetaRow` in `src/pages/ProjectPage.tsx`.** `TaskRow` metadata display is NOT changed.

## Design Decisions

### Visual Style
| Metadata | Style | Rationale |
|----------|-------|-----------|
| Schedule | Plain text + colored icon | Time info reads as "when", not a "tag" |
| Due date | Plain text + colored icon | Same semantic group as schedule |
| Tags | Small rounded-rectangle chips (~4–6px radius) | Tags are categorical markers that need a container |

### Color
- Icons retain semantic colors: schedule = `ppc-color` (blue), due = orange (`#C76A1E`), urgent due = red (`var(--danger-text)`)
- Text uses `var(--muted)` for all items to keep reading comfortable

### Layout
- Each metadata type gets its **own row** (schedule row, due row, tags row)
- This prevents horizontal crowding and gives each item breathing room

### Empty State
- Fields with no value are **completely hidden**
- No placeholders, no empty rows

### Interaction
- **Edit icon**: tiny icon to the right of each row, visible only on hover
- **Clear button (x)**: tiny `x` to the right of each row, visible only on hover
- Clicking the edit icon opens the corresponding editor (date picker for schedule/due, tag menu for tags)
- Clicking the `x` clears the value directly

## Acceptance Criteria
1. `ProjectMetaRow` renders schedule, due, and tags each on their own row when present
2. Schedule and due display as icon + plain text (no container/border/background)
3. Tags display as small rounded chips
4. Empty fields are hidden entirely
5. Edit and clear actions appear on hover
6. No changes to `TaskRow` or any other component's metadata display
7. Lint and type-check pass
