import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema, LocalDateSchema, ProjectStatusSchema } from './common'

export const ProjectSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  notes: z.string(),
  area_id: IdSchema.nullable(),
  status: ProjectStatusSchema,
  scheduled_at: LocalDateSchema.nullable(),
  due_at: LocalDateSchema.nullable(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  completed_at: IsoDateTimeSchema.nullable(),
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type Project = z.infer<typeof ProjectSchema>

export const ProjectIdInputSchema = z.object({
  id: IdSchema,
})

export type ProjectIdInput = z.infer<typeof ProjectIdInputSchema>

// Atomic completion: mark project done and complete all tasks in the project.
export const ProjectCompleteInputSchema = z.object({
  id: IdSchema,
})

export type ProjectCompleteInput = z.infer<typeof ProjectCompleteInputSchema>

export const ProjectCompleteResultSchema = z.object({
  project: ProjectSchema,
  // Number of tasks transitioned from open -> done by this operation.
  tasks_completed: z.number().int().nonnegative(),
})

export type ProjectCompleteResult = z.infer<typeof ProjectCompleteResultSchema>

export const ProjectCreateInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  due_at: LocalDateSchema.nullable().optional(),
})

export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>

export const ProjectUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  due_at: LocalDateSchema.nullable().optional(),
  status: ProjectStatusSchema.optional(),
})

export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInputSchema>

export const ProjectSectionSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  title: z.string().min(1),
  position: z.number().int(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type ProjectSection = z.infer<typeof ProjectSectionSchema>

export const ProjectSectionCreateInputSchema = z.object({
  project_id: IdSchema,
  title: z.string().min(1),
})

export const ProjectSectionRenameInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
})

export const ProjectSectionDeleteInputSchema = z.object({
  id: IdSchema,
})
