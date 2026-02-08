## Context

- The renderer uses a single global content bottom bar rendered by `AppShell`.
- Task “edit mode” is not a separate route; it is driven by `openTaskId !== null` and displayed as an inline editor.
- Today the bottom bar hides the global action group when a task editor is open, and instead shows creation actions.
- The data model already includes `deleted_at` for tasks and DB triggers handle FTS updates on soft delete.

## Goals / Non-Goals

**Goals:**
- In edit mode (`openTaskId !== null`), replace the bottom bar button set with `Move`, `Delete`, `More`.
- Implement task soft delete end-to-end as a business-level DB action (`task.delete`) exposed via `window.api.task.delete`.
- Ensure `Delete` is safe with task editor auto-save: flush pending edits before delete; if flush fails, do not delete.
- Keep focus behavior predictable for keyboard-first usage (close editor, return focus to a reasonable target).

**Non-Goals:**
- Implement the actual contents of the `More` menu.
- Add undo/trash UI or restore for soft-deleted tasks.
- Refactor task editor or bottom bar styling beyond what is required.

## Decisions

1) **Edit-mode actions are owned by `AppShell` (not TaskEditor)**

- Rationale: `AppShell` is the state owner for `openTaskId` and already branches bottom bar rendering. Keeping the mode switch at the owner avoids coupling the inline editor component to global layout.

2) **Move in edit mode targets the open task, not selection**

- Rationale: in edit mode, the “current” entity is the open task. Selection state can drift in virtualized lists, while the editor state is explicit. This keeps Move deterministic.
- Alternative considered: always rely on `selectedTaskId`. Rejected because edit mode must still work even if selection changes.

3) **Delete uses soft delete (`deleted_at`) via a dedicated DB action**

- Rationale: codebase already uses soft delete for core entities; adding `task.delete` follows the same multi-layer pattern (schema → IPC → worker action).
- Alternative considered: overload `task.update` to accept `deleted_at`. Rejected to keep update payload stable and reduce accidental exposure of deletion semantics.

4) **Delete requires confirmation and editor flush**

- Rationale: prevents accidental deletion and avoids races with the task editor debounced save worker. The delete flow is:
  - confirm → flush pending editor changes → soft delete → close editor and refresh.

5) **More is a clickable placeholder**

- Rationale: matches the product decision to reserve the affordance without committing to menu contents yet.

## Risks / Trade-offs

- **[Race with debounced saves]** → Mitigation: route all edit-mode destructive actions through the existing “flush pending changes” handle; block delete if flush fails.
- **[Spec ambiguity around “Move” visibility]** → Mitigation: update specs to distinguish list-mode action group vs edit-mode action set.
- **[No undo]** → Mitigation: require confirmation, and keep delete as soft delete to preserve future recovery paths.
