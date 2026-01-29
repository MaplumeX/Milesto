import { z } from 'zod'

import {
  BaseListSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  TaskStatusSchema,
} from './common'

export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  notes: z.string(),
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
})

export type Task = z.infer<typeof TaskSchema>

export const TaskCreateInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  base_list: BaseListSchema.optional(),
  project_id: IdSchema.nullable().optional(),
  section_id: IdSchema.nullable().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  due_at: LocalDateSchema.nullable().optional(),
})

export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>

export const TaskUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  base_list: BaseListSchema.optional(),
  project_id: IdSchema.nullable().optional(),
  section_id: IdSchema.nullable().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  due_at: LocalDateSchema.nullable().optional(),
})

export type TaskUpdateInput = z.infer<typeof TaskUpdateInputSchema>

export const TaskToggleDoneInputSchema = z.object({
  id: IdSchema,
  done: z.boolean(),
})

export type TaskToggleDoneInput = z.infer<typeof TaskToggleDoneInputSchema>

export const TaskRestoreInputSchema = z.object({
  id: IdSchema,
})

export type TaskRestoreInput = z.infer<typeof TaskRestoreInputSchema>
