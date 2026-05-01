import { z } from 'zod'

import { IdSchema } from './common'
import { ViewListItemSchema, ViewListTaskItemSchema, ViewListProjectItemSchema } from './view-list'

export const TrashListInputSchema = z.object({})

export const TrashRootIdInputSchema = z.object({
  id: IdSchema,
})

// Trash entries now reuse the same ViewListItem schema as other planning views.
// Backward-compatible type aliases keep existing imports working.
export const TrashTaskEntrySchema = ViewListTaskItemSchema
export type TrashTaskEntry = z.infer<typeof TrashTaskEntrySchema>

export const TrashProjectEntrySchema = ViewListProjectItemSchema
export type TrashProjectEntry = z.infer<typeof TrashProjectEntrySchema>

export const TrashEntrySchema = ViewListItemSchema
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