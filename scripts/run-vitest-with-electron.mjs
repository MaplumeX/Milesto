import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const suffix = process.platform === 'win32' ? '.cmd' : ''
const electronBin = path.join(repoRoot, 'node_modules', '.bin', `electron${suffix}`)
const vitestCli = path.join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs')

const child = spawn(electronBin, [vitestCli, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
  },
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error('[milesto] Failed to start Vitest with Electron runtime.', error)
  process.exit(1)
})
