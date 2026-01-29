import { z } from 'zod'

export const IdSchema = z.string().min(1)

export const IsoDateTimeSchema = z.string().datetime()

// Local date string: YYYY-MM-DD (used for scheduled_at/due_at in v0.1).
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const TaskStatusSchema = z.enum(['open', 'done'])
export const ProjectStatusSchema = z.enum(['open', 'done'])

export const BaseListSchema = z.enum(['inbox', 'anytime', 'someday'])
