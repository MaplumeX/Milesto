import { spawn } from 'node:child_process'
import path from 'node:path'
import { repoRoot, resolveElectronBinary } from './electron-tooling.mjs'

const electronBin = resolveElectronBinary()
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
