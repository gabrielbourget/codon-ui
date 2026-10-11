---
title: Monorepo Layout
description: Workspace ownership boundaries in Codon UI.
---

Codon UI uses `pnpm` workspaces. Treat each workspace as an ownership boundary, not as a loose directory convention.

| Workspace               | Owner surface                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/docs`             | Static documentation site for the monorepo and curated roadmap guidance.                                        |
| `apps/web`              | Existing Next app for web experiments; registry source and manifests live outside this app.                     |
| `packages/CLI`          | Private `@codon-ui/cli` package with the canonical `codon-ui` bin plus `cui` and `codonui` aliases.             |
| `packages/react`        | Private React source receiver package and current home for default CSS, support tokens, and registry manifests. |
| `packages/shared-utils` | Shared ESLint, Prettier, Stylelint, and TypeScript presets.                                                     |

## Current Branch Purpose

The approved native laboratory adds `packages/react-native` as the private native source owner and `apps/native-showcase` as its generic Expo consumer. Native TypeScript/Metro/test configuration belongs to those workspaces. Web registry/CLI and shared tooling ownership remain with their existing packages; the native library has no Expo or web runtime imports. See [React Native Package](/packages/react-native/) and [Native Showcase](/component-library/native-showcase/).

The renovation branch establishes Codon UI as the local source receiver and registry planner for extracted reusable
components. `packages/react` owns reusable source; `packages/CLI` owns consumer planning and install behavior; `apps/docs`
owns durable reference material.

## Deliberately Deferred

- Registry artifact builder rewrites and public hosting.
- CLI update, remove/delete, focused diff, and ejection behavior.
- Generated token writers or palette generation.
- Publication, release, or deployment automation.
