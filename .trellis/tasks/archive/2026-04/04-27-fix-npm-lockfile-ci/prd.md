# fix: sync npm lockfile for github build

## Goal

Fix the GitHub Actions release build failure in the `Install dependencies` step where `npm ci` exits with `EUSAGE` because `package.json` and `package-lock.json` are out of sync.

## What I already know

* The release workflow runs `npm ci` from the repository root on macOS, Windows, and Ubuntu.
* GitHub Actions reported missing lockfile entries for `@emnapi/core@1.10.0`, `@emnapi/runtime@1.10.0`, and `esbuild@0.28.0`.
* `npm ci` requires the package manifest and lockfile to be in sync before it installs dependencies.

## Requirements

* Update the root `package-lock.json` so it is consistent with the current root `package.json`.
* Do not change runtime behavior or release workflow behavior unless inspection shows the workflow is directly responsible for the failure.
* Verify that `npm ci` can pass locally after the lockfile update.
* Run the repository quality checks that are practical for this dependency-only fix.

## Acceptance Criteria

* [x] `npm ci` no longer fails with a lockfile sync `EUSAGE` error.
* [x] `package-lock.json` contains the dependency graph required by the current `package.json`.
* [x] Existing release workflow still installs dependencies with `npm ci`.
* [x] Lint/build or equivalent verification has been run, or any skipped check is explicitly documented.

## Definition of Done

* Lockfile is updated and committed-ready.
* CI install step can be reproduced locally.
* Any relevant Trellis spec decision is reviewed.

## Out of Scope

* Changing application dependencies beyond the lockfile synchronization required by npm.
* Redesigning the GitHub release workflow.

## Technical Notes

* Relevant workflow: `.github/workflows/release.yml`.
* Relevant spec: `.trellis/spec/frontend/release-workflow.md`.
* The GitHub failure reproduces locally with `npx npm@10 ci` before the lockfile update.
* `npx npm@10 install --package-lock-only` adds the missing npm 10 lockfile entries.
* Verified after the update with `npx npm@10 ci` and `npm run lint`.
