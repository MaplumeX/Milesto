import { z } from 'zod'

export const ThemePreferenceSchema = z.enum(['system', 'light', 'dark'])
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>

export const EffectiveThemeSchema = z.enum(['light', 'dark'])
export type EffectiveTheme = z.infer<typeof EffectiveThemeSchema>

export const ThemeStateSchema = z.object({
  preference: ThemePreferenceSchema,
  effectiveTheme: EffectiveThemeSchema,
})
export type ThemeState = z.infer<typeof ThemeStateSchema>
