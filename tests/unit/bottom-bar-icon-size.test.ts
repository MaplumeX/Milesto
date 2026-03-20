import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('bottom bar icon size contract', () => {
  it('uses a larger touch target and icon size for bottom bar action buttons', () => {
    expect(css).toMatch(
      /\.content-bottom-action-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*14px;[^}]*\}/
    )
    expect(css).toMatch(/\.content-bottom-action-icon\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;[^}]*\}/)
  })
})
