import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common'

export const AreaSchema = z.object({
  id: IdSchema,
  title: z.string(),
  notes: z.string(),
  // Nullable for backward compatibility; only set after manual ordering is used.
  position: z.number().int().nullable().optional(),
  created_at: IsoDateTimeSchema,
  updated_at: IsoDateTimeSchema,
  deleted_at: IsoDateTimeSchema.nullable(),
})

export type Area = z.infer<typeof AreaSchema>

export const AreaCreateInputSchema = z.object({
  title: z.string(),
  notes: z.string().optional(),
})

export type AreaCreateInput = z.infer<typeof AreaCreateInputSchema>

export const AreaUpdateInputSchema = z.object({
  id: IdSchema,
  title: z.string().optional(),
  notes: z.string().optional(),
})

export type AreaUpdateInput = z.infer<typeof AreaUpdateInputSchema>

export const AreaDeleteInputSchema = z.object({
  id: IdSchema,
})

export type AreaDeleteInput = z.infer<typeof AreaDeleteInputSchema>
