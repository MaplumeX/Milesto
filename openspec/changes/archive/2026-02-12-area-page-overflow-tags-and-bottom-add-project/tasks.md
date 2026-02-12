## 1. Area header overflow menu

- [x] 1.1 Update `src/pages/AreaPage.tsx` headerActions to replace existing buttons with a single `...` overflow menu button
- [x] 1.2 Implement Area overflow menu open/close behavior (portal popover, click-outside dismiss, Escape dismiss, restore focus to trigger)
- [x] 1.3 Add i18n keys / aria labels for Area actions menu (menu title + aria label) in `shared/i18n/messages.ts` (keep en/zh-CN parity)

## 2. Area tags management view

- [x] 2.1 Switch Area page data load to use `window.api.area.getDetail(areaId)` so the page holds `area` + ordered `tags`
- [x] 2.2 In Area tags view, load all tags via `window.api.tag.list()` on enter and render a checkbox list
- [x] 2.3 Implement “create tag on Enter” using `window.api.tag.create({ title })`, refresh tag list, and associate the new tag with the Area if not already selected
- [x] 2.4 Implement tag select/unselect persistence using `window.api.area.setTags(areaId, nextTagIds)` with append-to-end ordering semantics
- [x] 2.5 Show errors inside the menu for tag list/create/setTags failures without closing the menu

## 3. Delete area flow

- [x] 3.1 Add Delete action to the Area overflow menu root view with confirmation (`t('area.deleteConfirm')`)
- [x] 3.2 On successful delete, call `bumpRevision()` and `navigate('/today')`, then close the menu

## 4. Content bottom bar: + Project on Area pages

- [x] 4.1 In `src/app/AppShell.tsx`, detect `/areas/:areaId` route and render a `+ Project` button in list-mode bottom bar
- [x] 4.2 Implement `+ Project` click to create a project assigned to the current area (`window.api.project.create({ title: '', area_id })`) and navigate to `/projects/:id?editTitle=1`
- [x] 4.3 Ensure `+ Project` is not visible when a task editor is open (edit-mode bottom bar)

## 5. Verification

- [x] 5.1 Run `npx tsc -p tsconfig.json` and fix any type errors introduced by the change
- [ ] 5.2 Manual smoke test: open an Area, open `...` menu, create/select/unselect tags, delete the Area (verify redirect to Today), and create a Project from the bottom bar (verify it opens in title edit)
