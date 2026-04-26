import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { normalizeLocale, type Locale } from '../../../../shared/i18n/locale'
import { FontSizeStepSchema, type FontSizeStep } from '../../../../shared/schemas/font-size'
import { ThemePreferenceSchema, type ThemePreference } from '../../../../shared/schemas/theme'

const GetLocaleInputSchema = z.object({})
const SetLocaleInputSchema = z.object({ locale: z.unknown() })

const SIDEBAR_COLLAPSED_AREA_IDS_KEY = 'sidebar.collapsedAreaIds'

const THEME_PREFERENCE_KEY = 'theme.preference'
const FONT_SIZE_STEP_KEY = 'fontSize.step'

const GetSidebarStateInputSchema = z.object({})
const SetSidebarStateInputSchema = z.object({ collapsedAreaIds: z.unknown() })
const SidebarCollapsedAreaIdsSchema = z.array(z.string())

const GetThemePreferenceInputSchema = z.object({})
const SetThemePreferenceInputSchema = z.object({ preference: z.unknown() })

const GetFontSizeStepInputSchema = z.object({})
const SetFontSizeStepInputSchema = z.object({ step: z.unknown() }).superRefine((payload, ctx) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'step')) {
    ctx.addIssue({ code: 'custom', path: ['step'], message: 'Required' })
  }
})

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

    'settings.getThemePreference': (payload) => {
      const parsed = GetThemePreferenceInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.getThemePreference payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get(THEME_PREFERENCE_KEY) as { value?: unknown } | undefined

      if (!row || typeof row.value !== 'string' || !row.value.trim()) {
        return { ok: true, data: { preference: null } }
      }

      const allowlisted = ThemePreferenceSchema.safeParse(row.value)
      if (!allowlisted.success) {
        return { ok: true, data: { preference: null } }
      }

      return { ok: true, data: { preference: allowlisted.data } satisfies { preference: ThemePreference } }
    },

    'settings.setThemePreference': (payload) => {
      const parsed = SetThemePreferenceInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setThemePreference payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const preferenceParsed = ThemePreferenceSchema.safeParse(parsed.data.preference)
      if (!preferenceParsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid theme preference.',
            details: { issues: preferenceParsed.error.issues },
          },
        }
      }

      const preference = preferenceParsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({ key: THEME_PREFERENCE_KEY, value: preference, updated_at: updatedAt })
      })
      tx()

      return { ok: true, data: { preference } satisfies { preference: ThemePreference } }
    },

    'settings.getFontSizeStep': (payload) => {
      const parsed = GetFontSizeStepInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.getFontSizeStep payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get(FONT_SIZE_STEP_KEY) as { value?: unknown } | undefined

      if (!row || typeof row.value !== 'string' || !row.value.trim()) {
        return { ok: true, data: { step: null } }
      }

      const persistedValue = row.value.trim()
      const allowlisted = FontSizeStepSchema.safeParse(Number(persistedValue))
      if (!allowlisted.success || String(allowlisted.data) !== persistedValue) {
        return { ok: true, data: { step: null } }
      }

      return { ok: true, data: { step: allowlisted.data } satisfies { step: FontSizeStep } }
    },

    'settings.setFontSizeStep': (payload) => {
      const parsed = SetFontSizeStepInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setFontSizeStep payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const stepParsed = FontSizeStepSchema.safeParse(parsed.data.step)
      if (!stepParsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid font size step.',
            details: { issues: stepParsed.error.issues },
          },
        }
      }

      const step = stepParsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({ key: FONT_SIZE_STEP_KEY, value: String(step), updated_at: updatedAt })
      })
      tx()

      return { ok: true, data: { step } satisfies { step: FontSizeStep } }
    },
  }
}
