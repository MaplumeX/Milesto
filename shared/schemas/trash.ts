import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common'

export const TrashListInputSchema = z.object({})

export const TrashRootIdInputSchema = z.object({
  id: IdSchema,
})

export const TrashTaskEntrySchema = z.object({
  kind: z.literal('task'),
  id: IdSchema,
  title: z.string(),
  deleted_at: IsoDateTimeSchema,
})

export type TrashTaskEntry = z.infer<typeof TrashTaskEntrySchema>

export const TrashProjectEntrySchema = z.object({
  kind: z.literal('project'),
  id: IdSchema,
  title: z.string(),
  deleted_at: IsoDateTimeSchema,
  open_task_count: z.number().int().nonnegative(),
})

export type TrashProjectEntry = z.infer<typeof TrashProjectEntrySchema>

export const TrashEntrySchema = z.discriminatedUnion('kind', [
  TrashTaskEntrySchema,
  TrashProjectEntrySchema,
])

export type TrashEntry = z.infer<typeof TrashEntrySchema>

export const TrashRestoreResultSchema = z.object({
  restored: z.boolean(),
})

export type TrashRestoreResult = z.infer<typeof TrashRestoreResultSchema>

export const TrashPurgeResultSchema = z.object({
  purged: z.boolean(),
})

export type TrashPurgeResult = z.infer<typeof TrashPurgeResultSchema>

export const TrashEmptyResultSchema = z.object({
  purged_count: z.number().int().nonnegative(),
})

export type TrashEmptyResult = z.infer<typeof TrashEmptyResultSchema>
