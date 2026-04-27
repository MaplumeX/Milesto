# Fix release workflow git repository error

## Goal

Fix the GitHub Actions release workflow failure where the `create-release` job reports `failed to run git: fatal: not a git repository (or any of the parent directories): .git`.

## What I Already Know

* The failure occurs in the release task at the `Run set -euo pipefail` step.
* `.github/workflows/release.yml` has a `create-release` job that runs `gh release view/edit/create` without checking out the repository first.
* GitHub CLI can attempt to infer the repository from local git context when no repository is provided.
* This job does not need a working tree; it only needs the GitHub repository and tag name.

## Requirements

* The `create-release` job must not depend on local `.git` metadata.
* The existing tag trigger, draft release behavior, and build matrix behavior must remain unchanged.
* The fix should be minimal and scoped to release workflow behavior.

## Acceptance Criteria

* [ ] `gh release view`, `gh release edit`, and `gh release create` in the `create-release` job can resolve the current repository without local git metadata.
* [ ] The release workflow YAML remains valid.
* [ ] Existing release asset upload behavior is unchanged.

## Definition of Done

* Release workflow updated.
* Relevant release workflow contract reviewed.
* YAML parsing or equivalent workflow syntax validation performed.
* Git status reviewed.

## Out of Scope

* Changing the release trigger pattern.
* Changing Electron Builder output configuration.
* Changing release asset names or installer formats.

## Technical Notes

* Relevant workflow: `.github/workflows/release.yml`.
* Relevant spec: `.trellis/spec/frontend/release-workflow.md`.
* Expected minimal fix: provide `GH_REPO: ${{ github.repository }}` to GitHub CLI commands in jobs that do not checkout the repository.
