import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { normalizeLocale, type Locale } from '../../../../shared/i18n/locale'

const GetLocaleInputSchema = z.object({})
const SetLocaleInputSchema = z.object({ locale: z.unknown() })

export function createSettingsActions(db: Database.Database): Record<string, DbActionHandler> {
  return {
    'settings.getLocale': (payload) => {
      const parsed = GetLocaleInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.getLocale payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get('locale') as { value?: unknown } | undefined

      if (!row || typeof row.value !== 'string' || !row.value.trim()) {
        return { ok: true, data: { locale: null } }
      }

      const locale = normalizeLocale(row.value)
      return { ok: true, data: { locale } satisfies { locale: Locale } }
    },

    'settings.setLocale': (payload) => {
      const parsed = SetLocaleInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setLocale payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const locale = normalizeLocale(parsed.data.locale)
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({ key: 'locale', value: locale, updated_at: updatedAt })
      })
      tx()

      return { ok: true, data: { locale } satisfies { locale: Locale } }
    },
  }
}
