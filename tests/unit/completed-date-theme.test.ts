import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8')

describe('completed date theme contract', () => {
  it('defines a dedicated theme token for completed task dates', () => {
    expect(css).toContain('--completed-date-color: var(--ppc-color);')
  })

  it('maps completed task date prefixes to the theme token only in done rows', () => {
    expect(css).toMatch(
      /\.task-row\.is-done\s+\.upcoming-date-prefix\s*\{[\s\S]*color:\s*var\(--completed-date-color\);/
    )
  })

  it('centers and bolds completed task date prefixes in done rows', () => {
    expect(css).toMatch(
      /\.task-row\.is-done\s+\.upcoming-date-prefix\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*justify-content:\s*center;[\s\S]*text-align:\s*center;[\s\S]*font-weight:\s*650;/
    )
  })

  it('vertically centers the completed task date/title button content in done rows', () => {
    expect(css).toMatch(
      /\.task-row\.is-done\s+\.upcoming-task-title-button\s*\{[\s\S]*align-items:\s*center;/
    )
  })

  it('maps logbook date prefixes to the theme token through a dedicated logbook marker', () => {
    expect(css).toMatch(
      /\.task-row\[data-logbook-row\]\s+\.upcoming-date-prefix\s*\{[\s\S]*color:\s*var\(--completed-date-color\);/
    )
  })

  it('centers and bolds logbook date prefixes through the dedicated marker', () => {
    expect(css).toMatch(
      /\.task-row\[data-logbook-row\]\s+\.upcoming-date-prefix\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*justify-content:\s*center;[\s\S]*text-align:\s*center;[\s\S]*font-weight:\s*650;/
    )
  })

  it('vertically centers the logbook date/title button content through the dedicated marker', () => {
    expect(css).toMatch(
      /\.task-row\[data-logbook-row\]\s+\.upcoming-task-title-button\s*\{[\s\S]*align-items:\s*center;/
    )
  })
})
