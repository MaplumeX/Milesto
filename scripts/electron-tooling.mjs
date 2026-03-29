import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export function resolveElectronBinary() {
  const electronBinary = require('electron')

  if (typeof electronBinary !== 'string' || electronBinary.length === 0) {
    throw new Error('[milesto] Failed to resolve Electron binary path.')
  }

  return electronBinary
}

export function resolveElectronBuilderScript(scriptName) {
  return require.resolve(`electron-builder/${scriptName}`)
}
