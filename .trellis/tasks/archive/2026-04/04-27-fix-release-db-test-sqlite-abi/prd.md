# Fix GitHub Release DB Test SQLite ABI Mismatch

## Problem

GitHub release builds fail during `npm run test:db` on macOS runners. All DB tests fail at native module load time with:

```text
better_sqlite3.node was compiled against a different Node.js version using NODE_MODULE_VERSION 127.
This version of Node.js requires NODE_MODULE_VERSION 123.
```

The release workflow installs dependencies under GitHub Actions Node 22, then runs database tests through `scripts/run-vitest-with-electron.mjs`, which executes Vitest under the Electron runtime. `better-sqlite3` must be rebuilt for Electron's ABI before tests that import the database layer run.

## Goal

Make `npm run test:db` reliable in GitHub release builds by ensuring Electron native dependencies are ABI-compatible before Electron-backed database tests execute.

## Requirements

- `npm run test:db` must run `scripts/ensure-electron-native-deps.mjs` or equivalent before Vitest starts under Electron.
- The fix must preserve existing `npm run build` behavior, including the current prebuild native dependency guard.
- The fix must work in GitHub Actions after a clean `npm ci` on Node 22.
- Watch-mode DB tests should not regress if the same lifecycle gap applies there.
- Avoid broad workflow-only hacks; prefer keeping the project script contract correct so local and CI usage behave the same.

## Validation

- Run `npm run test:db`.
- Run `npm run lint`.
- Run `npm test` if practical after the DB test fix.
- Inspect `.github/workflows/release.yml` only if script-level changes are insufficient.
