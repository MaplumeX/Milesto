import { z } from 'zod'

import { EntityScopeSchema, IdSchema, IsoDateTimeSchema } from './common'

export const ChecklistItemSchema = z.object({
  id: IdSchema,
  task_id: IdSchema,
  title: z.string().min(1),
  done: z.boolean(),
  position: z.number().int(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>

export const ChecklistItemCreateInputSchema = z.object({
  task_id: IdSchema,
  title: z.string().min(1),
  scope: EntityScopeSchema.optional(),
})

export type ChecklistItemCreateInput = z.infer<typeof ChecklistItemCreateInputSchema>

export const ChecklistItemUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  scope: EntityScopeSchema.optional(),
})

export type ChecklistItemUpdateInput = z.infer<typeof ChecklistItemUpdateInputSchema>

export const ChecklistItemDeleteInputSchema = z.object({
  id: IdSchema,
  scope: EntityScopeSchema.optional(),
})

export type ChecklistItemDeleteInput = z.infer<typeof ChecklistItemDeleteInputSchema>
