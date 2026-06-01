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

The current active manifest entries are:

| Item                         | Role                                |
| ---------------------------- | ----------------------------------- |
| `theme-css`                  | Package default CSS support.        |
| `theme/switch-compatibility` | Narrow first-proof `Switch` bridge. |
| `tokens/geometry`            | Corner geometry token support.      |
| `tokens/theme-order`         | Theme-order token support.          |
| `switch`                     | Received first-proof component.     |

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

`pnpm -F @amino-ui/react check:local-registry-snapshot` verifies that
`packages/CLI/registry/local-react-support.registry.json` still matches the support/theme subset of the active React
manifest. The JSON snapshot is tracked for early advisory planning only; code generation remains a later
registry-artifact pass.

## Artifact Policy

`public/registry` should be treated as generated build output unless a later release or deployment policy deliberately
chooses to track generated artifacts.

The current web app still has legacy registry code. Do not treat it as authoritative for future source ownership.

## Future First Proof

The first `Switch` proof should depend on explicit file lists or manifest entries. It should not rely on broad directory
copies, generated output directories, or CLI behavior that has not been proven.
