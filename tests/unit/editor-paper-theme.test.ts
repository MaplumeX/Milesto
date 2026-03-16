import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('editor paper theme contract', () => {
  it('defines the dark editor paper token', () => {
    expect(css).toContain('--editor-paper: #31353A;')
  })

  it('maps inline and overlay task editors to editor paper', () => {
    expect(css).toMatch(/\.task-inline-paper\s*\{[\s\S]*background:\s*var\(--editor-paper\);/)
    expect(css).toMatch(/\.overlay-paper\s*\{[\s\S]*background:\s*var\(--editor-paper\);/)
  })

  it('keeps task inline popovers on the existing paper surface', () => {
    expect(css).toMatch(/\.task-inline-popover\s*\{[\s\S]*background:\s*var\(--paper\);/)
    expect(css).not.toMatch(/\.task-inline-popover\s*\{[\s\S]*background:\s*var\(--editor-paper\);/)
  })
})
