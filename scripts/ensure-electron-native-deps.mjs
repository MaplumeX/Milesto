import { spawnSync } from 'node:child_process'
import { repoRoot, resolveElectronBinary, resolveElectronBuilderScript } from './electron-tooling.mjs'

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.stdio ?? 'pipe',
    env: options.env ?? process.env,
    encoding: 'utf8',
  })
}

const electronBin = resolveElectronBinary()
const electronBuilderInstallAppDeps = resolveElectronBuilderScript('install-app-deps.js')

const probe = run(
  electronBin,
  ['-e', "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.close();"],
  {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  }
)

if (probe.status === 0) {
  process.exit(0)
}

process.stdout.write('[milesto] Rebuilding Electron native dependencies for better-sqlite3...\n')
const rebuild = run(process.execPath, [electronBuilderInstallAppDeps], { stdio: 'inherit' })

if (rebuild.status !== 0) {
  if (rebuild.error) {
    process.stderr.write(`[milesto] Failed to start native dependency rebuild: ${rebuild.error.message}\n`)
  }
  process.stderr.write('[milesto] Failed to rebuild Electron native dependencies.\n')
  process.exit(rebuild.status ?? 1)
}
