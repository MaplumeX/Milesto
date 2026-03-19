import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('checkbox theme contract', () => {
  it('maps checked checkbox fill to the shared theme accent color', () => {
    expect(css).toMatch(
      /\.checkbox-input:checked\s*\+\s*\.checkbox-control\s*\{[^}]*border-color:\s*var\(--ppc-color\);[^}]*background:\s*var\(--ppc-color\);[^}]*\}/
    )
  })
})
