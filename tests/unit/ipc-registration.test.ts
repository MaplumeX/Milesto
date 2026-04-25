import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return Array.from(new Set(Array.from(source.matchAll(pattern), (match) => match[1] ?? ''))).filter(Boolean).sort()
}

describe('IPC registration', () => {
  it('registers every preload db channel in main', () => {
    const root = process.cwd()
    const preloadSource = readFileSync(resolve(root, 'electron/preload.ts'), 'utf8')
    const mainSource = readFileSync(resolve(root, 'electron/main.ts'), 'utf8')

    const preloadDbChannels = uniqueMatches(preloadSource, /invoke\('([^']+)'/g).filter((channel) =>
      channel.startsWith('db:')
    )
    const registeredDbChannels = uniqueMatches(mainSource, /handleDb\(\s*'([^']+)'/g)

    expect(registeredDbChannels).toEqual(expect.arrayContaining(preloadDbChannels))
  })
})
