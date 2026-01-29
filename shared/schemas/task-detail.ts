import { z } from 'zod'

import { ChecklistItemSchema } from './checklist'
import { IdSchema } from './common'
import { TaskSchema } from './task'

export const TaskIdInputSchema = z.object({
  id: IdSchema,
})

export const TaskDetailSchema = z.object({
  task: TaskSchema,
  tag_ids: z.array(IdSchema),
  checklist_items: z.array(ChecklistItemSchema),
})

export type TaskDetail = z.infer<typeof TaskDetailSchema>
