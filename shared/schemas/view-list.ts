import { z } from 'zod'

import {
  DbBoolSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocalDateSchema,
  ProjectStatusSchema,
} from './common'
import { TaskListItemSchema } from './task-list'

export const ViewListEntityKindSchema = z.enum(['task', 'project'])
export type ViewListEntityKind = z.infer<typeof ViewListEntityKindSchema>

export const ViewListTaskItemSchema = TaskListItemSchema.extend({
  kind: z.literal('task'),
})

export const ViewListProjectItemSchema = z.object({
  kind: z.literal('project'),
  id: IdSchema,
  title: z.string(),
  status: ProjectStatusSchema,
  area_id: IdSchema.nullable(),
  scheduled_at: LocalDateSchema.nullable(),
  is_someday: DbBoolSchema,
  due_at: LocalDateSchema.nullable(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  completed_at: IsoDateTimeSchema.nullable(),
  deleted_at: IsoDateTimeSchema.nullable(),
  tag_preview: z.array(z.string()).max(2).optional(),
  tag_count: z.number().int().nonnegative().optional(),
  tag_ids: z.array(z.string()).optional(),
  rank: z.number().int().nullable().optional(),
  total_count: z.number().int().nonnegative(),
  done_count: z.number().int().nonnegative(),
})

export const ViewListItemSchema = z.discriminatedUnion('kind', [
  ViewListTaskItemSchema,
  ViewListProjectItemSchema,
])

export type ViewListTaskItem = z.infer<typeof ViewListTaskItemSchema>
export type ViewListProjectItem = z.infer<typeof ViewListProjectItemSchema>
export type ViewListItem = z.infer<typeof ViewListItemSchema>

export const ViewListAnytimeInputSchema = z.object({})
export const ViewListSomedayInputSchema = z.object({})

export const ViewListTodayInputSchema = z.object({
  date: LocalDateSchema,
})

export const ViewListUpcomingInputSchema = z.object({
  from_date: LocalDateSchema,
})

export const ViewReorderItemSchema = z.object({
  kind: ViewListEntityKindSchema,
  id: IdSchema,
})

export type ViewReorderItem = z.infer<typeof ViewReorderItemSchema>

export const ViewReorderBatchInputSchema = z.object({
  list_id: z.string().min(1),
  ordered_items: z.array(ViewReorderItemSchema),
})

export const ViewPositionSchema = z.object({
  list_id: z.string().min(1),
  entity_type: ViewListEntityKindSchema,
  entity_id: IdSchema,
  rank: z.number().int(),
  updated_at: IsoDateTimeSchema,
})

export type ViewPosition = z.infer<typeof ViewPositionSchema>
