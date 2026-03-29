import { spawnSync } from 'node:child_process'
import { repoRoot, resolveElectronBinary, resolveElectronBuilderCli } from './electron-tooling.mjs'

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.stdio ?? 'pipe',
    env: options.env ?? process.env,
    encoding: 'utf8',
  })
}

const electronBin = resolveElectronBinary()
const electronBuilderCli = resolveElectronBuilderCli()

function runProbe() {
  return run(
    electronBin,
    ['-e', "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.close();"],
    {
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
      },
    }
  )
}

function reportProbeFailure(probe, context) {
  process.stderr.write(`[milesto] ${context}\n`)

  if (probe.error) {
    process.stderr.write(`[milesto] Spawn error: ${probe.error.message}\n`)
  }

  const stderr = probe.stderr?.trim()
  if (stderr) {
    process.stderr.write(`${stderr}\n`)
  }

  const stdout = probe.stdout?.trim()
  if (stdout) {
    process.stderr.write(`${stdout}\n`)
  }
}

const probe = runProbe()

if (probe.status === 0) {
  process.exit(0)
}

process.stdout.write('[milesto] Rebuilding Electron native dependencies for better-sqlite3...\n')
const rebuild = run(process.execPath, [electronBuilderCli, 'install-app-deps'], { stdio: 'inherit' })

if (rebuild.status !== 0) {
  if (rebuild.error) {
    process.stderr.write(`[milesto] Failed to start native dependency rebuild: ${rebuild.error.message}\n`)
  }
  process.stderr.write('[milesto] Failed to rebuild Electron native dependencies.\n')
  process.exit(rebuild.status ?? 1)
}

const postRebuildProbe = runProbe()
if (postRebuildProbe.status !== 0) {
  reportProbeFailure(postRebuildProbe, 'Native dependency rebuild completed, but better-sqlite3 still does not match the Electron runtime ABI.')
  process.exit(postRebuildProbe.status ?? 1)
}
