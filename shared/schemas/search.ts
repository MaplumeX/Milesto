import { z } from 'zod'

import { TaskListItemSchema } from './task-list'

export const TaskSearchInputSchema = z.object({
  query: z.string().min(1),
  include_logbook: z.boolean().optional(),
})

export const TaskSearchResultItemSchema = TaskListItemSchema.extend({
  snippet: z.string().nullable().optional(),
})

export type TaskSearchInput = z.infer<typeof TaskSearchInputSchema>
export type TaskSearchResultItem = z.infer<typeof TaskSearchResultItemSchema>
