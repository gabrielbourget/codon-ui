---
title: Monorepo Layout
description: Workspace ownership boundaries in Codon UI.
---

Codon UI uses `pnpm` workspaces. Treat each workspace as an ownership boundary, not as a loose directory convention.

| Workspace               | Owner surface                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/docs`             | Static documentation site for the monorepo and curated roadmap guidance.                                        |
| `apps/web`              | Existing Next app and legacy registry web surface.                                                              |
| `packages/CLI`          | Private `@codon-ui/cli` package with the canonical `codon-ui` bin plus `cui` and `codonui` aliases.             |
| `packages/react`        | Private React source receiver package and current home for default CSS, support tokens, and registry manifests. |
| `packages/shared-utils` | Shared ESLint, Prettier, Stylelint, and TypeScript presets.                                                     |

## Current Branch Purpose

The renovation branch establishes Codon UI as the local source receiver and registry planner for extracted reusable
components. `packages/react` owns reusable source; `packages/CLI` owns consumer planning and install behavior; `apps/docs`
owns durable reference material.

## Deliberately Deferred

- Registry artifact builder rewrites and public hosting.
- CLI update, remove/delete, focused diff, and ejection behavior.
- Generated token writers or palette generation.
- Publication, release, or deployment automation.
