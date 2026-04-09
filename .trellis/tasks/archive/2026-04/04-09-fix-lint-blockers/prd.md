# Fix Repository Lint Blockers

## Goal
Restore a clean repository-wide lint baseline so `$finish-work` can pass for the migration fix and future tasks.

## Requirements
- Fix current ESLint errors blocking `npm run lint`
- Keep changes scoped to lint correctness and formatting consistency
- Avoid changing runtime behavior unless required by the lint rule
- Re-run lint, typecheck, and tests after fixes

## Acceptance Criteria
- [x] `npm run lint` passes with 0 errors and 0 warnings
- [x] `npx tsc -p tsconfig.json` passes
- [x] `npm test` passes
- [x] No new type loosening or boundary violations are introduced

## Technical Notes
- Current blockers are concentrated in renderer files, test files, and a few style issues.
- The migration fix in `.trellis/scripts/common/cli_adapter.py` is already complete and should remain behaviorally unchanged.
