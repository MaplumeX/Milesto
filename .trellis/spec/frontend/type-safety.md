# Type Safety

> Type safety patterns in this project.

---

## Overview

The renderer relies on strict TypeScript plus Zod-validated shared contracts.
`shared/` is the source of truth for shapes that cross renderer/preload/main/worker boundaries.

---

## Type Organization

- Put cross-layer entities, inputs, outputs, and validation schemas in `shared/schemas/*.ts`.
- Put cross-layer API signatures in `shared/window-api.ts`.
- Put shared error/result wrappers in `shared/app-error.ts` and `shared/result.ts`.
- Keep renderer-only view/controller types local to the component or feature that owns them.
- Use `import type` for type-only imports.

### Naming Conventions

- `TaskSchema`, `TaskCreateInputSchema`, `TaskUpdateInputSchema`
- `Task`, `TaskCreateInput`, `TaskUpdateInput`
- `Result<T>`, `AppError`, `WindowApi`

---

## Validation

- Use Zod for runtime validation at process and storage boundaries.
- Export both the schema and the inferred TypeScript type.
- Use `superRefine` when the rule spans multiple fields.
- Use `safeParse` for untrusted input that may legitimately fail.
- Use `parse` in tests and invariant-heavy code paths when failure should throw immediately.

---

## Common Patterns

- Use discriminated `Result<T>` values instead of throwing expected app-level failures into the UI.
- Model optional backend fields explicitly with `nullable()` or `.optional()`.
- Keep `details` on `AppError` typed as `unknown` so callers cannot accidentally depend on hidden structure.
- Fail fast on invalid DB invariants instead of letting inconsistent data leak into the renderer.

---

## Forbidden Patterns

- Do not use `any` for renderer/backend boundaries.
- Do not duplicate schema-shaped types in both `shared/` and `src/`.
- Do not cast unvalidated payloads into trusted entity types.
- Do not make UI behavior depend on `AppError.details`.

---

## Examples

### Example: shared schemas carry both shape and invariants (`shared/schemas/task.ts`)

```ts
export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string(),
  status: TaskStatusSchema,
  is_inbox: DbBoolSchema,
  is_someday: DbBoolSchema,
  // ...
}).superRefine((task, ctx) => {
  if (task.is_someday && task.scheduled_at !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid task: is_someday=true requires scheduled_at=null.',
      path: ['is_someday'],
    })
  }
})
```

### Example: the renderer API is typed once in `shared/window-api.ts`

```ts
export type WindowApi = {
  task: {
    listInbox(): Promise<Result<TaskListItem[]>>
    search(query: string, options?: { includeLogbook?: boolean }): Promise<Result<TaskSearchResultItem[]>>
  }
}
```

### Example: tolerant parsing stays explicit (`shared/app-error.ts`)

```ts
export function toAppError(error: unknown, fallback: AppError): AppError {
  const parsed = AppErrorSchema.safeParse(error)
  if (parsed.success) return parsed.data
  return fallback
}
```

## Scenario: App Font Size Preference Contract

### 1. Scope / Trigger

- Trigger: font size preference crosses renderer UI, preload, main IPC, DB worker, and document root styling.
- Use this pattern for small app-wide preferences that are persisted in `app_settings` and consumed by renderer code.

### 2. Signatures

- Shared schema: `FontSizeStepSchema`, `FontSizeStateSchema`, `FontSizeStep`, `FontSizeState`.
- Renderer API: `window.api.settings.getFontSizeState(): Promise<Result<FontSizeState>>`.
- Renderer API: `window.api.settings.setFontSizeStep(step: FontSizeStep): Promise<Result<FontSizeState>>`.
- Preload IPC: `settings:getFontSizeState` with no payload.
- Preload IPC: `settings:setFontSizeStep` with `{ step }`.
- DB worker actions: `settings.getFontSizeStep` and `settings.setFontSizeStep`.
- Storage key: `app_settings.key = 'fontSize.step'`, stored as a stringified allowed slider step.

### 3. Contracts

- Allowed values are the shared slider-step union only: `-3 | -2 | -1 | 0 | 1 | 2 | 3`.
- Default is `0`, preserving the CSS `:root { font-size: 12px; }` baseline.
- Step-to-scale mapping is internal; the Settings UI must show natural labels/cues instead of raw percentages.
- The Settings UI must not show the current step in a row description under `Font size`; keep current-step text to accessibility metadata such as `aria-valuetext`.
- The Settings slider must mark the default step visibly on or near the control and use plain endpoint labels such as `Small` / `Large`, not comparative size wording.
- DB get returns `{ step: FontSizeStep | null }`; `null` means unset or invalid persisted data.
- Main IPC get returns `{ step: FontSizeStep }`, converting missing or invalid DB values to `0`.
- Renderer startup calls `getFontSizeState()` before rendering and applies the value to `document.documentElement.style.fontSize`.
- Renderer setting changes call `setFontSizeStep()` and apply the returned value immediately.

### 4. Validation & Error Matrix

- Invalid IPC payload shape -> `VALIDATION_FAILED` with message `Invalid payload.`.
- Unsupported step in main IPC -> `VALIDATION_FAILED` with message `Invalid font size step.`.
- Unsupported step in DB action -> `VALIDATION_FAILED` with message `Invalid font size step.`.
- Invalid DB return shape -> `DB_INVALID_RETURN`.
- Invalid persisted `app_settings` value -> DB get returns `{ step: null }`; main falls back to `0`.

### 5. Good/Base/Bad Cases

- Good: user moves slider to the largest step; DB stores `'3'`; main returns `{ step: 3 }`; renderer applies the mapped root font size.
- Base: no stored value; DB returns `{ step: null }`; main returns `{ step: 0 }`; renderer applies `12px`.
- Bad: DB contains `'500'`; DB returns `{ step: null }`; main returns `{ step: 0 }`.

### 6. Tests Required

- Shared/unit: slider-step-to-root-font-size mapping and DOM application.
- Renderer: Settings > General renders the slider and changing it calls `setFontSizeStep` and updates the root element.
- DB: allowed slider step persists, unsupported step is rejected, invalid persisted value reads as unset.
- Type-check: `WindowApi` mock must implement the new settings methods.

### 7. Wrong vs Correct

#### Wrong

```ts
await window.api.settings.setFontSizeStep(Number(value) as FontSizeStep)
document.documentElement.style.fontSize = `${Number(value)}%`
```

#### Correct

```ts
const parsed = FontSizeStepSchema.safeParse(Number(value))
if (!parsed.success) return

const res = await window.api.settings.setFontSizeStep(parsed.data)
if (res.ok) applyAppFontSize(res.data.step)
```
