import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('light theme token contract', () => {
  it('defines the new light palette tokens', () => {
    expect(css).toContain('--bg: #F6F8FB;')
    expect(css).toContain('--content-bg: #FBFCFD;')
    expect(css).toContain('--content-edge-bg: #F1F4F8;')
    expect(css).toContain('--sidebar-bg: #EEF2F6;')
    expect(css).toContain('--panel: #F8FAFC;')
    expect(css).toContain('--text: #162033;')
    expect(css).toContain('--muted: #5F6E82;')
  })

  it('keeps interactive wash tokens aligned to the light palette', () => {
    expect(css).toContain('--wash: rgba(52, 74, 103, 0.055);')
    expect(css).toContain('--wash-strong: rgba(52, 74, 103, 0.095);')
  })
})
