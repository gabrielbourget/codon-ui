---
title: Local Snapshots
description: Checked-in registry snapshots for CLI planning before public hosting.
---

Local registry snapshots are checked-in JSON sources consumed by the CLI while registry hosting and artifact generation
remain deferred.

## Snapshot Files

| File                                                      | Role                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/CLI/registry/local-react.registry.json`         | Full React registry snapshot for component, support, and theme planning.        |
| `packages/CLI/registry/local-react-support.registry.json` | Support/theme subset used by support-only `add --all --advisory` planning.      |
| `packages/react/local-registry-snapshot.ts`               | Typed package-side snapshot data used by verification.                          |
| `packages/react/generate-local-registry-snapshot.ts`      | Generator for refreshing CLI snapshots from the canonical React manifest.       |
| `packages/react/verify-local-registry-snapshot.ts`        | Contract check that prevents snapshot drift from `packages/react/src/registry`. |

The snapshots are proof inputs, not public registry artifacts. They should match the canonical manifest and tracked
source files.

## Generation Flow

```text
packages/react/src/registry/manifest.ts
  -> packages/react/generate-local-registry-snapshot.ts
  -> packages/CLI/registry/local-react*.registry.json
  -> packages/react/verify-local-registry-snapshot.ts
```

The snapshot generator materializes manifest-shaped data for the CLI. The verifier checks that the checked-in JSON still
matches the canonical manifest, including the support-only subset. Snapshot drift means the CLI may be planning from
older source graph metadata.

## Refresh Checklist

When the active manifest changes:

- [ ] Update `packages/react/src/registry/manifest.ts` and keep source paths tracked.
- [ ] Generate or update `packages/CLI/registry/local-react.registry.json`.
- [ ] Generate or update `packages/CLI/registry/local-react-support.registry.json` when support/theme entries change.
- [ ] Keep `packages/react/local-registry-snapshot.ts` aligned with the generated JSON.
- [ ] Run `pnpm -F @codon-ui/react check:local-registry-snapshot`.
- [ ] Run CLI tests that parse the local snapshots.
- [ ] Add or refresh fixture evidence for the command paths that consume the changed snapshot data.

Do not edit snapshot JSON as though it were canonical source. If snapshot data disagrees with the manifest, fix the
manifest or refresh path first.

## Source Of Truth

`packages/react/src/registry/manifest.ts` is canonical. Snapshot JSON must be regenerated or updated from that manifest,
then checked with:

```sh
pnpm -F @codon-ui/react check:local-registry-snapshot
```

That check verifies both the support subset and the full React snapshot. If it fails, the CLI may be planning from stale
registry data.

## CLI Use

`add --advisory`, `add --dry-run`, and strict local-registry `add <component>` can read the full snapshot when an
explicit local React component is requested. `remove` and `delete --with-orphans` advisory/dry-run reports also read the
full snapshot so dependency cleanup planning can map installed lockfile dependency records back to the registry items
that require them. The plan resolver adds source availability, target status, dependency classification, cleanup
classification, and lockfile effects around that snapshot data.

The CLI adds target-specific information that should not live in the canonical manifest:

| Install-plan data    | Computed from                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `resolvedPath`       | Consumer `codon-ui.config.json` layout and role paths.                                               |
| `sourceStatus`       | Whether the manifest `sourcePath` exists under the snapshot source root.                             |
| `contentHash`        | The current source file bytes.                                                                       |
| `targetStatus`       | Whether the resolved consumer target already exists.                                                 |
| `targetContentHash`  | The current consumer target bytes when a target exists.                                              |
| `targetResolution`   | Whether the command would write, reuse existing support, or block the target.                        |
| `dependencyPlan`     | Consumer `package.json` dependency classification.                                                   |
| `dependencyCleanup`  | Remove/delete-only cleanup candidates derived from installed items and registry dependency metadata. |
| `effects.lockfile.*` | Advisory, dry-run, or strict lockfile write status.                                                  |
| `componentPackets`   | Optional review metadata from ingest packets.                                                        |

The snapshots deliberately do not decide public hosting, generated artifact shape, package publication, or remote
registry URL behavior.
