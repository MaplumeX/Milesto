import type Database from 'better-sqlite3'
import { z } from 'zod'

import type { DbActionHandler } from './db-actions'
import { nowIso } from './utils'

import { normalizeLocale, type Locale } from '../../../../shared/i18n/locale'
import { AiConfigSchema, DEFAULT_AI_CONFIG, type AiConfig } from '../../../../shared/schemas/chat'
import { FontSizeStepSchema, type FontSizeStep } from '../../../../shared/schemas/font-size'
import { ThemePreferenceSchema, type ThemePreference } from '../../../../shared/schemas/theme'

const GetLocaleInputSchema = z.object({})
const SetLocaleInputSchema = z.object({ locale: z.unknown() })

const SIDEBAR_COLLAPSED_AREA_IDS_KEY = 'sidebar.collapsedAreaIds'
const SIDEBAR_WIDTH_KEY = 'sidebar.width'

const THEME_PREFERENCE_KEY = 'theme.preference'
const FONT_SIZE_STEP_KEY = 'fontSize.step'
const AI_CONFIG_KEY = 'ai.config'

const GetSidebarStateInputSchema = z.object({})
const SetSidebarStateInputSchema = z.object({ collapsedAreaIds: z.unknown(), width: z.unknown() })
const SidebarCollapsedAreaIdsSchema = z.array(z.string())

const GetThemePreferenceInputSchema = z.object({})
const SetThemePreferenceInputSchema = z.object({ preference: z.unknown() })

const GetFontSizeStepInputSchema = z.object({})
const SetFontSizeStepInputSchema = z.object({ step: z.unknown() }).superRefine((payload, ctx) => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'step')) {
    ctx.addIssue({ code: 'custom', path: ['step'], message: 'Required' })
  }
})

const GetAiConfigInputSchema = z.object({})
const SetAiConfigInputSchema = z.object({ config: z.unknown() })

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

      let collapsedAreaIds: string[] = []
      if (row && typeof row.value === 'string' && row.value.trim()) {
        try {
          const json = JSON.parse(row.value) as unknown
          const idsParsed = SidebarCollapsedAreaIdsSchema.safeParse(json)
          if (idsParsed.success) {
            collapsedAreaIds = Array.from(new Set(idsParsed.data.filter((id) => id.trim())))
          }
        } catch {
          // keep default empty array
        }
      }

      const widthRow = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get(SIDEBAR_WIDTH_KEY) as { value?: unknown } | undefined

      let width = 280
      if (widthRow && typeof widthRow.value === 'string' && widthRow.value.trim()) {
        const num = Number(widthRow.value)
        if (Number.isFinite(num) && num >= 0) {
          width = num
        }
      }

      return { ok: true, data: { collapsedAreaIds, width } }
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

      const widthNum = Number(parsed.data.width)
      const width = Number.isFinite(widthNum) && widthNum >= 0 ? widthNum : 280

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
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({
          key: SIDEBAR_WIDTH_KEY,
          value: String(width),
          updated_at: updatedAt,
        })
      })
      tx()

      return { ok: true, data: { collapsedAreaIds, width } }
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

    'settings.getAiConfig': (payload) => {
      const parsed = GetAiConfigInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.getAiConfig payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const row = db
        .prepare('SELECT value FROM app_settings WHERE key = ? LIMIT 1')
        .get(AI_CONFIG_KEY) as { value?: unknown } | undefined

      if (!row || typeof row.value !== 'string' || !row.value.trim()) {
        return { ok: true, data: { config: DEFAULT_AI_CONFIG } satisfies { config: AiConfig } }
      }

      try {
        const json = JSON.parse(row.value) as unknown
        const validated = AiConfigSchema.safeParse(json)
        if (!validated.success) {
          // Persisted config is invalid (e.g. older schema); fall back to defaults.
          return { ok: true, data: { config: DEFAULT_AI_CONFIG } satisfies { config: AiConfig } }
        }
        return { ok: true, data: { config: validated.data } satisfies { config: AiConfig } }
      } catch {
        return { ok: true, data: { config: DEFAULT_AI_CONFIG } satisfies { config: AiConfig } }
      }
    },

    'settings.setAiConfig': (payload) => {
      const parsed = SetAiConfigInputSchema.safeParse(payload)
      if (!parsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid settings.setAiConfig payload.',
            details: { issues: parsed.error.issues },
          },
        }
      }

      const configParsed = AiConfigSchema.safeParse(parsed.data.config)
      if (!configParsed.success) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid AI config.',
            details: { issues: configParsed.error.issues },
          },
        }
      }

      const config = configParsed.data
      const updatedAt = nowIso()

      const tx = db.transaction(() => {
        db.prepare(
          `INSERT INTO app_settings (key, value, updated_at)
           VALUES (@key, @value, @updated_at)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        ).run({ key: AI_CONFIG_KEY, value: JSON.stringify(config), updated_at: updatedAt })
      })
      tx()

      return { ok: true, data: { config } satisfies { config: AiConfig } }
    },
  }
}
