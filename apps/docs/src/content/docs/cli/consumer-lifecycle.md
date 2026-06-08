---
title: Consumer Lifecycle
description: Config, lockfile, planning modes, and preservation defaults.
---

The CLI lifecycle is evidence-gated. Advisory and dry-run output must prove a write shape before strict commands mutate a
consumer project.

## Consumer Files

| File                   | Owner     | Purpose                                                                                  |
| ---------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `amino-ui.config.json` | Human     | Setup intent: layout mode, role paths, registry source, theme tier, dependency policy.   |
| `amino-ui.lock.json`   | Generated | Install provenance: item graph, file hashes, ownership states, and dependency decisions. |

Strict init writes only these two files when they are absent. It does not install packages, create component directories,
write support files, or touch package-manager lockfiles.

## `init` Flow

`init` has two new-contract paths:

```sh
aui init --advisory --json --cwd <consumer-project>
aui init --defaults --json --cwd <consumer-project>
```

`init --advisory` reads project shape and reports the proposed config without writing. It classifies the package manager,
project kind, config presence, lockfile presence, default role paths, theme tier, and dependency policy.

`init --defaults` is the strict seed path. It writes `amino-ui.config.json` and an empty `amino-ui.lock.json` only when
both are absent. Existing config or lockfile files are warnings and block writes for that seed operation.

## Layout And Roles

The modeled layout modes are `registry-contained`, `integrated`, and `custom`. Only `registry-contained` currently has
path resolution behavior.

Default `registry-contained` paths are:

| Role         | Default path                      |
| ------------ | --------------------------------- |
| `components` | `src/components`                  |
| `theme`      | `src/components/_registry`        |
| `tokens`     | `src/components/_registry/tokens` |
| `utils`      | `src/components/_registry/utils`  |
| `types`      | `src/components/_registry/types`  |
| `assets`     | `src/components/_registry/assets` |

## Planning Modes

| Mode         | Mutates files | Purpose                                                                                  |
| ------------ | ------------- | ---------------------------------------------------------------------------------------- |
| `--advisory` | No            | Non-blocking diagnostics and install planning. Expected findings do not fail the run.    |
| `--dry-run`  | No            | Preview an intended mutation, including blockers, dependency counts, and lockfile shape. |
| Strict add   | Yes           | Write a single local React registry component graph when blockers are absent.            |

Strict add requires config and lockfile files, satisfied dependency declarations, available source files, and no unsafe
target collisions. It may reuse existing support files only when lockfile metadata proves the target is compatible.

## `add` Planning Flow

`add` resolves a registry graph before it thinks about writes:

```sh
aui add <component> --advisory --json --cwd <consumer-project>
aui add <component> --dry-run --json --cwd <consumer-project>
aui add <component> --json --cwd <consumer-project>
```

The local-registry path currently handles explicit single-component strict adds. Advisory and dry-run can also report
non-mutating plans for requested local registry items.

The planner:

1. Chooses the local registry snapshot for the request.
2. Reads matching ingest packet metadata when available.
3. Resolves registry dependencies in dependency-first order.
4. Resolves each file target through the consumer layout.
5. Reads source files and computes `sha256:<hex>` source hashes.
6. Reads existing target files and computes target hashes when targets exist.
7. Classifies consumer package dependencies.
8. Produces findings and mode-specific effects.

## Dependency Handling

The CLI treats dependency handling as classification first. It reads the consumer `package.json` and compares declared
ranges against manifest requirements.

| Status         | Meaning                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| `satisfied`    | Consumer already declares a compatible dependency range.                                   |
| `missing`      | Manifest requires a dependency that the consumer does not declare.                         |
| `incompatible` | Consumer declares the dependency, but the declared range does not satisfy the requirement. |
| `unresolved`   | The CLI could not make a confident range decision.                                         |

Strict add does not install, update, or remove packages. It blocks when required dependency decisions are not satisfied.
When strict add succeeds, the lockfile records satisfied dependency decisions with action `none`.

## Source Write Flow

Strict add applies the same plan only after blockers are cleared:

1. Read and validate `amino-ui.config.json`.
2. Read and validate `amino-ui.lock.json`.
3. Recompute the install plan from the current snapshot and consumer state.
4. Reuse compatible existing support files only when lockfile metadata proves they are reusable.
5. Block missing sources, missing/incompatible dependencies, unsafe existing targets, and invalid config/lockfile state.
6. Write planned source/support/theme files.
7. Rewrite relative imports so package-local imports point at installed consumer paths.
8. Write updated lockfile item/file hashes, ownership states, registry dependencies, dependency decisions, and theme tier.

Unknown existing targets are blockers by default. Locally modified, consumer-owned-support, and ejected ownership states
are preservation signals for future lifecycle commands.

## Status Inspection

`status --json` is the first read-only lifecycle inspection command:

```sh
aui status --json --cwd <consumer-project>
aui status <item> --json --cwd <consumer-project>
```

It reads config, lockfile provenance, installed files, and local registry source. It does not write source files, config,
lockfile, package metadata, or package-manager lockfiles.

The JSON report includes:

| Field            | Meaning                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| `config`         | Config path and whether it is `present`, `missing`, or `invalid`.                      |
| `lockfile`       | Lockfile path, parse status, and recorded item count.                                  |
| `registrySource` | Loaded local registry source used for source freshness checks, or why none was loaded. |
| `items`          | Installed lockfile items with aggregate file state and source freshness.               |
| `files`          | Per-file current hash, installed hash, source hash, ownership state, and source state. |
| `dependencies`   | Recorded dependency decisions from the lockfile; no package-manager mutation is run.   |
| `summary`        | Counts by file state, source state, dependency status, item count, and file count.     |
| `findings`       | Missing or invalid config/lockfile and registry-source warnings.                       |

Current fixture evidence proves greenfield/uninitialized status, clean installed `circle-loader` status, locally modified
installed-file status, `consumer-owned-support`, `unknown`, `missing`, `ejected`, missing dependency posture, and stale
source-hash/source-drift classification.

## Diff Inspection

`diff --json` is the focused read-only comparison command:

```sh
aui diff <item> --json --cwd <consumer-project>
```

It uses the same config, lockfile, installed-file, and registry-source classification model as `status --json`, then
returns one item-scoped report. It does not write source files, config, lockfile, package metadata, or package-manager
lockfiles.

The JSON report includes:

| Field            | Meaning                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `itemName`       | Requested lockfile item.                                                                      |
| `item`           | Aggregate item state when the item exists in the lockfile.                                    |
| `registrySource` | Loaded local registry source used for current source comparison.                              |
| `files`          | Per-file hash state, ownership state, source freshness, comparison, recommendation, and diff. |
| `dependencies`   | Recorded lockfile dependency decisions; no package-manager mutation is run.                   |
| `effects`        | Always reports no config, lockfile, source-file, or dependency writes for this mode.          |
| `summary`        | Counts by comparison state, recommendation, review need, source changes, and local changes.   |
| `findings`       | Missing item/config/lockfile/registry-source warnings from the status model.                  |

Per-file `comparison` values are preservation oriented:

| Comparison                              | Default stance                                      |
| --------------------------------------- | --------------------------------------------------- |
| `no-change`                             | No review required.                                 |
| `source-changed`                        | Review registry source change.                      |
| `local-modification`                    | Preserve the consumer edit by default.              |
| `local-and-source-changed`              | Review both consumer edit and registry change.      |
| `missing-local-file`                    | Preserve the absence until a strict command exists. |
| `unknown-ownership`                     | Preserve and require explicit review.               |
| `consumer-owned-support`                | Preserve consumer ownership by default.             |
| `consumer-owned-support-source-changed` | Preserve and review upstream support change.        |
| `ejected`                               | Preserve and never auto-update.                     |
| `source-unavailable`                    | Inspect registry source before planning writes.     |

When both the current registry source file and local consumer file exist and differ, `sourceToLocalDiff` contains
line-oriented `registry-source`, `consumer-local`, and `context` segments. This is a review aid only; it is not an update
or merge plan.

Current fixture evidence proves clean installed diff, locally modified diff, missing local file diff, unknown ownership
diff, consumer-owned support diff, ejected diff, missing dependency posture, and stale source-hash classification.

## Update Advisory

`update --advisory --json` is the first update command, and it is intentionally read-only:

```sh
aui update <item> --advisory --json --cwd <consumer-project>
```

It uses the focused `diff --json` report as input and translates each file into an update advisory action. It does not
write source files, config, lockfile, package metadata, or package-manager lockfiles.

The JSON report includes:

| Field             | Meaning                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `itemName`        | Requested lockfile item.                                                                                     |
| `itemUpdateState` | Aggregate state: `up-to-date`, `update-candidate`, `review-required`, or `unavailable`.                      |
| `files`           | Per-file ownership/source state, diff comparison, advisory action, and preservation posture.                 |
| `dependencies`    | Recorded lockfile dependency decisions; no package-manager mutation is run.                                  |
| `effects`         | Always reports no config, lockfile, source-file, or dependency writes for this mode.                         |
| `summary`         | Counts by advisory action, candidates, blockers, preservation, review, source change, and dependency status. |
| `findings`        | Missing item/config/lockfile/registry-source warnings from the status/diff model.                            |

Per-file `action` values are:

| Action                            | Meaning                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `none`                            | File is up to date or has no advisory update action.                |
| `update-candidate`                | Pristine registry-owned file has a current registry source change.  |
| `preserve-local-change`           | Consumer local edit must be preserved.                              |
| `review-local-and-source-change`  | Consumer local edit and registry source both changed.               |
| `preserve-missing-file`           | Missing local file is preserved until dry-run/strict policy exists. |
| `preserve-unknown`                | Unknown ownership is preserved and blocks automatic update.         |
| `preserve-consumer-owned-support` | Consumer-owned support is preserved and blocks automatic update.    |
| `preserve-ejected`                | Ejected file is preserved and blocks automatic update.              |
| `inspect-source`                  | Registry source freshness is unavailable.                           |

`update-candidate` is advisory only. Exact file and lockfile previews belong to `update --dry-run --json`; strict update
writes remain deferred.

Current fixture evidence proves clean installed update advisory, locally modified update advisory, missing local file
advisory, unknown ownership advisory, consumer-owned support advisory, ejected advisory, missing dependency posture, and
stale source-hash classification.

## Update Dry Run

`update --dry-run --json` previews an item-scoped update without writing:

```sh
aui update <item> --dry-run --json --cwd <consumer-project>
```

It starts from the `update --advisory` classification, then recomputes the current local-registry install plan for the
requested item. For update candidates, it reads the current source file, applies the same relative-import rewrite logic as
strict add, and reports the planned `nextSourceHash` and `nextInstalledHash`. This lets fixtures distinguish source-file
writes from lockfile-only hash refreshes.

The JSON report includes:

| Field             | Meaning                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| `itemUpdateState` | Aggregate state: `up-to-date`, `would-update`, `blocked`, or `unavailable`.                                       |
| `files`           | Per-file advisory action, dry-run action, planned hashes, blocker codes, and write/lockfile booleans.             |
| `dependencies`    | Current registry dependency plan from the consumer `package.json`; no package-manager mutation is run.            |
| `effects`         | Actual effects. These always report no config, source-file, lockfile, or dependency writes.                       |
| `wouldEffects`    | Planned write preview: source-file count, lockfile status, skipped files, blocked files, and dependency blockers. |
| `blockers`        | Item, file, source, project, and dependency blockers that would prevent strict update.                            |
| `summary`         | Counts for candidates, would-write files, lockfile file updates, skipped files, blockers, and dependency states.  |

Per-file `dryRunAction` values are:

| Dry-run action          | Meaning                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `none`                  | No update is needed for the file.                                                                     |
| `would-write`           | A future strict update would write the source file and lockfile record.                               |
| `would-update-lockfile` | File content already matches the current planned install hash; only the lockfile record would change. |
| `would-skip`            | The file is preservation-sensitive and would be skipped.                                              |
| `blocked`               | The file is a candidate, but item, project, source, or dependency blockers prevent strict update.     |

Dry-run preserves the same defaults as advisory mode. If any file in the requested item is locally modified, missing,
unknown, consumer-owned support, or ejected, the item state is `blocked`; update candidates remain visible with planned
hashes when possible, but `wouldWriteFile` and `wouldWriteLockfile` stay false until blockers are resolved.

Current fixture evidence proves clean installed update dry-run, eligible source update preview, locally modified
preservation, mixed classification preservation, ejected preservation, consumer-owned support preservation, and missing
dependency blocking.

## Remove Advisory

`remove --advisory --json` is the first remove command, and it is intentionally read-only:

```sh
aui remove <item> --advisory --json --cwd <consumer-project>
```

It starts from `status --json` classification and reports what a future remove flow would need to consider. It does not
delete source files, write config, write lockfile data, change package metadata, remove dependencies, or touch
package-manager lockfiles.

The JSON report includes:

| Field             | Meaning                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `itemRemoveState` | Aggregate state: `remove-candidate`, `lockfile-cleanup-candidate`, `review-required`, or `unavailable`.                 |
| `files`           | Per-file ownership/source state, advisory action, removal target, preservation posture, and shared references.          |
| `dependencies`    | Recorded lockfile dependency decisions; no package-manager mutation is run.                                             |
| `effects`         | Always reports no config, lockfile, source-file, or dependency writes for this mode.                                    |
| `summary`         | Counts for removable files, lockfile cleanup candidates, blockers, preservation, support review, and shared references. |
| `findings`        | Missing item/config/lockfile/registry-source warnings from the status model.                                            |

Per-file `action` values are:

| Action                            | Meaning                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `remove-candidate`                | Registry-owned component file is present locally and not shared with another item.       |
| `lockfile-cleanup-candidate`      | Registry-owned component file is already missing; future remove may only clean metadata. |
| `review-support-file`             | Non-component support target needs orphan/shared ownership review before removal.        |
| `review-shared-file`              | Another lockfile item references the same path, so automatic file deletion is blocked.   |
| `preserve-local-change`           | Consumer local edit must be preserved.                                                   |
| `preserve-consumer-owned-support` | Consumer-owned support is preserved and blocks automatic removal.                        |
| `preserve-unknown`                | Unknown ownership is preserved and blocks automatic removal.                             |
| `preserve-ejected`                | Ejected file is preserved and blocks automatic removal.                                  |

Remove advisory is conservative around support files. It does not decide package dependency removal, support orphan
deletion, source-file deletion, lockfile writes, or aliases such as `delete`. Those belong to later dry-run/strict slices
after fixture evidence proves the preservation rules.

Current fixture evidence proves clean installed remove advisory, locally modified preservation, missing local file
lockfile-cleanup posture, unknown ownership preservation, consumer-owned support preservation, ejected preservation,
missing dependency posture, and stale source-hash classification.

## Ownership States

| State                    | Meaning                                                                    | Default CLI stance                                                                      |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `registry-owned`         | Installed file still belongs to the registry graph.                        | Eligible for future automated update/remove only after proven lifecycle commands exist. |
| `locally-modified`       | Installed file differs from recorded provenance.                           | Preserve by default; report for manual review.                                          |
| `consumer-owned-support` | Consumer intentionally owns compatible support at the planned target path. | Reuse or validate; do not overwrite by default.                                         |
| `ejected`                | Consumer intentionally took ownership of the file or component slice.      | Preserve by default; never auto-update.                                                 |
| `unknown`                | A target exists without trusted Amino provenance.                          | Treat as a blocker for strict writes.                                                   |

## Deferred Lifecycle Commands

The next lifecycle work should add remove dry-run and eject advisory behavior without weakening the preservation defaults
above. Strict update and strict remove remain deferred until dry-run evidence is broader and intentionally approved.

Generated token writers, strict update/eject mutation, public registry hosting, package publication, and Waveguide
validation remain deferred until explicitly approved.
