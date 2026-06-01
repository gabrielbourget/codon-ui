# Amino UI

Amino UI is being renovated into the canonical component-library and registry source for reusable React UI. The current
branch is foundation work: package-manager alignment, shared tooling, CI, a React source receiver, default theme CSS,
registry manifest contracts, receiver support tokens, and documentation.

No Wavemap component source has moved into this repository yet.

## Workspace

This repo is a `pnpm` monorepo.

| Path                    | Purpose                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apps/docs`             | Astro/Starlight documentation site for repo guidance and roadmap-facing docs.                                            |
| `apps/web`              | Existing Next app and legacy registry web surface. Registry artifact policy is still unresolved.                         |
| `packages/CLI`          | Existing CLI package with `aminoui-cli` and `aui` bins. Strict install/update/diff behavior is not proof-ready yet.      |
| `packages/react`        | Private `@amino-ui/react` source receiver package. It owns `theme.css`, internal support tokens, and registry manifests. |
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
pnpm -F @amino-ui/react check:contracts
pnpm -F @amino-ui/react build
pnpm -F @amino-ui/docs build
```

## Current Boundaries

- `@amino-ui/react/theme.css` is hand-authored and intentionally narrow.
- React and React DOM are the only current `@amino-ui/react` peers.
- React Aria Components should be added only when the first received component needs it.
- Registry manifests have real support entries, but no active component entry.
- `Switch` remains the likely first extraction proof candidate, but source movement waits on proof location, dependency
  policy, compatibility bridge shape, public export aliases, and focused test relocation.

## Guardrails

Do not treat this foundation branch as approval to move components, expand CLI install behavior, publish packages, add
generated token writers, or decide deployment/release automation. Use `AGENTS.md` and the roadmap docs under
`docs/roadmaps` before opening follow-up implementation passes.
