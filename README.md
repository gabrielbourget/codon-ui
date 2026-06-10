# Codon UI

Codon UI is being renovated into the canonical component-library and registry source for reusable React UI. The current
branch is foundation work: package-manager alignment, shared tooling, CI, a React source receiver, default theme CSS,
registry manifest contracts, receiver support tokens, and documentation.

No Wavemap component source has moved into this repository yet.

## Workspace

This repo is a `pnpm` monorepo.

| Path                    | Purpose                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/docs`             | Astro/Starlight documentation site for repo guidance and roadmap-facing docs.                                            |
| `apps/web`              | Existing Next app and legacy registry web surface. Registry artifact policy is still unresolved.                         |
| `packages/CLI`          | Private `@codon-ui/cli` package with the `codon-ui` bin. Strict install/update/diff behavior is not proof-ready yet.     |
| `packages/react`        | Private `@codon-ui/react` source receiver package. It owns `theme.css`, internal support tokens, and registry manifests. |
| `packages/shared-utils` | Shared ESLint, Prettier, Stylelint, and TypeScript presets.                                                              |

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
pnpm -F @codon-ui/docs build
```

## Current Boundaries

- `@codon-ui/react/theme.css` is hand-authored and intentionally narrow.
- React, React DOM, and React Aria Components are current `@codon-ui/react` peers.
- `Switch` is the first received component source slice under `packages/react/src/components/Switch`.
- Registry manifests have real support entries and an active `switch` component entry.
- `Switch` still waits on strict CLI install behavior, lockfile writes, focused test harness work, and the Wavemap
  delete-and-rehydrate proof.

## Guardrails

Do not treat this foundation branch as approval to move additional components, expand CLI install behavior, publish
packages, add generated token writers, or decide deployment/release automation. Use `AGENTS.md` and the roadmap docs under
`docs/roadmaps` before opening follow-up implementation passes.
