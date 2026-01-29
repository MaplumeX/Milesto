import { z } from 'zod'

import { AreaSchema } from './area'
import { ChecklistItemSchema } from './checklist'
import { ListPositionSchema } from './list-position'
import { ProjectSchema, ProjectSectionSchema } from './project'
import { TagSchema } from './tag'
import { TaskSchema } from './task'

export const DataExportSchema = z.object({
  schema_version: z.number().int(),
  app_version: z.string(),
  exported_at: z.string().datetime(),
  tasks: z.array(TaskSchema),
  projects: z.array(ProjectSchema),
  project_sections: z.array(ProjectSectionSchema),
  areas: z.array(AreaSchema),
  tags: z.array(TagSchema),
  task_tags: z.array(z.object({ task_id: z.string(), tag_id: z.string() })),
  checklist_items: z.array(ChecklistItemSchema),
  list_positions: z.array(ListPositionSchema),
})

export type DataExport = z.infer<typeof DataExportSchema>

export const DataExportInputSchema = z.object({
  app_version: z.string(),
})

export const DataImportOverwriteInputSchema = z.object({
  mode: z.literal('overwrite'),
  data: DataExportSchema,
})
