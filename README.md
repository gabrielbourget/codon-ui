# Codon UI

Codon UI is being renovated into the canonical component-library and registry source for reusable React UI. The current
branch has moved through foundation work into private source-distribution prep: package-manager alignment, shared
tooling, CI, a React source package, default theme CSS, registry manifest contracts, receiver support tokens, lifecycle
CLI behavior, and documentation.

## Workspace

This repo is a `pnpm` monorepo.

| Path                    | Purpose                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs`             | Astro/Starlight documentation site for repo guidance and roadmap-facing docs.                                                                                                   |
| `apps/web`              | Existing Next app and legacy registry web surface. Registry artifact policy is still unresolved.                                                                                |
| `packages/CLI`          | Private `@codon-ui/cli` package with the canonical `codon-ui` bin plus `cui` and `codonui` aliases. It owns lifecycle commands and the first CLI-bundled source snapshot proof. |
| `packages/react`        | Private `@codon-ui/react` source package. It owns `theme.css`, component source, support tokens, and registry manifests.                                                        |
| `packages/shared-utils` | Shared ESLint, Prettier, Stylelint, and TypeScript presets.                                                                                                                     |

## Commands

```sh
pnpm install
pnpm check
pnpm verify:ci
pnpm build:react
pnpm build:docs
pnpm dev:docs
```

Focused checks:

```sh
pnpm -F @codon-ui/react check:contracts
pnpm -F @codon-ui/react build
pnpm -F @codon-ui/cli pack:check
pnpm -F @codon-ui/docs build
```

## Current Boundaries

- `@codon-ui/react/theme.css` is hand-authored and intentionally narrow.
- React, React DOM, and React Aria Components are current `@codon-ui/react` peers.
- `@codon-ui/react` is the source identity for the registry graph.
- The first private npm proof keeps `@codon-ui/cli` self-contained by packing generated registry/source assets under
  `dist`.
- The mature split-package model, where `@codon-ui/cli` resolves assets from a published `@codon-ui/react`, remains a
  later contract pass.

## Guardrails

Do not treat this foundation branch as approval to move additional components, expand CLI install behavior, publish
packages, add generated token writers, or decide deployment/release automation. Use `AGENTS.md` and the roadmap docs under
`docs/roadmaps` before opening follow-up implementation passes.
