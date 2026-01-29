import { z } from 'zod'

import { AppErrorSchema } from './app-error'
import type { AppError } from './app-error'

export type Ok<T> = { ok: true; data: T }
export type Err = { ok: false; error: AppError }
export type Result<T> = Ok<T> | Err

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data }
}

export function err(error: AppError): Err {
  return { ok: false, error }
}

export function resultSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.union([
    z.object({ ok: z.literal(true), data: dataSchema }),
    z.object({ ok: z.literal(false), error: AppErrorSchema }),
  ])
}
