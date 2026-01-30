## 1. Prep & Baseline

- [x] 1.1 Read current inline editor implementation (`src/features/tasks/TaskEditorPaper.tsx`) and identify: header/title layout, `inlinePanel` sections, action bar markup, and tag update flows.
- [x] 1.2 Verify current close/switch integration points (`src/features/tasks/TaskInlineEditorRow.tsx`, `src/app/AppShell.tsx`) and document existing keyboard behaviors (Enter opens from list, Esc/Cmd+Enter closes).

## 2. Row-like Header & Close Gesture Changes

- [x] 2.1 Remove inline `Collapse` button from `TaskEditorPaper` inline header and update any related CSS.
- [x] 2.2 Move the title input into the inline header (row-like layout) so it aligns with the task row title position; keep done toggle in the same header row.
- [x] 2.3 Implement `Enter/Return` close gesture only when title input is focused (prevent propagation so list-level Enter-to-open doesn’t interfere).
- [x] 2.4 Add click-away close for the inline editor using `pointerdown` capture:
  - detect outside clicks relative to the editor root
  - consume the click to avoid selection changing while flush fails
  - restore focus per existing AppShell behavior on successful close

## 3. Footer Layout: Left Summary Chips + Right Action Buttons

- [x] 3.1 Split `.task-inline-action-bar` into left and right regions; add styles for a compact left chips row and keep existing right button group.
- [x] 3.2 Implement summary chips for `Scheduled`, `Due`, and `Tags`:
  - chips render only when values exist
  - clicking chip body opens the corresponding picker
  - chip `×` clears the value without opening the picker (stopPropagation)
- [x] 3.3 Update action buttons visibility rules:
  - hide `Schedule` when scheduled_at exists
  - hide `Due` when due_at exists
  - keep `Tags` always visible
  - preserve existing conditional `Checklist` behavior

## 4. Replace Inline Panels with Pickers (No Layout Expansion)

- [x] 4.1 Remove `inlinePanel` state and all `inlinePanel === 'schedule'|'due'|'tags'` inline sections from the inline editor.
- [x] 4.2 Implement Schedule picker:
  - prefer hidden `input[type=date]` + `showPicker()` when available
  - provide fallback popover with `input[type=date]`
  - support clear action (and optional Today shortcut if retained)
- [x] 4.3 Implement Due picker:
  - same pattern as Schedule (showPicker + fallback)
  - support clear action
- [x] 4.4 Implement Tags picker (selection-only):
  - popover list of available tags with checkboxes
  - remove tag management controls from inline editor (rename/delete/recolor/new tag)
  - clicking checkboxes updates selection and persists via `window.api.task.setTags`

## 5. Flush Semantics Include Tags Persistence

- [x] 5.1 Track in-flight tags persistence as a ref (promise + sequence id) to avoid stale response races.
- [x] 5.2 Extend `TaskEditorPaperHandle.flushPendingChanges()` to await both:
  - draft auto-save worker completion
  - latest tags persistence completion
- [x] 5.3 On flush failure, block close/switch and focus the most relevant entry point:
  - draft save error → focus title
  - tags error → focus Tags button (or Tags chip if visible)

## 6. Picker Dismissal Priority & Keyboard Handling

- [x] 6.1 Ensure `Escape` closes an open picker first; a second `Escape` closes the editor (or closes the editor when no picker is open).
- [x] 6.2 Ensure click-away closes an open picker first; only if no picker is open should it attempt to close the editor.
- [x] 6.3 Close popovers on scroll/resize/task switch to prevent mispositioned UI in the virtualized list.

## 7. Verification

- [ ] 7.1 Manual flow checks:
  - open editor via Enter/double-click
  - title Enter closes (notes Enter does not)
  - click-away closes (picker open → closes picker only)
  - schedule/due chips appear/hide and clear with `×`
  - schedule/due buttons appear only when empty; tags button always visible
  - tags change persists and switching tasks waits for persistence
- [x] 7.2 Run typecheck/build (`npx tsc -p tsconfig.json` and/or `npm run build`) and ensure no new TypeScript errors.
