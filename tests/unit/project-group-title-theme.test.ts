import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('project group title theme contract', () => {
  it('defines a dedicated theme token for project group titles', () => {
    expect(css).toContain('--project-group-title-color: var(--ppc-color);')
  })

  it('maps project group titles to the theme token', () => {
    expect(css).toMatch(/\.project-group-title\s*\{[\s\S]*color:\s*var\(--project-group-title-color\);/)
  })
})
