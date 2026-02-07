## 1. Setup

- [x] 1.1 Add `react-day-picker` dependency (npm) and update `package-lock.json`
- [x] 1.2 Import `react-day-picker/style.css` and scope/override styles for the inline popover calendar

## 2. Local-Date Utilities

- [x] 2.1 Add helpers to convert `YYYY-MM-DD` (local-date) <-> `Date` without timezone shift
- [x] 2.2 Wire helpers into the inline pickers (Schedule/Due) conversion paths

## 3. Inline Schedule Picker (Single-Panel Calendar)

- [x] 3.1 Replace Schedule popover content with `DayPicker` + footer actions (`Someday`/`Today`/`Clear`) in one panel
- [x] 3.2 Remove/replace `showPicker()` focus effect and ensure calendar focus works (`autoFocus`/`initialFocus`)
- [x] 3.3 Ensure selecting a date updates draft, respects Someday mutual exclusion, triggers auto-save, and closes popover

## 4. Inline Due Picker (Single-Panel Calendar)

- [x] 4.1 Replace Due popover content with `DayPicker` + footer `Clear` in one panel
- [x] 4.2 Ensure selecting a date updates draft, triggers auto-save, and closes popover

## 5. Inline Tags Picker (Quick Create)

- [x] 5.1 Add a top input to the Tags popover; `Enter` creates a new tag via `window.api.tag.create`
- [x] 5.2 Implement duplicate handling (trim + case-insensitive): select existing tag instead of creating a duplicate
- [x] 5.3 After create, refresh tags list, auto-select the created tag, and clear the input
- [x] 5.4 Add inline error handling for tag.create failures (no close; preserve current selection)

## 6. Popover Positioning & Layout

- [x] 6.1 Add popover "flip" positioning for calendar pickers (open above when insufficient space below)
- [x] 6.2 Adjust calendar popover width/height constraints without impacting other `.task-inline-popover` usages (e.g. ProjectMenu)

## 7. Accessibility & Keyboard

- [x] 7.1 Ensure `Escape` closes the picker and focus returns to the trigger button/chip
- [x] 7.2 Verify keyboard navigation inside the calendar (arrows/Enter) and Monday-first week (`weekStartsOn=1`)

## 8. Verification

- [x] 8.1 Run `selfTest` schedule flow (Someday) and ensure popover open/close behavior remains compatible
- [x] 8.2 Manual QA: Schedule/Due no longer open system date picker; Tags quick-create works; popover near viewport bottom remains usable
- [x] 8.3 Run `npm run build` to confirm typecheck + bundling passes
