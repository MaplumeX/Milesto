import { z } from 'zod'

// Cross-boundary error shape. UI must only rely on code/message.
export type AppError = {
  code: string
  message: string
  details?: unknown
}

export const AppErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
})

export function toAppError(error: unknown, fallback: AppError): AppError {
  const parsed = AppErrorSchema.safeParse(error)
  if (parsed.success) return parsed.data
  return fallback
}
