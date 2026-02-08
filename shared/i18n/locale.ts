import { z } from 'zod'

export const SUPPORTED_LOCALES = ['en', 'zh-CN'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

export const LocaleSchema = z.enum(SUPPORTED_LOCALES)

// Treat locale as untrusted input.
// Normalize system locales and any persisted values into our allowlist.
export function normalizeLocale(input: unknown): Locale {
  if (typeof input !== 'string') return 'en'
  const raw = input.trim()
  if (!raw) return 'en'

  // Fast-path allowlisted values.
  const allowlisted = LocaleSchema.safeParse(raw)
  if (allowlisted.success) return allowlisted.data

  const lower = raw.toLowerCase()

  // Map Chinese variants to zh-CN for v1.
  // Examples: zh, zh-hans, zh-cn, zh-sg, zh-hk, zh-tw.
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN'

  // Everything else falls back to English.
  return 'en'
}

export function getSupportedLocales(): Locale[] {
  return [...SUPPORTED_LOCALES]
}
