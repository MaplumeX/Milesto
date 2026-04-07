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
