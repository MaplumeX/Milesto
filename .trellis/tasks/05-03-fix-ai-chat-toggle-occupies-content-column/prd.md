# Fix: AI chat toggle occupies a column in content-grid

## Goal

When the AI chat panel is closed, the 28×28 chat-toggle button still occupies a column inside `.content-grid` (a flex container), squeezing the main content area and leaving a visible white gap on the right edge. Move the toggle out of the flex flow so it overlays the content area instead of consuming horizontal space.

## What I already know

- `src/app/AppShell.tsx:1696-1775` renders `<main class="content"> > <div class="content-grid"> > .content-main + <ChatPanel/></div></main>`.
- `src/index.css:540-543` defines `.content-grid` as `display: flex; height: 100%`.
- `src/features/chat/ChatPanel.tsx:119-194` returns a Fragment of `<button class="chat-toggle">` + (when `isOpen`) `<div class="chat-panel">`. Both are direct flex children of `.content-grid`.
- `src/index.css:3418-3431` defines `.chat-toggle` as `width:28px; height:28px; flex:none`. So even when the panel is closed, the toggle button claims a 28px column in the flex row.
- `.chat-panel` is `width:360px` (mobile breakpoints at 720/900px override it).

## Requirements

- When `isOpen=false`, the chat-toggle button must NOT consume horizontal space inside `.content-grid`. The main content area should fill the full width left of the sidebar.
- When `isOpen=true`, the chat panel keeps its current 360px width (300px / fullscreen at narrow breakpoints). Toggle position must stay reachable so the user can close the panel.
- Toggle button must remain visually accessible (clickable, not hidden under bottom bar / scroll content).
- Existing keyboard, ARIA, and toggle behavior preserved.

## Acceptance Criteria

- [ ] With chat panel closed: `.content-main` takes the full available width — no white gap to the right. Verified visually in dev mode.
- [ ] With chat panel open: layout unchanged from current behavior (panel 360px, content shrinks).
- [ ] Toggle button still receives clicks and toggles the panel in both states.
- [ ] No regression on mobile breakpoints (≤720px, ≤900px).
- [ ] `npm run lint` passes.
- [ ] `npm run test` (or affected subset) passes.

## Definition of Done

- Layout fix verified in `npm run dev` with panel both open and closed.
- No new console warnings.
- Lint + typecheck + relevant tests green.

## Technical Approach (Approach A — selected by user)

Make the toggle button absolutely positioned over the content area so it does not participate in `.content-grid`'s flex flow.

Concrete plan:

1. In `src/index.css`, change `.chat-toggle` to `position: absolute` with `top` and `right` offsets that anchor it to the top-right of the `.content` (or `.content-main`) area. Add a higher `z-index` so it floats above content scroll. Keep the existing 28×28 size and visual styling.
2. Ensure the parent the toggle anchors to is `position: relative`. Candidates:
   - `.content` (`src/index.css:534-538`) — already the outer wrapper.
   - `.content-main` — currently `position: relative` already (`src/index.css:545-551`).
   - Either works; prefer anchoring to `.content-main` so the toggle stays right-edge of the content area regardless of whether `.chat-panel` is mounted.
3. When the panel is open, the panel itself (360px) sits to the right of `.content-main`. The toggle is still anchored to the top-right of `.content-main`, which means it will appear inside the content area near the panel boundary. Confirm visually and adjust offset if it overlaps panel content.
4. No JSX changes required if CSS-only solution works. Keep `ChatPanel.tsx` returning the same Fragment, since absolutely-positioned flex children don't claim line space.

Risks / open issues:

- An absolutely-positioned flex child still counts toward the flex line in some browsers? Actually, `position: absolute` removes it from normal flow including flex layout — confirmed. So `.content-grid` will only contain `.content-main` + (optionally) `.chat-panel`.
- The toggle may visually overlap the right edge of long task titles. The current button is 28×28 with some padding; place it with `top: 8px; right: 8px` or similar to feel like a floating action button.
- Mobile fullscreen panel (`@media (max-width: 720px)`) — when panel goes `position: fixed; inset: 0`, the toggle should still be reachable from outside the panel. Need to verify it still anchors to content area top-right and isn't covered.

## Decision (ADR-lite)

- **Context**: Toggle button currently sits as a flex sibling and takes 28px even when panel closed.
- **Decision**: Convert `.chat-toggle` to absolute positioning anchored to `.content-main`'s top-right corner; keep ChatPanel JSX structure unchanged.
- **Consequences**: Cleaner content layout with panel closed; minor risk of overlapping content at the right edge — mitigated by sensible offsets and a translucent hover state.

## Out of Scope

- Moving the toggle into sidebar bottom or `.content-bottom-bar` (Approach B from earlier discussion — not chosen).
- Redesigning the chat panel itself, animations, keyboard shortcuts, or panel width.
- Changing breakpoint behavior beyond what's necessary to keep the toggle reachable.

## Technical Notes

- Files touched (expected):
  - `src/index.css` — modify `.chat-toggle` rule, possibly add a small mobile breakpoint adjustment.
  - Possibly `src/features/chat/ChatPanel.tsx` — only if a wrapper element is needed (likely not).
- Verification: `npm run dev`, observe right edge of content with panel closed and open; resize to 700px width to test mobile.
