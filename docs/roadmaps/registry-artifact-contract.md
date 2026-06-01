# Registry Artifact Contract

## Purpose

The registry should publish installable source slices that are generated from canonical Amino UI source, not from generated
output directories or broad directory copies.

This contract defines the target shape before `Switch` or any other Wavemap component source moves into the monorepo.

## Current Status

`packages/react` now owns the starter registry contract:

- `src/registry/manifest.ts` is the canonical manifest receiver for React package source.
- `src/registry/types.ts` defines item types, file roles, target roles, dependency maps, and manifest file entries.
- `src/registry/graph.ts` resolves requested registry items into dependency-first install order and reports graph issues
  without throwing.
- `verify-registry-manifest.mjs` checks source file existence, supported domains, dependency references, dependency
  cycles, and duplicate file targets.
- `verify-registry-graph.ts` smoke-tests the active manifest by resolving the graph and reading the local source files
  that would feed generated artifacts.
- `verify-local-registry-snapshot.ts` checks the tracked CLI local support registry snapshot against the canonical React
  manifest so early advisory planning cannot silently drift.

The current web app registry code is legacy scaffold and should not be treated as authoritative.

Current reads:

- `apps/web/registry` owns the existing builder, schemas, helper files, and component registry list.
- The builder writes JSON artifacts under `apps/web/public/registry`.
- `apps/web` still couples `build` to registry generation through `pnpm build:registry`.
- The current package script references `./scripts/build-registry.ts`, while the tracked builder lives at
  `registry/buildRegistry.ts`.
- The builder reads component directories and helper files from the web app registry tree rather than from
  `packages/react`.
- The CLI currently fetches registry artifacts, but install/update/diff behavior is not proof-ready.

Current active React manifest entries are support-only:

- `theme-css`
- `theme/switch-compatibility`
- `tokens/geometry`
- `tokens/theme-order`

No component manifest entry is active yet.

## Source Of Truth

The target source of truth is:

```text
packages/react source + explicit registry manifests -> generated registry artifacts
```

Canonical source should live in `packages/react`:

- Component source under `packages/react/src`.
- Package default CSS at `packages/react/theme.css`.
- Component-local styles, helpers, constants, tests, and types beside the owning component source when those files become
  real.
- Registry manifests or file lists owned near the React package, not inside generated output.

The registry builder should consume explicit manifests or file lists. It should not infer ownership through broad
directory recursion, generated output directories, or stale web-app registry lists.

The current CLI local support registry at `packages/CLI/registry/local-react-support.registry.json` is a checked-in
snapshot for early advisory planning only. It must match the active React manifest. A later generator pass can replace the
manual snapshot update step, but this pass deliberately adds verification rather than code generation.

## Artifact Policy

`public/registry` should be treated as generated build output, not canonical source.

That means:

- Source files and manifests are reviewed and tracked.
- Generated registry artifacts are reproducible from tracked source and manifests.
- The web app may generate artifacts during its build when the serving strategy requires static public files.
- Tracking generated artifacts should remain a separate deployment or release-policy decision.

The first component proof should not depend on committed generated artifacts unless a deliberate hosting or review
workflow requires that tradeoff.

## Producer MVP Contract

The producer side should stay small until the first component receipt proves the source graph:

1. Source and manifests live under `packages/react`.
2. Manifest items declare every file they own.
3. File entries use `targetRole` plus `targetPath`, so a consumer layout can decide where roles such as components,
   tokens, utilities, types, theme files, and assets land.
4. The graph planner orders requested items after their registry dependencies.
5. The graph planner reports missing items, duplicate items, missing registry dependencies, dependency cycles, and
   duplicate file targets as structured issues.
6. Artifact generation remains a later step that consumes this canonical contract.

This gives the CLI and future builder enough shape to discuss consumer layouts without hard-coding a single physical
directory convention too early.

## Minimum Manifest Shape

The first manifest shape should be small and explicit:

| Field                  | Purpose                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `name`                 | Stable registry item id, such as `switch`.                                                    |
| `type`                 | Item category, currently `component`, `support`, `style`, `theme`, `asset`, or `test`.        |
| `sourcePackage`        | Owning package, initially `@amino-ui/react`.                                                  |
| `files`                | Explicit ordered source file entries.                                                         |
| `registryDependencies` | Other registry items that must install before this item.                                      |
| `peerDependencies`     | Consumer-owned peers required by installed source.                                            |
| `runtimeDependencies`  | Runtime packages the generated install metadata may need to add or validate.                  |
| `devDependencies`      | Test or build dependencies needed only for generated verification or optional consumer tests. |

Each file entry should include:

| Field        | Purpose                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------- |
| `sourcePath` | Tracked source file relative to the repo root.                                              |
| `targetRole` | Semantic installation bucket, such as `components`, `tokens`, `utils`, `types`, or `theme`. |
| `targetPath` | Suggested install path relative to the consumer's chosen root for that target role.         |
| `role`       | File role, such as `source`, `style`, `test`, `theme`, `support`, or `asset`.               |

Generated artifacts may add content, hashes, provenance, and version metadata, but those values should be derived from the
tracked manifest and source files.

## First Proof Minimum

Before moving `Switch`, the registry contract needs only enough shape to express:

- The `Switch` component source graph.
- Any component-local style files.
- Registry-owned support files such as theme-order or corner-geometry constants if they remain needed.
- `@amino-ui/react/theme.css` as the package default theme contract.
- The narrow `theme/switch-compatibility` bridge while `Switch` still needs Wavemap compatibility aliases.
- React and React DOM as peer dependencies.
- React Aria Components as a first-proof peer dependency and `classnames` as a first-proof runtime dependency when
  `Switch` source is received.

The first proof does not need:

- CLI install/update/diff behavior.
- Ejection policy.
- Publication or release automation.
- Generated token writers.
- Broad registry generation rewrites.
- A full replacement for every legacy `apps/web/registry` helper.

## Web App Boundary

`apps/web` may serve generated artifacts, but it should not own canonical React component source.

The eventual builder can live in the web app, a package, or a dedicated registry package. That location is less important
than preserving the data flow:

```text
tracked package source and manifests -> generated JSON artifacts -> web serving or CLI fetching
```

The current `apps/web` build coupling should be revisited when the builder is renovated. Do not expand CLI behavior to
compensate for unclear artifact ownership.

## Stop Conditions

Return to deliberate planning if implementation requires:

- Moving Wavemap component source.
- Installing new dependencies.
- Changing lockfiles.
- Rewriting CLI install, update, diff, status, or ejection behavior.
- Deciding package publication or release automation.
- Mutating deployment workflows.
- Committing generated registry output as policy.
- Redesigning every legacy registry helper at once.

## Verification Expectations

For contract-only changes:

- `pnpm check`
- `git diff --check`

For manifest or builder implementation changes:

- `pnpm check`
- `pnpm -F @amino-ui/react check:registry-manifest`
- `pnpm -F @amino-ui/react check:registry-graph`
- `pnpm -F @amino-ui/react check:local-registry-snapshot`
- Focused package builds for touched packages.
- A registry artifact smoke check once the builder is renovated enough to be trusted.
- `git diff --check`
