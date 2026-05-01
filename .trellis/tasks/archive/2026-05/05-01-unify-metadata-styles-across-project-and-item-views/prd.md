# PRD: Unify Metadata Styles Across Project and Item Views

## Problem

Currently there are three distinct metadata display patterns in the app:

1. **Project page (`ProjectMetaRow`)**: plain text rows with icons + tag chips
2. **Task/Project rows (`TaskRow` / `ProjectRow`)**: fully-rounded pill badges with tinted backgrounds
3. **Inline editor (`TaskEditorPaper`)**: interactive chips with chevrons

This inconsistency creates visual fragmentation. The goal is to unify the **read-only list views** (task rows and project rows) to match the cleaner, more restrained style of the project page metadata.

## Solution

Unify `TaskRow` and `ProjectRow` metadata display to adopt the visual language of `ProjectMetaRow` while keeping the compact single-line layout appropriate for list items.

## Design Decisions

| Aspect | Decision |
|--------|----------|
| **Direction** | Task rows + project rows → adopt project page `ProjectMetaRow` style |
| **Layout** | Keep single-line (compact for lists) |
| **Visual** | Icon + plain text. Tags rendered as small borderless chips without buttons |
| **Interaction** | Read-only in list view (no hover edit/clear buttons) |
| **Color** | Unified muted/subdued gray for ALL metadata (no blue for schedule, no orange/red for due) |
| **Delimiter** | None — distinguish items by their icons only |
| **Inline editor** | Excluded — keeps its interactive chip style (has dropdown pickers) |
| **Project rows** | Included — modify alongside task rows |
| **Font size** | 11px |
| **Tag format** | Small inline chips without background/border, no × button |
| **Tag overflow** | Show up to 3 tags, then `+N` |

## Target State

A task row with schedule, due date, and tags should look like:

```
📅 Today  ⏰ May 2  🏷 work  urgent  personal +2
```

All in muted gray, 11px, no pill backgrounds, no color coding.

## Files to Modify

| File | Change |
|------|--------|
| `src/features/tasks/TaskRow.tsx` | Update metadata JSX structure and CSS classes |
| `src/features/projects/ProjectRow.tsx` | Update metadata JSX structure and CSS classes |
| `src/index.css` | Replace `.task-row-metadata` / `.task-row-meta-*` rules with new unified styles |
| `src/features/tasks/task-metadata.ts` | Increase `TASK_TAG_PREVIEW_LIMIT` from 2 to 3 |

## Out of Scope

- `ProjectPage.tsx` / `ProjectMetaRow` — already the reference style
- `TaskEditorPaper.tsx` inline metadata band — keeps interactive chip style
- `TaskEditorPaper.tsx` overlay detail meta — keeps badge pill style
- Any data logic changes (scheduling, due date computation, tag fetching)

## Acceptance Criteria

1. `TaskRow` metadata displays as icon + plain text in muted gray, 11px, single line
2. `ProjectRow` metadata matches `TaskRow` style
3. No pill/badge backgrounds on metadata items
4. No color coding (blue for schedule, orange/red for due) in list views
5. Tags display as inline plain text chips (no × button, no background), up to 3 before `+N`
6. No hover edit/clear buttons in list view metadata
7. Inline editor (`TaskEditorPaper`) metadata band unchanged
8. All existing tests pass
