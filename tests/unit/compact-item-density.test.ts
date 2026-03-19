import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('compact item density contract', () => {
  it('tightens task row spacing while preserving the two-line structure', () => {
    expect(css).toMatch(/\.task-row\.task-row-virtual\s+\.task-row-inner\s*\{[^}]*padding:\s*6px 8px;[^}]*\}/)
    expect(css).toMatch(/\.task-row-inner\s*\{[^}]*gap:\s*8px;[^}]*\}/)
    expect(css).toMatch(/\.task-title-stack\s*\{[^}]*gap:\s*1px;[^}]*\}/)
    expect(css).toMatch(
      /\.task-project-affiliation\s*\{[^}]*font-size:\s*11px;[^}]*line-height:\s*1\.15;[^}]*\}/
    )
    expect(css).toMatch(/\.task-checkbox input\s*\{[^}]*width:\s*14px;[^}]*height:\s*14px;[^}]*\}/)
  })

  it('tightens sidebar navigation and project item density without touching font-weight', () => {
    expect(css).toMatch(/\.nav-item\s*\{[^}]*padding:\s*5px 8px;[^}]*\}/)
    expect(css).toMatch(/\.nav-item\.is-indent\s*\{[^}]*margin-left:\s*8px;[^}]*\}/)
    expect(css).toMatch(/\.nav-project-header\s*\{[^}]*gap:\s*6px;[^}]*margin:\s*1px 0;[^}]*\}/)
    expect(css).toMatch(/\.nav-project-header\.is-indent\s*\{[^}]*margin-left:\s*8px;[^}]*\}/)
    expect(css).toMatch(/\.nav-area\s*\{[^}]*margin-top:\s*6px;[^}]*\}/)
    expect(css).toMatch(/\.nav-area-row\s*\{[^}]*gap:\s*6px;[^}]*padding-right:\s*30px;[^}]*\}/)
  })

  it('tightens project grouping and drag overlays to match the new rhythm', () => {
    expect(css).toMatch(/\.project-group-header\s*\{[^}]*gap:\s*10px;[^}]*padding:\s*6px 10px;[^}]*\}/)
    expect(css).toMatch(/\.project-group-left\s*\{[^}]*gap:\s*8px;[^}]*\}/)
    expect(css).toMatch(
      /\.project-group-left-button\s*\{[^}]*margin:\s*-6px -10px;[^}]*padding:\s*6px 10px;[^}]*\}/
    )
    expect(css).toMatch(/\.sidebar-dnd-overlay\s*\{[^}]*padding:\s*6px 8px;[^}]*\}/)
    expect(css).toMatch(/\.task-dnd-overlay\s+\.task-row-inner\s*\{[^}]*padding:\s*6px 8px;[^}]*\}/)
    expect(css).toMatch(/\.project-progress-control\s*\{[^}]*width:\s*18px;[^}]*height:\s*18px;[^}]*\}/)
  })
})
