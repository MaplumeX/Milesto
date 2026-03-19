import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('settings dialog size contract', () => {
  it('keeps the settings dialog as a compact floating surface on desktop', () => {
    expect(css).toMatch(
      /\.settings-dialog\s*\{[^}]*width:\s*min\(680px,\s*calc\(100vw - 96px\)\);[^}]*max-height:\s*min\(80vh,\s*720px\);[^}]*\}/
    )
  })
})
