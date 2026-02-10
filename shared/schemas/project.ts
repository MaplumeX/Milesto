import { z } from 'zod'

import {
  DbBoolSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  ProjectStatusSchema,
} from './common'

export const ProjectSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  notes: z.string(),
  area_id: IdSchema.nullable(),
  status: ProjectStatusSchema,
  // Nullable for backward compatibility; only set after manual ordering is used.
  position: z.number().int().nullable().optional(),
  scheduled_at: LocalDateSchema.nullable(),
  is_someday: DbBoolSchema,
  due_at: LocalDateSchema.nullable(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  completed_at: IsoDateTimeSchema.nullable(),
  deleted_at: IsoDateTimeSchema.nullable(),
})

// Cross-layer invariant validation: if DB ever returns an invalid row,
// fail fast instead of leaking inconsistent state to the UI.
.superRefine((project, ctx) => {
  if (project.is_someday && project.scheduled_at !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid project: is_someday=true requires scheduled_at=null.',
      path: ['is_someday'],
    })
  }
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

export const ProjectDeleteInputSchema = z.object({
  id: IdSchema,
})

export type ProjectDeleteInput = z.infer<typeof ProjectDeleteInputSchema>

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
  is_someday: z.boolean().optional(),
  due_at: LocalDateSchema.nullable().optional(),
})

.superRefine((input, ctx) => {
  if (input.is_someday && input.scheduled_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid project.create payload: is_someday=true requires scheduled_at=null.',
      path: ['is_someday'],
    })
  }
})

export type ProjectCreateInput = z.infer<typeof ProjectCreateInputSchema>

export const ProjectUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().min(1).optional(),
  notes: z.string().optional(),
  area_id: IdSchema.nullable().optional(),
  scheduled_at: LocalDateSchema.nullable().optional(),
  is_someday: z.boolean().optional(),
  due_at: LocalDateSchema.nullable().optional(),
  status: ProjectStatusSchema.optional(),
})

.superRefine((input, ctx) => {
  if (input.is_someday && input.scheduled_at) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid project.update payload: is_someday=true requires scheduled_at=null.',
      path: ['is_someday'],
    })
  }
})

export type ProjectUpdateInput = z.infer<typeof ProjectUpdateInputSchema>

export const ProjectSectionSchema = z.object({
  id: IdSchema,
  project_id: IdSchema,
  // Sections may be created before being named.
  title: z.string(),
  position: z.number().int(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type ProjectSection = z.infer<typeof ProjectSectionSchema>

export const ProjectSectionCreateInputSchema = z.object({
  project_id: IdSchema,
  // Allow empty string titles (see ProjectSectionSchema).
  title: z.string(),
})

export const ProjectSectionRenameInputSchema = z.object({
  id: IdSchema,
  // Allow clearing section titles back to empty.
  title: z.string(),
})

export const ProjectSectionDeleteInputSchema = z.object({
  id: IdSchema,
})

export const ProjectSectionReorderBatchInputSchema = z.object({
  project_id: IdSchema,
  ordered_section_ids: z.array(IdSchema),
})

export type ProjectSectionReorderBatchInput = z.infer<typeof ProjectSectionReorderBatchInputSchema>

export const ProjectSectionReorderBatchResultSchema = z.object({
  reordered: z.boolean(),
})

export type ProjectSectionReorderBatchResult = z.infer<typeof ProjectSectionReorderBatchResultSchema>
