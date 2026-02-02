import { z } from 'zod'

import {
  DbBoolSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  TaskStatusSchema,
} from './common'

export const TaskSchema = z.object({
  id: IdSchema,
  title: z.string(),
  notes: z.string(),
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
})

// Cross-layer invariant validation: if DB ever returns an invalid row,
// fail fast instead of leaking inconsistent state to the UI.
.superRefine((task, ctx) => {
  if (task.is_someday && task.scheduled_at !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid task: is_someday=true requires scheduled_at=null.',
      path: ['is_someday'],
    })
  }
  if (task.is_inbox) {
    if (task.project_id !== null || task.scheduled_at !== null || task.is_someday) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid task: is_inbox=true requires project_id/scheduled_at null and is_someday=false.',
        path: ['is_inbox'],
      })
    }
  }
})

export type Task = z.infer<typeof TaskSchema>

export const TaskCreateInputSchema = z.object({
  title: z.string(),
  notes: z.string().optional(),
  is_inbox: z.boolean().optional(),
  is_someday: z.boolean().optional(),
  project_id: IdSchema.nullable().optional(),
  section_id: IdSchema.nullable().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  due_at: LocalDateSchema.nullable().optional(),
})

export type TaskCreateInput = z.infer<typeof TaskCreateInputSchema>

export const TaskUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().optional(),
  notes: z.string().optional(),
  is_inbox: z.boolean().optional(),
  is_someday: z.boolean().optional(),
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
