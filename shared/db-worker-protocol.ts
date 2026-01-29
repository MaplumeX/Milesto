import { z } from 'zod'

import { AppErrorSchema } from './app-error'

export const DbWorkerRequestSchema = z.object({
  id: z.string(),
  type: z.literal('db'),
  action: z.string(),
  payload: z.unknown(),
})

export type DbWorkerRequest = z.infer<typeof DbWorkerRequestSchema>

export const DbWorkerResponseSchema = z.union([
  z.object({
    id: z.string(),
    ok: z.literal(true),
    data: z.unknown(),
  }),
  z.object({
    id: z.string(),
    ok: z.literal(false),
    error: AppErrorSchema,
  }),
])

export type DbWorkerResponse = z.infer<typeof DbWorkerResponseSchema>
