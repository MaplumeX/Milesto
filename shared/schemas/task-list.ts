import { z } from 'zod'

import { DbBoolSchema, IdSchema, IsoDateTimeSchema, LocalDateSchema, TaskStatusSchema } from './common'

// List views must avoid loading large fields (notes, checklist, etc.).
export const TaskListItemSchema = z.object({
  id: IdSchema,
  title: z.string(),
  status: TaskStatusSchema,
  is_inbox: DbBoolSchema,
  is_someday: DbBoolSchema,
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

export const TaskListInboxInputSchema = z.object({})
export const TaskListAnytimeInputSchema = z.object({})
export const TaskListSomedayInputSchema = z.object({})

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

// Project-level completed tasks support (used for the "Completed (N)" toggle).
export const TaskCountProjectDoneInputSchema = z.object({
  project_id: IdSchema,
})

export const TaskCountResultSchema = z.object({
  count: z.number().int().nonnegative(),
})

export type TaskCountResult = z.infer<typeof TaskCountResultSchema>

export const TaskListProjectDoneInputSchema = z.object({
  project_id: IdSchema,
})
