## 1. TaskList "topContent" Slot + Virtual Scroll Alignment

- [x] 1.1 Add an optional `topContent` (or equivalent) prop to `src/features/tasks/TaskList.tsx` and render it between the header and the task listbox
- [x] 1.2 Ensure `topContent` renders inside the existing `.page` container and does not introduce a nested scroll region (keep `.content-scroll` as the single scroll host)
- [x] 1.3 Update TaskList `scrollMargin` computation to re-run when `topContent` height changes (e.g. observe a wrapper element and call the existing `compute()`)
- [ ] 1.4 Verify virtual list alignment remains correct after projects load / change height (no translateY offset, `scrollToIndex` still aligns)

## 2. Area Header Icon

- [x] 2.1 Update `src/pages/AreaPage.tsx` title ReactNode to include a left icon grouped with the title (icon is decorative with `aria-hidden`)
- [x] 2.2 Ensure the icon does not break title editing states (button/input) or the existing overflow menu placement

## 3. Area Projects List Placement (Above Tasks, No Heading)

- [x] 3.1 Move the Area Projects list into the new TaskList `topContent` slot (so it appears above the task list)
- [x] 3.2 Remove the Area Projects section heading (`sections-header/sections-title` / `t('nav.projects')`) from `src/pages/AreaPage.tsx`

## 4. Project Row Interaction Parity With Task Rows

- [x] 4.1 Add local selection state in `src/pages/AreaPage.tsx` (e.g. `selectedProjectId`) for Projects list highlighting
- [x] 4.2 Replace the project title `NavLink` with a full-row title activator `button` styled like task rows (`task-title task-title-button`), so the main hit target selects the row
- [x] 4.3 Implement single-click: selects/highlights + focuses the project row (MUST NOT navigate)
- [x] 4.4 Implement double-click: navigates to `/projects/:projectId`
- [x] 4.5 Implement `Enter` key: navigates to `/projects/:projectId` when the project row is focused
- [x] 4.6 Apply selection styling to the outer `li.task-row` via `is-selected` so the highlight spans the entire row, including the circular `ProjectProgressControl`

## 5. SelfTest Updates

- [x] 5.1 Update `src/app/selfTest.ts` Area-project locating logic to no longer depend on `.sections-title` text "Projects"
- [x] 5.2 Update `src/app/selfTest.ts` Area-project row lookup to match the new DOM (no `a.nav-item`), using a stable selector (data attribute or button text match)

## 6. Verification

- [ ] 6.1 Manually verify `/areas/:areaId` layout: header icon present, Projects list above tasks, no Projects heading
- [ ] 6.2 Verify interaction parity: click selects/highlights only; double click and Enter open project; highlight includes `ProjectProgressControl`
- [ ] 6.3 Verify virtualization remains correct after projects load / change (no scroll alignment regressions)
- [x] 6.4 Run `npm run build` (typecheck + bundle) and confirm it succeeds
