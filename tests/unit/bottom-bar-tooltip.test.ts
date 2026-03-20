import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('bottom bar tooltip contract', () => {
  it('shows a custom tooltip above bottom bar actions through an explicit visibility state', () => {
    expect(css).toMatch(/\.content-bottom-action\s*\{[^}]*position:\s*relative;[^}]*display:\s*inline-flex;[^}]*\}/)
    expect(css).toMatch(/\.content-bottom-action-tooltip\s*\{[^}]*bottom:\s*calc\(100%\s*\+\s*8px\);[^}]*\}/)
    expect(css).toMatch(/\.content-bottom-action-tooltip\s*\{[^}]*pointer-events:\s*none;[^}]*\}/)
    expect(css).toMatch(/\.content-bottom-action-tooltip\s*\{[^}]*opacity:\s*0;[^}]*\}/)
    expect(css).toMatch(
      /\.content-bottom-action\[data-tooltip-visible='true'\]\s+\.content-bottom-action-tooltip\s*\{[^}]*opacity:\s*1;[^}]*\}/
    )
  })
})
