# Release Workflow Contract

This document records the repository-level contract for publishing Milesto desktop builds through GitHub Actions.

## Scenario: GitHub Release Build

### 1. Scope / Trigger

- Trigger: pushing a semantic version tag matching `v*.*.*`.
- Workflow file: `.github/workflows/release.yml`.
- Purpose: create a draft GitHub Release and upload Electron Builder installers from macOS, Windows, and Linux runners.

### 2. Signatures

- Git command:
  ```bash
  git push origin vX.Y.Z
  ```
- GitHub Actions trigger:
  ```yaml
  on:
    push:
      tags:
        - "v*.*.*"
  ```
- Release asset command:
  ```bash
  gh release upload "$TAG_NAME" "${assets[@]}" --clobber
  ```

### 3. Contracts

- Required token permission:
  ```yaml
  permissions:
    contents: write
  ```
- Required environment:
  - `GH_TOKEN`: `${{ github.token }}`
  - `GH_REPO`: `${{ github.repository }}`
  - `TAG_NAME`: `${{ github.ref_name }}`
- Jobs that run `gh release` without checking out the repository must set `GH_REPO` explicitly so GitHub CLI does not try to infer the repository from local `.git` metadata.
- Required matrix runners:
  - `macos-latest`
  - `windows-latest`
  - `ubuntu-latest`
- Required release asset extensions:
  - `.dmg`
  - `.exe`
  - `.AppImage`
- Build command contract:
  - `npm run build` must remain the single command that performs TypeScript compilation, Vite production build, and Electron Builder packaging.
- Database test command contract:
  - `npm run test:db` must run `scripts/ensure-electron-native-deps.mjs` before `scripts/run-vitest-with-electron.mjs` starts Vitest.
  - `npm run test:db:watch` must use the same native dependency guard before entering watch mode.
  - Keep this at the package script contract level so local runs and GitHub Actions clean installs behave the same.

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|-----------|-------------------|
| Tag does not match `v*.*.*` | Workflow must not run |
| Release already exists | Workflow edits/reuses the existing draft release |
| Release does not exist | Workflow creates a draft release |
| No installer assets exist under `release/**` | Workflow fails before upload |
| Any platform build fails | That matrix job fails; other matrix jobs may continue |
| `better-sqlite3` was installed under Node ABI after `npm ci` | DB test scripts rebuild/probe Electron native dependencies before Vitest imports database code |

### 5. Good / Base / Bad Cases

- Good: `v0.2.0` is pushed, all three runners upload one platform installer each to a draft release.
- Base: one platform fails, the Release still contains successful platform assets and the failed job is visible in Actions.
- Bad: workflow uploads intermediate build files, source maps, or unpacked directories instead of installer assets.

### 6. Tests Required

- Parse the workflow YAML before committing.
- When dependency metadata changes, run `npx npm@10 ci` locally before tagging a release. GitHub's Node 22 runners can enforce npm 10 lockfile validation, which may reject lockfiles that npm 11 accepts.
- Run `npm run lint`.
- Run `npx tsc --noEmit` when touching release workflow behavior that depends on project build scripts.
- Run `npm test` and `npm run test:db` before relying on release builds.
- Verify `npm run test:db` output includes the `pretest:db` native dependency guard before the Vitest command when changing test scripts.
- GitHub-hosted runner behavior is verified by pushing a release tag; local validation cannot fully prove `gh release` calls.

### 7. Wrong vs Correct

#### Wrong

```yaml
on:
  push:
    branches:
      - master
```

This publishes every branch push and does not tie release assets to immutable version tags.

#### Correct

```yaml
on:
  push:
    tags:
      - "v*.*.*"
```

Release builds must be tied to explicit version tags so GitHub Release assets are reproducible and auditable.

#### Wrong

```bash
npm install --package-lock-only
npm ci
```

This can miss lockfile entries required by the npm version used in GitHub Actions.

#### Correct

```bash
npx npm@10 install --package-lock-only
npx npm@10 ci
```

Use npm 10 compatibility checks before pushing a release tag when the dependency graph or lockfile changed.

#### Wrong

```json
"test:db": "node ./scripts/run-vitest-with-electron.mjs run -c vitest.db.config.ts"
```

Running DB tests through Electron without a native dependency guard can load a `better-sqlite3` binary compiled for the GitHub Actions Node version instead of Electron's ABI.

#### Correct

```json
"pretest:db": "node ./scripts/ensure-electron-native-deps.mjs",
"test:db": "node ./scripts/run-vitest-with-electron.mjs run -c vitest.db.config.ts"
```

Use npm lifecycle scripts to keep the DB test command reliable after a clean `npm ci` and before Vitest imports the database layer.
