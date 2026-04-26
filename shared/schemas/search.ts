import { z } from 'zod'

import { TaskListItemSchema } from './task-list'

export const TaskSearchScopeSchema = z.enum([
  'inbox',
  'today',
  'upcoming',
  'anytime',
  'someday',
  'logbook',
  'trash',
  'anywhere',
])

export type TaskSearchScope = z.infer<typeof TaskSearchScopeSchema>

export const TaskSearchInputSchema = z.object({
  query: z.string().min(1),
  include_logbook: z.boolean().optional(),
  scope: TaskSearchScopeSchema.optional(),
  date: z.string().optional(),
})

export const TaskSearchResultItemSchema = TaskListItemSchema.extend({
  snippet: z.string().nullable().optional(),
})

export const ProjectSearchResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  area_id: z.string().nullable(),
})

export const AreaSearchResultItemSchema = z.object({
  id: z.string(),
  title: z.string(),
})

export type TaskSearchInput = z.infer<typeof TaskSearchInputSchema>
export type TaskSearchResultItem = z.infer<typeof TaskSearchResultItemSchema>
export type ProjectSearchResultItem = z.infer<typeof ProjectSearchResultItemSchema>
export type AreaSearchResultItem = z.infer<typeof AreaSearchResultItemSchema>
