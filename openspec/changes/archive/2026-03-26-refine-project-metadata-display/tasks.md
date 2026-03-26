## 1. Metadata Row Interaction Flow

- [x] 1.1 Refactor `src/pages/ProjectPage.tsx` to replace the boolean project-menu open state with a structured launcher state that can open `ProjectMenu` from either the `...` button or the metadata-row `+N` summary chip
- [x] 1.2 Update `ProjectMenu` so it can start in the `root` view or directly in the `tags` subview based on the launching trigger, and restore focus to the trigger that opened it
- [x] 1.3 Update `ProjectMetaRow` to derive `visibleTags` and `overflowCount` from ordered project tags, render at most 4 visible tags, and render a clickable `+N` summary chip when overflow exists
- [x] 1.4 Preserve existing clear/remove behavior for plan, due, and visible tag chips while routing hidden-tag management through the `+N` summary chip entrypoint

## 2. Metadata Row Presentation

- [x] 2.1 Add explicit primary/secondary metadata chip variants in `src/index.css` so plan/due read as primary signals and tags read as quieter secondary metadata
- [x] 2.2 Add styling for the `+N` summary chip so it reads as an action to manage overflow tags without looking like a destructive removable chip
- [x] 2.3 Add any required i18n and accessibility text in `shared/i18n/messages.ts` for the summary chip action label and aria name

## 3. Verification

- [x] 3.1 Manually verify the Project page with no metadata, with plan/due and 4 or fewer tags, and with more than 4 tags to confirm row visibility, ordering, and overflow rendering
- [x] 3.2 Manually verify that clicking `+N` opens the existing Project tags management view directly, visible tag remove buttons still work, and closing the popover returns focus to the launching trigger
- [x] 3.3 Run `npm run build` and fix any regressions introduced by the metadata row changes
