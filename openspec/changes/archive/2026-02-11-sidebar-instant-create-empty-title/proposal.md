## Why

Creating a Project or Area from the Sidebar currently requires typing a title up front, which adds friction for a common “create-then-name” workflow. We want Sidebar creation to match desktop expectations (e.g., Finder “New Folder”): create immediately, navigate into it, and focus the title field for instant naming.

## What Changes

- Sidebar “+ New” creation flow for Projects/Areas no longer requires pre-entering a title.
- When the user creates a Project or Area from the Sidebar, the system SHALL create it immediately with an empty title (`''`).
- After creation, the app SHALL navigate to the new Project/Area page and automatically enter title edit mode with focus on the title input.
- Project and Area titles SHALL be allowed to persist as an empty string across layers (schemas, IPC payloads/results, DB actions).
- UI surfaces that display Project/Area titles SHALL render a localized placeholder (e.g. `common.untitled`) when the persisted title is empty.
- Update the in-repo UI test harness flow(s) that currently depend on the Sidebar create input.

## Capabilities

### New Capabilities
- `sidebar-instant-create-project-area`: Create Project/Area from Sidebar without pre-title input; navigate to the new entity and auto-focus title editing.
- `project-area-empty-titles`: Persist Project/Area titles as `''` and render localized placeholders consistently across the UI.

### Modified Capabilities
- `project-page`: Project title behavior expands to support empty persisted titles rendered as a placeholder label, while still supporting inline title editing.
- `sidebar-project-area-dnd`: Sidebar row rendering expands to display a placeholder label when a Project/Area title is empty (avoid invisible rows).

## Impact

- Shared schemas: relax `title` constraints for Area/Project create/update/entity schemas.
- Renderer UI:
  - Sidebar creation UI and handler logic.
  - ProjectPage/AreaPage title edit flows (auto-enter edit on navigation; allow empty commit where applicable).
  - Any pages/dropdowns that directly render `project.title`/`area.title`.
- Test harness: update `src/app/selfTest.ts` Sidebar suite that currently types into `.sidebar-create input`.
