import { describe, expect, it } from 'vitest'

import { getWindowBackgroundColor } from '../../electron/theme/window-background'

describe('getWindowBackgroundColor', () => {
  it('returns the existing light background for light theme', () => {
    expect(getWindowBackgroundColor('light')).toBe('#ffffff')
  })

  it('returns the warm content background for dark theme', () => {
    expect(getWindowBackgroundColor('dark')).toBe('#222528')
  })
})
