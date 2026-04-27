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
  - `TAG_NAME`: `${{ github.ref_name }}`
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

### 4. Validation & Error Matrix

| Condition | Expected behavior |
|-----------|-------------------|
| Tag does not match `v*.*.*` | Workflow must not run |
| Release already exists | Workflow edits/reuses the existing draft release |
| Release does not exist | Workflow creates a draft release |
| No installer assets exist under `release/**` | Workflow fails before upload |
| Any platform build fails | That matrix job fails; other matrix jobs may continue |

### 5. Good / Base / Bad Cases

- Good: `v0.2.0` is pushed, all three runners upload one platform installer each to a draft release.
- Base: one platform fails, the Release still contains successful platform assets and the failed job is visible in Actions.
- Bad: workflow uploads intermediate build files, source maps, or unpacked directories instead of installer assets.

### 6. Tests Required

- Parse the workflow YAML before committing.
- Run `npm run lint`.
- Run `npx tsc --noEmit` when touching release workflow behavior that depends on project build scripts.
- Run `npm test` and `npm run test:db` before relying on release builds.
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
