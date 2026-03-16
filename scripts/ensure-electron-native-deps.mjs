import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function resolveBin(name) {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  return path.join(repoRoot, 'node_modules', '.bin', `${name}${suffix}`)
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.stdio ?? 'pipe',
    env: options.env ?? process.env,
    encoding: 'utf8',
  })
}

const electronBin = resolveBin('electron')
const electronBuilderBin = resolveBin('electron-builder')

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
const rebuild = run(electronBuilderBin, ['install-app-deps'], { stdio: 'inherit' })

if (rebuild.status !== 0) {
  process.stderr.write('[milesto] Failed to rebuild Electron native dependencies.\n')
  process.exit(rebuild.status ?? 1)
}
