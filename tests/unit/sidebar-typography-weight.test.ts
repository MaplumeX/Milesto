import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('sidebar typography weight contract', () => {
  it('bolds top-level sidebar navigation items without affecting nested project rows', () => {
    expect(css).toMatch(
      /\.nav\s*>\s*\.nav-item,\s*\.sidebar-bottom\s+\.nav-item\s*\{[^}]*font-weight:\s*650;[^}]*\}/
    )
  })

  it('bolds sidebar area labels', () => {
    expect(css).toMatch(/\.nav-area-label\s*\{[^}]*font-weight:\s*650;[^}]*\}/)
  })

  it('bolds project group titles more strongly', () => {
    expect(css).toMatch(/\.project-group-title\s*\{[^}]*font-weight:\s*700;[^}]*\}/)
  })
})
