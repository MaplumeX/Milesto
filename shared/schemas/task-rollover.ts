import { z } from 'zod'

import { LocalDateSchema } from './common'
export const TaskRolloverScheduledToTodayInputSchema = z.object({
  today: LocalDateSchema,
})

export type TaskRolloverScheduledToTodayInput = z.infer<typeof TaskRolloverScheduledToTodayInputSchema>

export const TaskRolloverScheduledToTodayResultSchema = z.object({
  rolled_count: z.number().int().nonnegative(),
})

export type TaskRolloverScheduledToTodayResult = z.infer<typeof TaskRolloverScheduledToTodayResultSchema>
