---
title: Registry Contracts
description: Current manifest and artifact policy.
---

The registry contract is intentionally small. Canonical source lives in `packages/react`; generated artifacts should be
derived from tracked source and explicit manifests.

## Source Of Truth

```text
packages/react source + explicit registry manifests -> generated registry artifacts
```

The current active manifest contains 73 items:

| Item type   | Count | Role                                                             |
| ----------- | ----- | ---------------------------------------------------------------- |
| `component` | 52    | Installable reusable React component source.                     |
| `support`   | 9     | Registry-owned token/support modules.                            |
| `theme`     | 12    | Default theme CSS plus narrow compatibility/theme support files. |

The component graph includes controls, overlays, table/filtering/query support, typeahead controls, thumbnail fallback,
loaders, and `SortAndFilterPanel`.

## Manifest Shape

Each registry item declares:

| Field                  | Purpose                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| `name`                 | Stable registry item id.                                                                |
| `type`                 | `component`, `support`, `style`, `theme`, `asset`, or `test`.                           |
| `sourcePackage`        | Owning package, currently `@amino-ui/react`.                                            |
| `files`                | Explicit source file entries.                                                           |
| `registryDependencies` | Other registry items that install before this item.                                     |
| `peerDependencies`     | Consumer-owned peer packages.                                                           |
| `runtimeDependencies`  | Runtime packages the CLI or generated metadata may need to add or validate.             |
| `devDependencies`      | Test or build dependencies for optional generated verification and consumer test files. |

Each file entry declares:

| Field        | Purpose                                                                                 |
| ------------ | --------------------------------------------------------------------------------------- |
| `sourcePath` | Tracked source path relative to the repository root.                                    |
| `targetRole` | Semantic consumer bucket, such as `components`, `tokens`, `utils`, `types`, or `theme`. |
| `targetPath` | Path relative to the consumer's chosen root for that target role.                       |
| `role`       | File role, such as `source`, `style`, `test`, `theme`, `support`, or `asset`.           |

The role-based target shape lets a later CLI support more than one consumer layout. A default layout can place support
files in a contained registry directory, while a more integrated layout can map tokens, utilities, types, and components
into existing project conventions.

## Activation Flow

Registry activation is the point where received source becomes installable. Do not activate a component because an ingest
packet exists; activate it when the package source and proof surface are ready.

1. Confirm tracked source exists under `packages/react` and package-facing exports are explicit.
2. Add manifest items for the component, support, theme, asset, or test files that should be installable.
3. Declare `registryDependencies` for every support/theme/component item that must install first.
4. Declare peer, runtime, and dev dependency metadata needed by the installed source.
5. Run the registry manifest and graph checks.
6. Refresh local registry snapshots from the manifest.
7. Run local snapshot verification and CLI tests that consume the snapshot.
8. Record fixture evidence before relying on strict consumer writes.
9. Use Wavemap reinstall proof only after the fixture evidence proves the registry item can be resolved and compiled.

Activation does not publish a package, host a public registry, write generated token files, or mutate a consumer project.
It only makes the graph available to local registry planning and strict add behavior.

## Dependency Contract

Dependency metadata is split by responsibility:

| Field                  | Responsibility                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `registryDependencies` | Other registry items that must be installed first, such as theme CSS, tokens, or base controls.  |
| `peerDependencies`     | Packages the consumer project must provide, such as React, React DOM, or React Aria Components.  |
| `runtimeDependencies`  | Packages required by installed source at runtime, such as `classnames`, `date-fns`, or `motion`. |
| `devDependencies`      | Optional test/build dependencies for future generated verification or consumer test material.    |

The manifest does not run a package manager. The CLI reads these maps and classifies the target consumer package as
`satisfied`, `missing`, `incompatible`, or `unresolved`. Strict local-registry add currently requires non-optional
dependency decisions to be satisfied before source files are written.

This keeps dependency handling reviewable: registry metadata says what source needs, consumer package metadata says what
is already available, and command mode decides whether to report or block.

## Graph Planner

`packages/react` includes a read-only registry graph planner. It resolves requested registry items into dependency-first
order and reports issues for:

- Missing requested items.
- Duplicate manifest item names.
- Missing registry dependencies.
- Registry dependency cycles.
- Duplicate file targets.

The planner does not generate artifacts, mutate consumer projects, install packages, or define update behavior.

`pnpm -F @amino-ui/react check:registry-graph` smoke-tests the active manifest by resolving the graph and reading each
tracked source file that would feed a future generated artifact.

`pnpm -F @amino-ui/react check:local-registry-snapshot` verifies that the support/theme subset and full local React
snapshot still match the active React manifest. The JSON snapshots are tracked for local CLI planning only; public
registry hosting remains a later artifact pass.

## Artifact Policy

`public/registry` should be treated as generated build output unless a later release or deployment policy deliberately
chooses to track generated artifacts.

The current web app still has legacy registry code. Do not treat it as authoritative for future source ownership.

## Consumer Planning

The CLI consumes local snapshots derived from this manifest for `add --advisory`, `add --dry-run`, and strict
single-component local registry installs. Strict writes preserve existing local modifications and unknown targets by
default.

During planning, each manifest file becomes an install-plan file with:

- source availability and source content hash;
- target path resolved from the consumer layout;
- target status and target content hash when a file already exists;
- target resolution: write, reuse existing, or block existing;
- findings such as missing source, duplicate target, or existing target blockers.

Strict add writes only files whose target resolution is `write`. Compatible existing support files can be reused only
when lockfile metadata proves the existing target still matches recorded provenance.
