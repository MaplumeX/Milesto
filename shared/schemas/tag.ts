import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common'

export const TagSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  color: z.string().nullable(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type Tag = z.infer<typeof TagSchema>

export const TagCreateInputSchema = z.object({
  title: z.string().min(1),
  color: z.string().nullable().optional(),
})

export type TagCreateInput = z.infer<typeof TagCreateInputSchema>

export const TagUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).optional(),
  color: z.string().nullable().optional(),
})

export type TagUpdateInput = z.infer<typeof TagUpdateInputSchema>

export const TagDeleteInputSchema = z.object({
  id: IdSchema,
})

export type TagDeleteInput = z.infer<typeof TagDeleteInputSchema>

export const TaskSetTagsInputSchema = z.object({
  task_id: IdSchema,
  tag_ids: z.array(IdSchema),
})

export type TaskSetTagsInput = z.infer<typeof TaskSetTagsInputSchema>
