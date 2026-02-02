import { z } from 'zod'

export const IdSchema = z.string().min(1)

export const IsoDateTimeSchema = z.string().datetime()

// Local date string: YYYY-MM-DD (used for scheduled_at/due_at in v0.1).
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const TaskStatusSchema = z.enum(['open', 'done'])
export const ProjectStatusSchema = z.enum(['open', 'done'])

// SQLite stores booleans as INTEGER (0/1). Keep JSON export/import as booleans.
export const DbBoolSchema = z.preprocess((v) => {
  if (v === 0 || v === false) return false
  if (v === 1 || v === true) return true
  return v
}, z.boolean())
