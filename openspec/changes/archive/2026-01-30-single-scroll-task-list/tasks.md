## 1. Scroll Container Plumbing

- [x] 1.1 Identify the single content scroll element (`.content-scroll`) in `src/app/AppShell.tsx` and add a stable ref.
- [x] 1.2 Introduce a minimal renderer-level context/hook to expose the scroll element to deeply nested pages/components (e.g., `useContentScrollElement()`).
- [x] 1.3 Wire the provider at the AppShell level so task pages/components can always resolve the correct scroll container.

## 2. Virtualizer Migration (Single Scroller)

- [x] 2.1 Update `src/features/tasks/TaskList.tsx` to use `.content-scroll` as `getScrollElement` for `useVirtualizer`.
- [x] 2.2 Add `scrollMargin` computation for `TaskList` so `scrollToIndex` and range calculations remain aligned even with a page header above the list.
- [x] 2.3 Update `src/features/tasks/UpcomingGroupedList.tsx` similarly: scroll element = `.content-scroll`, compute `scrollMargin`, preserve jump buttons (Today/Next Week/Next Month).
- [x] 2.4 Ensure `.task-scroll` remains the listbox keyboard event surface (`tabIndex`, `role`, `onKeyDown`) but no longer owns scrolling.

## 3. CSS: Remove Nested Scrolling

- [x] 3.1 Remove `.task-scroll` nested scroller behavior in `src/index.css` (drop `overflow: auto` and `max-height: 60vh`).
- [x] 3.2 Decide where `overflow-anchor: none` should live after the migration (likely move to `.content-scroll`) and adjust CSS accordingly.
- [x] 3.3 Verify there is no visual regression that reintroduces a “boxed” scroll feel (e.g., unintended inner scrollbar, clipped content).

## 4. Self-Test / Regression Coverage

- [x] 4.1 Update `src/app/selfTest.ts` selectors/assumptions if needed (still find the listbox, but scroll assertions should target the main scroller).
- [x] 4.2 Add/adjust a regression that scroll caused by keyboard navigation (`ArrowUp/Down`) actually scrolls the main content container.
- [x] 4.3 Add/adjust a regression that Upcoming jump buttons align correctly with header above list (no offset drift).

## 5. Verification & Manual QA

- [x] 5.1 Run typecheck: `npx tsc -p tsconfig.json`.
- [x] 5.2 Run build: `npm run build`.
- [ ] 5.3 Manual QA checklist:
  - Trackpad/wheel scroll over the task list scrolls the page (no inner scroll trap).
  - Long list remains smooth; open inline editor and edit notes/checklist without overlap/jumps.
  - Keyboard navigation keeps selection visible; Enter opens; Space toggles done (where applicable).
  - Upcoming jump buttons still work and align correctly.
