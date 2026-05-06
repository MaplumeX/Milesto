# Fix Project Page Focus Visual Conflict

## Problem

In the project page, the "Completed" toggle button and task/group rows can simultaneously display the `is-selected` visual style. This breaks the user expectation that only one element should appear focused at a time.

Two reproduction paths:
1. **Keyboard**: Arrow-down from the last task/group in the active list → both the last task/group and the Completed button show `is-selected`
2. **Mouse**: Click a task/group row while the Completed button is focused → both the clicked task and the button show `is-selected`

## Root Cause

`is-selected` is driven by two independent mechanisms that don't coordinate:
- **Task rows**: `selectedTaskId` (global `TaskSelectionContext`) + local `selectedRow` → retained when `focusRegion` changes
- **Group headers**: local `selectedRow` → retained when `focusRegion` changes
- **Toggle button**: `focusRegion === 'toggle'` → only this one is coupled to focus region

When `focusRegion` shifts (e.g., `'active'` → `'toggle'`), the old region's visual selection persists because `selectedRow` and `selectedTaskId` are never cleared.

When the user clicks a task with the mouse, `selectedTaskId` updates but `focusRegion` stays unchanged, so the toggle button keeps `is-selected`.

## Solution: Strict Visual Mutual Exclusion

### Design Decisions (from grill-me session)

| Decision | Choice | Rationale |
|---|---|---|
| Visual model | Strict mutual exclusion — one `is-selected` at a time | User expectation |
| Enforcement layer | A1: state-layer clears local `selectedRow`, `selectedTaskId` guarded at render layer | `selectedTaskId` is global; clearing it would affect sidebar and other consumers |
| Mouse click → focusRegion sync | Yes, with `source` parameter to avoid stealing focus | Without this, toggle button keeps `is-selected` after mouse click on a task |
| `selectedRow` cleanup location | Child components self-clean in `prevFocusRegionRef` effect | No new imperative handles needed; aligns with existing pattern |
| Mouse click on Completed button | Does NOT change `focusRegion` | Button is an action control (expand/collapse), not a navigation target |

### Implementation Plan

#### 1. `ProjectGroupedList.tsx`
- **Render guard on task rows**: `is-selected` only when `selectedTaskId === t.id && focusRegion === 'active'`
- **Render guard on group headers**: `is-selected` only when `selectedRowIndex === virtualRow.index && focusRegion === 'active'`
- **Clear `selectedRow` on region leave**: In the `prevFocusRegionRef` effect, when `prev === 'active' && focusRegion !== 'active'`, call `setSelectedRow(null)`
- **Mouse click callback**: When user clicks a task or group header, call `onFocusRegionChange?.('active', 'mouse')` to sync `focusRegion`

#### 2. `ProjectDoneTaskList.tsx`
- **Render guard on task rows**: `is-selected` only when `selectedTaskId === task.id && focusRegion === 'done'`
- **Render guard on section headers**: `is-selected` only when `selectedRowIndex === virtualRow.index && focusRegion === 'done'`
- **Clear `selectedRow` on region leave**: In the `prevFocusRegionRef` effect, when `prev === 'done' && focusRegion !== 'done'`, call `setSelectedRow(null)`
- **Mouse click callback**: When user clicks a task, call `onFocusRegionChange?.('done', 'mouse')` to sync `focusRegion`

#### 3. `ProjectPage.tsx`
- **Extend `focusRegion` setter to accept source**: `setFocusRegion(region, source: 'keyboard' | 'mouse')` — internally track source (e.g., via a ref or combined state)
- **Update `prevFocusRegionRef` effects**: When `source === 'mouse'`, skip the `listboxRef.current?.focus()` call (mouse already placed focus on the clicked element)
- **Wire `onFocusRegionChange` callback**: Pass to both `ProjectGroupedList` and `ProjectDoneTaskList`
- **Completed button `onClick`**: No change — does NOT set `focusRegion`

### Edge Cases
- **Task completed from active list**: Fallback selection already skips when `focusRegion !== 'active'` — no change needed
- **Done list becomes empty**: `onNavigateOut('up')` fires, returning to toggle button — `selectedRow` gets cleared by the leave effect
- **Project navigation**: `focusRegion` resets to `'active'` on `pid` change — existing behavior sufficient
