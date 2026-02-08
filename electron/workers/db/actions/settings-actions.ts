import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { normalizeLocale, type Locale } from '../../../../shared/i18n/locale'

const GetLocaleInputSchema = z.object({})
const SetLocaleInputSchema = z.object({ locale: z.unknown() })

const SIDEBAR_COLLAPSED_AREA_IDS_KEY = 'sidebar.collapsedAreaIds'

const GetSidebarStateInputSchema = z.object({})
const SetSidebarStateInputSchema = z.object({ collapsedAreaIds: z.unknown() })
const SidebarCollapsedAreaIdsSchema = z.array(z.string())

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

    'settings.getSidebarState': (payload) => {
      const parsed = GetSidebarStateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.getSidebarState payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get(SIDEBAR_COLLAPSED_AREA_IDS_KEY) as { value?: unknown } | undefined

      if (!row || typeof row.value !== 'string' || !row.value.trim()) {
        return { ok: true, data: { collapsedAreaIds: [] } }
      }

      try {
        const json = JSON.parse(row.value) as unknown
        const idsParsed = SidebarCollapsedAreaIdsSchema.safeParse(json)
        if (!idsParsed.success) {
          return { ok: true, data: { collapsedAreaIds: [] } }
        }

        const unique = Array.from(new Set(idsParsed.data.filter((id) => id.trim())))
        return { ok: true, data: { collapsedAreaIds: unique } }
      } catch {
        return { ok: true, data: { collapsedAreaIds: [] } }
      }
    },

    'settings.setSidebarState': (payload) => {
      const parsed = SetSidebarStateInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setSidebarState payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const idsParsed = SidebarCollapsedAreaIdsSchema.safeParse(parsed.data.collapsedAreaIds)
      if (!idsParsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setSidebarState payload.',
            details: { issues: idsParsed.error.issues },
          },
        }
      }

      const collapsedAreaIds = Array.from(new Set(idsParsed.data.filter((id) => id.trim())))
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({
          key: SIDEBAR_COLLAPSED_AREA_IDS_KEY,
          value: JSON.stringify(collapsedAreaIds),
          updated_at: updatedAt,
        })
      })
      tx()

      return { ok: true, data: { collapsedAreaIds } }
    },
  }
}
