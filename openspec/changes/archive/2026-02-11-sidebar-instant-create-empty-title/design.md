## Context

Milesto’s Sidebar creation flow for Projects and Areas is currently a small inline “create panel” (`.sidebar-create`) that requires the user to type a non-empty title before creation. The handler in `src/app/AppShell.tsx` trims the title and returns early if it is empty.

This change introduces a desktop-style “create-then-name” workflow:

- Create the Project/Area immediately (with an empty title).
- Navigate to the created entity page.
- Automatically enter title edit mode and focus the title input.

Key constraints and existing patterns:

- The renderer uses `HashRouter` and navigates via `useNavigate()`.
- Project and Area pages already have inline title editing with `useLayoutEffect + requestAnimationFrame` to focus the title input when entering edit mode.
- Several UI surfaces directly render `project.title` / `area.title` (notably the Sidebar), so allowing persisted empty titles requires consistent placeholder rendering to avoid “invisible rows”.
- The codebase already supports persisting empty titles for Project Sections and rendering placeholders for them; we will reuse the same approach for Projects/Areas.

## Goals / Non-Goals

**Goals:**

- Allow persisted Project and Area titles to be the empty string (`''`) across layers (schemas, IPC boundaries, DB actions).
- Update Sidebar create UX to create immediately without a pre-title input.
- After Sidebar creation, navigate to `/projects/:id` or `/areas/:id` and automatically enter title edit mode with focus.
- Ensure every UI surface that displays Project/Area titles renders a localized placeholder label when title is empty.
- Update the in-repo UI test harness flow(s) that depend on the existing Sidebar create panel input.

**Non-Goals:**

- Do not introduce a new “draft” entity state beyond `title === ''`.
- Do not change database schema (the DB columns already allow empty strings via `TEXT NOT NULL`).
- Do not add new external dependencies.
- Do not redesign navigation history semantics beyond what is needed to trigger a one-time “enter title edit” behavior.

## Decisions

### Decision: Persist empty titles as `''` (not localized “Untitled”)

**Choice:** Persist `title: ''` for Projects and Areas.

**Rationale:**

- Avoids storing localized strings in the database (language switching should not “freeze” titles in the creation locale).
- Matches existing precedent: Project Section titles may be persisted as `''` and are rendered with `common.untitled` in UI.
- Keeps data semantics clean: empty title means “user has not named this yet”, not a real value.

**Alternatives considered:**

- Store a default string like “Untitled” in DB: rejected due to localization lock-in and search noise.
- Store `NULL`: rejected because schemas/types and DB currently treat titles as required strings.

### Decision: Schema changes are cross-layer and symmetric (entity + create + update)

**Choice:** Update shared Zod schemas so that:

- `AreaSchema.title` and `ProjectSchema.title` allow `''`.
- `AreaCreateInputSchema.title` and `ProjectCreateInputSchema.title` allow `''`.
- `AreaUpdateInputSchema.title` and `ProjectUpdateInputSchema.title` allow `''` when provided.

**Rationale:**

- The DB worker actions validate payloads and parse returned rows using shared schemas; if the entity schema disallows `''`, the system will fail after persistence.
- Keeping create/update/entity schemas aligned prevents “can create but can’t read” or “can read but can’t update” inconsistencies.

**Alternatives considered:**

- Allow empty only in create: rejected because titles can remain empty after creation and must parse everywhere.
- Keep schemas strict and use a placeholder title: rejected (see Decision above).

### Decision: One-time “enter title edit” trigger uses URL search param and self-cleans

**Choice:** After Sidebar creation, navigate to `/projects/:id?editTitle=1` or `/areas/:id?editTitle=1`. The destination page consumes this flag once, enters title edit mode, and then clears the flag using a replace navigation.

**Rationale:**

- Works with `HashRouter` and is easy to reason about/debug.
- Avoids fragile timing / cross-component imperative calls.
- Self-clearing prevents re-trigger on refresh/back navigation.

**Alternatives considered:**

- In-memory navigation state: feasible, but easier to lose across reload and harder to inspect.
- Global custom events (like section creation): possible, but couples pages to global event names unnecessarily.

### Decision: Placeholder rendering standard is `t('common.untitled')` when `title.trim()` is empty

**Choice:** For Projects and Areas, any UI display of title uses:

- `title.trim() ? title : t('common.untitled')`

**Rationale:**

- Prevents invisible entries when title is `''` or whitespace.
- Keeps behavior consistent with Project Sections.
- Allows future tightening (e.g. disallow whitespace-only) without requiring UI churn.

## Risks / Trade-offs

- **[Risk] Invisible or confusing UI when titles are empty** → **Mitigation:** audit all render sites; apply placeholder label consistently (Sidebar, lists, menus, dropdowns).
- **[Risk] Some code paths assume non-empty titles (e.g., AreaPage commit guard)** → **Mitigation:** remove/adjust guards so empty titles are a first-class supported state.
- **[Risk] Sorting with `localeCompare` behaves oddly for empty strings** → **Mitigation:** define and implement a stable sorting rule (e.g., treat empty titles as `common.untitled` for ordering or always sort empty titles last).
- **[Risk] Focus timing races after navigation** → **Mitigation:** trigger edit mode only after entity is loaded; focus via existing `useLayoutEffect + rAF` pattern.
- **[Risk] Test harness brittleness** → **Mitigation:** update `src/app/selfTest.ts` Sidebar suite selectors away from `.sidebar-create input` and toward the new create controls.

## Migration Plan

- No DB migration is required.
- Rollout is a standard code deploy:
  1) Land schema + UI placeholder rendering first (safe even before Sidebar UX change).
  2) Land Sidebar “create immediately + navigate + focus” behavior.
  3) Update and run the in-repo UI self-test harness.
- Rollback: revert the commit(s). Existing records with `title=''` will remain valid; the pre-change UI will still need placeholder rendering to avoid invisibility, so rollback should ideally keep the placeholder changes.

## Open Questions

- Should whitespace-only titles be normalized to `''` on write, or treated as-is? (Current proposal/spec favors treating `trim()===''` as empty for display and UX.)
- What is the desired ordering behavior for empty-titled Projects in lists that currently sort by `localeCompare`? (e.g. `AreaPage` project list)
