## 1. Bottom Bar Wiring

- [x] 1.1 Render a new bottom bar action group (`Schedule`/`Move`/`Search`) in `src/app/AppShell.tsx` within `.content-bottom-bar`
- [x] 1.2 Hide the action group when a task editor is open (use `openTaskId` from `TaskSelectionProvider`)
- [x] 1.3 Disable `Schedule` and `Move` when no task is selected (use `selectedTaskId`)

## 2. Search Button → Command Palette

- [x] 2.1 Add a non-keyboard open trigger for `src/app/CommandPalette.tsx` (e.g. renderer custom event `milesto:ui.openCommandPalette`)
- [x] 2.2 Wire the bottom bar `Search` button to open the Command Palette and focus the input
- [x] 2.3 Ensure the `Search` button is also hidden when the task editor is open

## 3. Schedule Popover (Bottom Bar)

- [x] 3.1 Implement a bottom-bar anchored schedule popover (portal + fixed positioning) following the existing popover conventions (`TaskEditorPaper`)
- [x] 3.2 Ensure schedule popover dismissal: click outside, `Escape`, and close-on-selection with focus restoration to trigger
- [x] 3.3 Implement schedule state edits for the selected task (`None` / `Someday` / date) via `window.api.task.update`
- [x] 3.4 After scheduling, trigger list refresh (`bumpRevision`) so list pages reflect task movement immediately

## 4. Move Popover (Bottom Bar)

- [x] 4.1 Implement a bottom-bar anchored move popover with destinations grouped into `Areas` and `Projects`
- [x] 4.2 Populate destinations from existing data sources (prefer sidebar model; otherwise `area.list` + `project.listOpen`)
- [x] 4.3 Implement move semantics via `window.api.task.update`:
        - Move to Area: set `area_id`, clear `project_id` and `section_id`, and set `is_inbox=false`
        - Move to Project: set `project_id`, clear `area_id` and `section_id`, and set `is_inbox=false`
- [x] 4.4 Ensure move popover dismissal: click outside, `Escape`, close after selection, with focus restoration
- [x] 4.5 After moving, trigger list refresh (`bumpRevision`) so list pages reflect the new location immediately

## 5. Styling and Accessibility

- [x] 5.1 Add/adjust CSS in `src/index.css` for the new bottom bar action group (layout, spacing, hover/focus) without breaking existing bottom bar affordances
- [x] 5.2 Confirm popovers/overlay follow consistent z-index layering and are not clipped on small windows
- [x] 5.3 Verify keyboard behavior: `Tab`/focus management, `Enter` activation, `Escape` close, and focus return to the triggering button

## 6. Verification

- [x] 6.1 Run `npx tsc -p tsconfig.json` and fix any new type errors
- [x] 6.2 Extend `src/app/selfTest.ts` to cover:
        - action group visible when no editor open
        - action group hidden when editor open
        - disabled state when no task selected
        - Search opens Command Palette via click
        - Schedule/Move popovers open/close and persist updates
- [ ] 6.3 Manual QA checklist:
        - On a list page, select a task: Schedule/Move enable
        - Open the inline editor: bottom bar action group disappears
        - Move to Area removes task from Inbox (via `is_inbox=false`) and clears project/section
        - Move to Project clears area/section
        - Search button opens palette and focuses input
