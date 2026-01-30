## 1. Spec And UX Alignment

- [x] 1.1 Confirm delta spec intent: expanded inline editor MUST look like a subtle focused card (border + shadow + vertical spacing) across Inbox/Today/Upcoming/Search
- [x] 1.2 Verify no other specs conflict with the new visual requirement (especially `openspec/specs/task-inline-editor/spec.md` and scroll/virtualization specs)

## 2. CSS Implementation (Focused Card + Vertical Spacing)

- [x] 2.1 Update `src/index.css` to remove or neutralize the current “open-state de-skin” rule that clears border/background/shadow/padding for `.task-row.is-open .task-inline-paper`
- [x] 2.2 Add open-state vertical spacing using layout-affecting properties (padding on `.task-row.is-open` or `.task-inline-editor`), avoiding margin to prevent react-virtual measurement issues
- [x] 2.3 Add subtle open-state emphasis (border color + ambient shadow) that is visibly stronger than collapsed rows but not modal-like
- [x] 2.4 Verify selected/open styling remains coherent (e.g., `.task-row.is-open.is-selected` background behavior) and the expanded editor still reads as “the same row, just expanded”

## 3. Virtualizer Sizing Stability

- [x] 3.1 Re-evaluate expanded-row `estimateSize` values in `src/features/tasks/TaskList.tsx` and `src/features/tasks/UpcomingGroupedList.tsx` to account for added vertical padding, minimizing open/measure jump
- [x] 3.2 Confirm `measureElement` still measures the full open row height after CSS changes (no overlap, no clipping)

## 4. Verification And Regression Guardrails

- [x] 4.1 Run the built-in UI self-test (`selfTest=1`) and confirm no regressions in overlap/scroll jump/focus restore/flush-on-close behavior (`src/app/selfTest.ts`)
- [ ] 4.2 Manual spot-check with real pointer input: open editor, then click other task rows / sidebar items to ensure the new spacing does not introduce accidental mis-clicks or visible layout jitter
- [ ] 4.3 Capture before/after screenshots or a short note describing the visual change for future reviewers (optional)
