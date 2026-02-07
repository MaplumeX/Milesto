import { z } from 'zod'

import { IdSchema } from './common'
import { AreaSchema } from './area'
import { ProjectSchema } from './project'

export const SidebarListModelInputSchema = z.object({})

export const SidebarListModelSchema = z.object({
  areas: z.array(AreaSchema),
  openProjects: z.array(ProjectSchema),
})

export type SidebarListModel = z.infer<typeof SidebarListModelSchema>

export const SidebarReorderAreasInputSchema = z.object({
  ordered_area_ids: z.array(IdSchema),
})

export type SidebarReorderAreasInput = z.infer<typeof SidebarReorderAreasInputSchema>

export const SidebarReorderProjectsInputSchema = z.object({
  area_id: IdSchema.nullable(),
  ordered_project_ids: z.array(IdSchema),
})

export type SidebarReorderProjectsInput = z.infer<typeof SidebarReorderProjectsInputSchema>

export const SidebarMoveProjectInputSchema = z.object({
  project_id: IdSchema,
  from_area_id: IdSchema.nullable(),
  to_area_id: IdSchema.nullable(),
  from_ordered_project_ids: z.array(IdSchema),
  to_ordered_project_ids: z.array(IdSchema),
})

export type SidebarMoveProjectInput = z.infer<typeof SidebarMoveProjectInputSchema>

export const SidebarReorderResultSchema = z.object({
  reordered: z.boolean(),
})

export type SidebarReorderResult = z.infer<typeof SidebarReorderResultSchema>

export const SidebarMoveProjectResultSchema = z.object({
  moved: z.boolean(),
})

export type SidebarMoveProjectResult = z.infer<typeof SidebarMoveProjectResultSchema>
