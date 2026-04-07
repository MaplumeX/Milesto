# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

This directory contains the project-specific frontend conventions for the current Milesto codebase.
Update these files when the implementation patterns change.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Project-specific |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Project-specific |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Project-specific |
| [State Management](./state-management.md) | Local state, global state, server state | Project-specific |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Project-specific |
| [Type Safety](./type-safety.md) | Type patterns, validation | Project-specific |

---

## How to Maintain These Guidelines

When you touch frontend architecture or establish a new convention:

1. Document the **current implementation reality**, not the aspirational target state
2. Keep at least 2-3 real code examples from the repo
3. Record forbidden patterns and common mistakes
4. Update the affected file in the same task that introduced the change

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**Language**: All documentation should be written in **English**.
