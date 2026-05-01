# Redesign Task Editor Metadata Buttons

## Overview

Redesign the inline task editor's metadata action buttons (Schedule, Due Date, Tags) so that selected values are no longer displayed directly on the button surface. Instead, empty fields show compact icon+text triggers, while set values display as independent text elements using the same visual language as the task list's metadata cluster.

## Current State

The inline editor (`TaskEditorPaper.tsx`, inline variant) renders three pill-shaped chip buttons in a horizontal band:

- **Empty**: `+ 计划` / `+ 到期` / `+ 标签` (muted text, no icon)
- **Filled**: `📅 Today` / `⏰ 2026-05-01` / `🏷 work, urgent +1` (colored pill with icon + value + chevron)

Styles live in `src/index.css` under `.task-inline-metadata-band`, `.task-inline-chip`, and variants.

## Target Design

### Layout

Two-column flex layout within the metadata area:
- **Left column**: Set values stacked vertically, each on its own line, left-aligned
- **Right column**: Empty triggers stacked horizontally, right-aligned
- The right column aligns to the **bottom** (last row) of the left column

```
📅 Today
⏰ 2026-05-01    [🏷 标签]
```

### Empty State Triggers

- Display: icon + label text (`计划` / `到期` / `标签`)
- No `+` prefix
- 10px font size, `var(--muted)` color
- No background, no border, no pill shape
- Hover: text color shifts toward `var(--text)`
- Click: opens the corresponding popover (schedule picker / due picker / tag picker)

### Set Value Display

- Display: icon + value text (same format as `TaskRow` metadata)
- 10px font size, `var(--muted)` color
- No background, no border, no pill shape
- Subtle button affordance: hover darkens text / adds underline
- Click: opens the corresponding popover to edit

### Clear Interaction

- On hover over a set value, a small `×` icon appears 4px to the right of the value text
- Clicking `×` clears that field immediately (no popover)
- Tags are removed one at a time; clicking `×` on the tag cluster clears the last tag (or all — follow existing tag clear behavior)

### Visual Consistency

- Match the list-view metadata style (`TaskRow.tsx`) for set values: same icon size (11px), same muted color, same gap between icon and text (3px)
- Keep the editor's existing 10px font size (TaskRow uses 11px)

## Files to Modify

- `src/features/tasks/TaskEditorPaper.tsx` — Rebuild the metadata button band markup and logic
- `src/index.css` — Replace `.task-inline-chip-*` styles with new metadata editor styles

## Files to Reference (Read-Only)

- `src/features/tasks/TaskRow.tsx` — For list-view metadata styling reference
- `src/features/tasks/task-metadata-icons.tsx` — For available icons
- `src/features/tasks/task-metadata.ts` — For preview label helpers

## Acceptance Criteria

- [ ] Empty fields show icon + label text triggers (`计划` / `到期` / `标签`)
- [ ] Set fields show icon + value text, no button chrome
- [ ] Layout is two-column: values left/vertical, empty triggers right/horizontal, bottom-aligned
- [ ] Clicking a value or empty trigger opens the correct popover
- [ ] Hovering a set value reveals a `×` clear button
- [ ] Visual style matches list-view metadata (muted gray, small icons, no pills)
- [ ] No visual regressions in the overlay editor variant (which does not use this button band)
- [ ] Lint and type-check pass
