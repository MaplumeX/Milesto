## 1. CSS Tokens And Motion

- [x] 1.1 Add `--ppc-fill-partial` (harder neutral) tokens for light/dark themes in `src/index.css`
- [x] 1.2 Register CSS Houdini `@property --ppc-angle` (`<angle>`, inherits) and animate `--ppc-angle` with a 120-200ms ease-out transition; disable in `prefers-reduced-motion: reduce`

## 2. Pie Fill Rendering (conic-gradient)

- [x] 2.1 Update `.project-progress-control::before` to render `partial` as a pie wedge using `conic-gradient()` driven by `--ppc-angle` (12 o'clock start, clockwise), preserving the existing gap ring via `inset: var(--ppc-gap)`
- [x] 2.2 Render `full` as 360deg fill (CSS sets `--ppc-angle: 360deg` for `data-progress='full'`) and keep it visually distinguishable from `status='done'` (no checkmark, border remains visible)
- [x] 2.3 Ensure `none` remains empty (transparent interior) and `done` style remains unchanged (border hidden, checkmark shown, gap ring preserved)

## 3. Interaction Polish And Surface QA

- [x] 3.1 Scope hover border emphasis to interactive surfaces only (`button.project-progress-control`), keeping the Sidebar (display-only `span`) indicator visually quiet
- [x] 3.2 Visual QA the indicator across all surfaces and sizes: Sidebar list, Area projects list, Logbook projects list, Project header (list vs header sizes; 0/partial/full/done states)
- [x] 3.3 Validate motion behavior: progress changes animate smoothly by default and snap instantly under reduced-motion

## 4. Verification

- [x] 4.1 Run `npm run build` and fix any regressions introduced by the change
