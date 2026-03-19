import type { EffectiveTheme } from '../../shared/schemas/theme'

export function getWindowBackgroundColor(effectiveTheme: EffectiveTheme): string {
  return effectiveTheme === 'dark' ? '#222528' : '#FBFCFD'
}
