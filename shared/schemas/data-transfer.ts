import { z } from 'zod'

import { AreaSchema } from './area'
import { ChecklistItemSchema } from './checklist'
import { ListPositionSchema } from './list-position'
import { ProjectSchema, ProjectSectionSchema } from './project'
import { TagSchema } from './tag'
import { TaskSchema } from './task'

const TaskTagRelSchema = z.object({ task_id: z.string(), tag_id: z.string() })
const ProjectTagRelSchema = z.object({
  project_id: z.string(),
  tag_id: z.string(),
  position: z.number().int(),
})
const AreaTagRelSchema = z.object({
  area_id: z.string(),
  tag_id: z.string(),
  position: z.number().int(),
})

export const DataExportV2Schema = z.object({
  schema_version: z.literal(2),
  app_version: z.string(),
  exported_at: z.string().datetime(),
  tasks: z.array(TaskSchema),
  projects: z.array(ProjectSchema),
  project_sections: z.array(ProjectSectionSchema),
  areas: z.array(AreaSchema),
  tags: z.array(TagSchema),
  task_tags: z.array(TaskTagRelSchema),
  checklist_items: z.array(ChecklistItemSchema),
  list_positions: z.array(ListPositionSchema),
})

export type DataExportV2 = z.infer<typeof DataExportV2Schema>

export const DataExportV3Schema = z.object({
  schema_version: z.literal(3),
  app_version: z.string(),
  exported_at: z.string().datetime(),
  tasks: z.array(TaskSchema),
  projects: z.array(ProjectSchema),
  project_sections: z.array(ProjectSectionSchema),
  areas: z.array(AreaSchema),
  tags: z.array(TagSchema),
  task_tags: z.array(TaskTagRelSchema),
  project_tags: z.array(ProjectTagRelSchema),
  area_tags: z.array(AreaTagRelSchema),
  checklist_items: z.array(ChecklistItemSchema),
  list_positions: z.array(ListPositionSchema),
})

export type DataExportV3 = z.infer<typeof DataExportV3Schema>

export const DataExportSchema = z.discriminatedUnion('schema_version', [DataExportV2Schema, DataExportV3Schema])

export type DataExport = z.infer<typeof DataExportSchema>

export const DataExportInputSchema = z.object({
  app_version: z.string(),
})

export const DataImportOverwriteInputSchema = z.object({
  mode: z.literal('overwrite'),
  data: DataExportSchema,
})
