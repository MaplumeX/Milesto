import { z } from 'zod'

import { BaseListSchema, IdSchema, IsoDateTimeSchema, LocalDateSchema, TaskStatusSchema } from './common'

// List views must avoid loading large fields (notes, checklist, etc.).
export const TaskListItemSchema = z.object({
  id: IdSchema,
  title: z.string(),
  status: TaskStatusSchema,
  base_list: BaseListSchema,
  project_id: IdSchema.nullable(),
  section_id: IdSchema.nullable(),
  area_id: IdSchema.nullable(),
  scheduled_at: LocalDateSchema.nullable(),
  due_at: LocalDateSchema.nullable(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  completed_at: IsoDateTimeSchema.nullable(),
  deleted_at: IsoDateTimeSchema.nullable(),
  rank: z.number().int().nullable().optional(),
})

export type TaskListItem = z.infer<typeof TaskListItemSchema>

export const TaskListBaseInputSchema = z.object({
  base_list: BaseListSchema,
})

export const TaskListTodayInputSchema = z.object({
  date: LocalDateSchema,
})

export const TaskListUpcomingInputSchema = z.object({
  from_date: LocalDateSchema,
})

export const TaskListLogbookInputSchema = z.object({})

export const TaskListProjectInputSchema = z.object({
  project_id: IdSchema,
})
