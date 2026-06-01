---
title: Monorepo Layout
description: Workspace ownership boundaries in Amino UI.
---

Amino UI uses `pnpm` workspaces. Treat each workspace as an ownership boundary, not as a loose directory convention.

| Workspace               | Owner surface                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/docs`             | Static documentation site for the monorepo and curated roadmap guidance.                                        |
| `apps/web`              | Existing Next app and legacy registry web surface.                                                              |
| `packages/CLI`          | Existing CLI package with `aminoui-cli` and `aui` bins.                                                         |
| `packages/react`        | Private React source receiver package and current home for default CSS, support tokens, and registry manifests. |
| `packages/shared-utils` | Shared ESLint, Prettier, Stylelint, and TypeScript presets.                                                     |

## Current Branch Purpose

The renovation branch establishes structure and verification before component extraction starts. It should be reviewable
as monorepo foundation work, not as a component migration.

## Deliberately Deferred

- Component source movement.
- Registry artifact builder rewrites.
- CLI install, update, diff, status, or ejection behavior.
- Generated token writers or palette generation.
- Publication, release, or deployment automation.
