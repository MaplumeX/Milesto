import { describe, expect, it } from 'vitest'

import { applyAppFontSize, getRootFontSizePx } from '../../src/app/app-font-size'

describe('app font size', () => {
  it('maps slider steps onto the 12px root baseline', () => {
    expect(getRootFontSizePx(-3)).toBe('10.56px')
    expect(getRootFontSizePx(0)).toBe('12px')
    expect(getRootFontSizePx(3)).toBe('15.12px')
  })

  it('applies font size to the document root', () => {
    const root = document.createElement('html')

    applyAppFontSize(1, root)

    expect(root.style.fontSize).toBe('12.72px')
    expect(root.dataset.fontSizeStep).toBe('1')
  })
})
