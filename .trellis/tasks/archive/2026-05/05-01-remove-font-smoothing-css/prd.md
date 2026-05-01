# Remove Font Smoothing CSS

## Goal

Remove the global font rendering hints that may make text appear blurry on Windows.

## What I already know

* The user wants to remove `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility`.
* These declarations currently live in the global `:root` CSS rule.
* This task should not change the font stack, font sizes, or typography weights.

## Requirements

* Remove the global `-webkit-font-smoothing: antialiased` declaration.
* Remove the global `text-rendering: optimizeLegibility` declaration.
* Keep all other global typography and theme tokens unchanged.

## Acceptance Criteria

* [ ] `src/index.css` no longer contains those two declarations.
* [ ] Existing frontend tests and lint remain valid for this scoped change.

## Out of Scope

* Changing bundled fonts or font-family fallback order.
* Changing app font-size settings.
* Replacing variable font weights such as `550` or `650`.

## Technical Notes

* Relevant spec context: `.trellis/spec/frontend/index.md`.
