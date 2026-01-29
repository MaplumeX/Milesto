import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common'

export const ListPositionSchema = z.object({
  list_id: z.string().min(1),
  task_id: IdSchema,
  rank: z.number().int(),
  updated_at: IsoDateTimeSchema,
})

export const TaskReorderInputSchema = z.object({
  list_id: z.string().min(1),
  task_id: IdSchema,
  before_task_id: IdSchema.nullable().optional(),
  after_task_id: IdSchema.nullable().optional(),
})

export const TaskReorderBatchInputSchema = z.object({
  list_id: z.string().min(1),
  ordered_task_ids: z.array(IdSchema),
})
