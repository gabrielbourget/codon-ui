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
aui init --dry-run --json --cwd <consumer-project>
aui init --defaults --json --cwd <consumer-project>
```

`init --advisory` reads project shape and reports the proposed config without writing. It classifies the package manager,
project kind, config presence, lockfile presence, default role paths, theme tier, and dependency policy.

`init --dry-run` previews the strict default seed without writing. It reports actual no-write effects plus separate
`wouldEffects` for config and lockfile creation. Greenfield consumers report `would-write` for both files; existing config
or lockfile files report blockers and prevent partial seed previews.

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

| Mode          | Mutates files | Purpose                                                                                  |
| ------------- | ------------- | ---------------------------------------------------------------------------------------- |
| `--advisory`  | No            | Non-blocking diagnostics and install planning. Expected findings do not fail the run.    |
| `--dry-run`   | No            | Preview an intended mutation, including blockers, dependency counts, and lockfile shape. |
| Strict add    | Yes           | Write a single local React registry component graph when blockers are absent.            |
| Strict update | Yes           | Write only dry-run-approved source files and lockfile records.                           |
| Strict remove | Yes           | Delete only dry-run-approved registry-owned component files and lockfile records.        |
| Strict eject  | Yes           | Write only dry-run-approved lockfile ownership records; source files stay untouched.     |

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

Strict add blocks when required dependency decisions are not satisfied, unless the command has explicit dependency-install
approval. Without package-manager execution, a successful strict add records satisfied dependency decisions with action
`none`. When strict add installs dependencies first, the lockfile records those dependency decisions with action
`installed`.

Dependency install policy is now explicit in `dependencyInstallPlan.dependencyPolicy`.

| Policy        | Current behavior                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| `report-only` | Default. Report dependency posture and proposed commands without package-manager execution.             |
| `manual`      | Report that the consumer intends to resolve dependencies outside the CLI; no package-manager execution. |
| `prompt`      | Parsed and reported as future policy intent; no prompting or package-manager execution yet.             |
| `install`     | Allows strict add to execute dependencies only with explicit `--install-dependencies` command intent.   |

Policy source is also reported. `source: "default"` means the planner used the default `report-only` fallback,
`source: "config"` means it read `amino-ui.config.json`, and `source: "cli-option"` means `--dependency-policy` overrode
the config/default value. Advisory and dry-run reports keep `packageManagerExecution: "not-run"` and
`packageManagerWrites: false`; strict add can report `packageManagerExecution: "completed"` and
`packageManagerWrites: true` only after an approved package-manager command completes. If an approved command fails,
strict add reports `packageManagerExecution: "failed"` and `dependencyInstallPlan.status: "failed"` with a
`failedCommands` record instead of falling through to an unstructured process error.

Dependency execution eligibility is reported separately in `dependencyInstallPlan.executionPlan`. `--install-dependencies`
records explicit command intent, but `--yes` is not treated as dependency-install approval. The current planner reports
`mode: "eligible"` only when explicit install intent combines with effective policy `install` and a known package-manager
recommendation. Otherwise it reports `not-requested` or `blocked` with blocker codes. When install intent is explicit but
all dependency decisions are already satisfied, it reports `mode: "not-needed"`.

For `add` reports, the CLI also emits a read-only `dependencyInstallPlan`. It detects npm, pnpm, yarn, and bun from the
consumer `packageManager` field or known lockfile/workspace marker files, lists proposed install commands for missing or
incompatible dependencies, and selects a `recommendedCommands` entry only when the package manager is known. Unknown
package-manager state still reports all command options but runs nothing. The plan is advisory data only: `package.json`,
package-manager lockfiles, and installed packages are not modified.

Workspace consumers get additional read-only detail. When a target package manifest lives under a detected workspace
root, reports include `dependencyInstallPlan.workspace` with root marker provenance, root package-manager metadata, target
package name, and target package path. Each package-manager command can also include `workspaceCommand` with root-scoped
npm, pnpm, yarn, or bun command details. `workspaceCommand` is review output only in this slice; strict execution still
uses the existing selected `recommendedCommands` entry until workspace execution policy is explicitly approved.

Strict local-registry `add` can execute the selected `recommendedCommands` entry when all current strict blockers are
dependency blockers, `--install-dependencies` is present, the effective dependency policy is `install`, and package-manager
detection is known. After the command completes, Amino rebuilds the install plan from the target package manifest before
writing component files or `amino-ui.lock.json`. If dependency decisions remain unsatisfied, strict add still blocks
component writes.

Package-manager failure is also a blocker. The failed-command record includes command, args, working directory, exit
code or signal, bounded stdout/stderr, `packageManagerWrites`, and any detected package manifest or package-manager
lockfile mutations. Amino source files and `amino-ui.lock.json` are not written after a package-manager failure, even
when the failed package-manager command already changed `package.json`.

Enterprise consumers can keep this planning explicit with `--package-json <path>` and `--package-manager <name>`.
`--package-json` selects the manifest used for dependency classification and command targeting; `--package-manager`
overrides automatic package-manager detection. Reports include `targetManifest`, per-command `targetManifestPath`, and
per-command `workingDirectory` so consumers can review where the proposed command belongs. These flags still do not write
manifests, lockfiles, or installed packages.

Current fixture evidence proves the clean `circle-loader` add lifecycle in a temporary `vite-registry-contained` copy:
strict init creates only config and lockfile, advisory and dry-run report the same install graph without writes, strict
add writes only the two CircleLoader source files plus lockfile metadata, and post-add `status --json`/`diff --json`
report a clean installed item without mutation.

Current fixture evidence also proves strict `add switch --json` blocks without mutation when an unknown existing component
target or incompatible support token target would otherwise be overwritten.

The compatible-support fixture proves the other branch of that policy. A temporary initialized
`vite-registry-contained-compatible-token` copy keeps its existing `tokens/geometry` file in place, advisory and dry-run
report `reuse-existing` with TypeScript export-superset compatibility, and strict `add switch --json` writes only the
missing `Switch` graph files plus lockfile metadata while recording the reused file as `consumer-owned-support`.

The missing-dependency fixture proves strict add stops before writes when required packages are not already satisfied. A
temporary initialized `vite-registry-contained-missing-dependencies` copy reports React and React DOM as satisfied, reports
`react-aria-components` and `classnames` as missing in advisory and dry-run output, and strict `add switch --json` blocks
without writing source files, lockfile records, dependency records, package manifests, or package-manager lockfiles.
The dependency-policy fixture gate proves `report-only`, `manual`, `prompt`, and `install` policy reporting from default,
config, and CLI override sources while preserving package-manager non-execution.
The companion dependency-install-plan fixture gate proves the proposed npm, pnpm, yarn, and bun commands stay read-only
across unknown package-manager state, `packageManager` metadata detection, and lockfile fallback detection.
The dependency-target-resolution fixture gate proves `--package-json`, `--package-manager`, nested target manifests,
upward lockfile detection, target-manifest command metadata, and override precedence without package-manager writes.
The out-of-band dependency-resolution fixture gate proves the current consumer-owned install path: `add switch` first
reports missing `react-aria-components` and `classnames`, the consumer resolves those dependencies outside the CLI in
the selected package manifest, advisory and dry-run reruns report no install recommendations, and strict
`add switch --json` succeeds without rewriting `package.json`, package-manager lockfiles, or installed packages. The same
proof covers the nearest package manifest and `--package-json apps/web/package.json`.

`remove` and `delete --with-orphans` can also classify dependency cleanup candidates. That classification is derived from
the installed item set, the planned orphan cleanup set, and local registry dependency metadata. It is reported in
`dependencyCleanup` during advisory and dry-run modes only. The CLI still does not edit `package.json`, package-manager
lockfiles, or installed packages.

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

Current fixture evidence proves greenfield/uninitialized status, initialized-empty status after strict init, clean
installed `circle-loader` status, locally modified installed-file status, `consumer-owned-support`, `unknown`, `missing`,
`ejected`, missing dependency posture, and stale source-hash/source-drift classification.

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
uses that dry-run output as its write gate.

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

## Strict Update

`update <item> --json` applies an item-scoped update only after the dry-run gate proves the item is safe:

```sh
aui update <item> --json --cwd <consumer-project>
```

Strict update starts by creating the same `update --dry-run --json` report. It applies only when the item state is
`would-update`, no dry-run blockers exist, and a final preflight confirms the installed file hashes, current registry
source hashes, and planned installed hashes still match the dry-run output.

The JSON report includes:

| Field             | Meaning                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `applied`         | `true` when source files or lockfile records were updated; `false` when blocked or already up to date.       |
| `itemUpdateState` | Aggregate strict state: `updated`, `up-to-date`, `blocked`, or `unavailable`.                                |
| `files`           | Per-file dry-run action, strict action, and booleans for source-file writes and lockfile-record updates.     |
| `effects`         | Actual source-file write count, lockfile-record update count, dependency non-mutation, and package boundary. |
| `blockers`        | Project, item, source, dependency, or file blockers that prevented strict update.                            |
| `lockfileData`    | The post-update lockfile data when applied, or the current parsed lockfile data when blocked or up to date.  |

Strict update can write registry-owned component source files when dry-run says `would-write`. It can also perform a
lockfile-only hash refresh when dry-run says `would-update-lockfile`, meaning the local file already matches the current
planned installed content but the lockfile record is stale. In both cases, the lockfile file record receives the planned
`sourceHash` and `installedHash`.

The command is item-atomic. If any file in the item is locally modified, missing, unknown, consumer-owned support,
ejected, dependency-blocked, source-blocked, or otherwise preservation-sensitive, otherwise-eligible update candidates
remain untouched and the lockfile is not written. Up-to-date items return an exit-0 no-op report. Strict update does not
merge local edits, install or update dependencies, mutate package manifests, touch package-manager lockfiles, update
support/orphan policy, or run `update --all`.

Current fixture evidence proves temp-copy clean installed no-op strict update, update-candidate source-file write,
lockfile-only hash refresh, locally modified blocking, missing local file blocking, unknown ownership blocking,
consumer-owned support blocking, ejected blocking, and missing dependency blocking.

## Remove Advisory

`remove --advisory --json` is the first remove command, and it is intentionally read-only:

```sh
aui remove <item> --advisory --json --cwd <consumer-project>
aui remove <item> --advisory --with-orphans --json --cwd <consumer-project>
```

It starts from `status --json` classification and reports what a future remove flow would need to consider. It does not
delete source files, write config, write lockfile data, change package metadata, remove dependencies, or touch
package-manager lockfiles.

The JSON report includes:

| Field               | Meaning                                                                                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `itemRemoveState`   | Aggregate state: `remove-candidate`, `lockfile-cleanup-candidate`, `review-required`, or `unavailable`.                 |
| `files`             | Per-file ownership/source state, advisory action, removal target, preservation posture, and shared references.          |
| `orphanCleanup`     | Disabled by default. With `--with-orphans`, reports dependency items that would become orphan cleanup candidates.       |
| `dependencyCleanup` | Disabled by default. With `--with-orphans`, classifies package dependencies as cleanup candidates or still required.    |
| `dependencies`      | Recorded lockfile dependency decisions; no package-manager mutation is run.                                             |
| `effects`           | Always reports no config, lockfile, source-file, or dependency writes for this mode.                                    |
| `summary`           | Counts for removable files, lockfile cleanup candidates, blockers, preservation, support review, and shared references. |
| `findings`          | Missing item/config/lockfile/registry-source warnings from the status model.                                            |

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

Remove advisory is conservative around support files for the requested item. It does not decide source-file deletion,
lockfile writes, or package-manager mutation. `--with-orphans` is an explicit no-write planning option: it walks the
requested item's `registryDependencies` graph and reports dependency items that have no remaining dependents outside the
planned cleanup set. Registry-owned support, theme, and token files may appear as orphan cleanup candidates only in that
separate `orphanCleanup` block. The advisory report also adds `dependencyCleanup`, which maps lockfile dependency records
back to registry items in the planned cleanup set. Dependencies required only by removed items are
`cleanup-candidate`; dependencies still required by another installed item are `still-required`. Locally modified,
consumer-owned-support, unknown, ejected, and shared files still block automatic cleanup by default.

Current fixture evidence proves clean installed remove advisory, locally modified preservation, missing local file
lockfile-cleanup posture, unknown ownership preservation, consumer-owned support preservation, ejected preservation,
missing dependency posture, stale source-hash classification, and Wavemap-like orphan plus dependency cleanup advisory
planning behind `--with-orphans`. It also proves a modified orphan item is preserved, keeps its package dependencies
`still-required`, and blocks automatic cleanup.

## Remove Dry Run

`remove --dry-run --json` previews an item-scoped remove without writing:

```sh
aui remove <item> --dry-run --json --cwd <consumer-project>
aui remove <item> --dry-run --with-orphans --json --cwd <consumer-project>
```

It starts from `remove --advisory` classification and converts advisory actions into no-write deletion previews. It does
not delete source files, write config, write lockfile data, change package metadata, remove dependencies, or touch
package-manager lockfiles.

The JSON report includes:

| Field               | Meaning                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `itemRemoveState`   | Aggregate state: `would-remove`, `blocked`, or `unavailable`.                                                                           |
| `files`             | Per-file advisory action, dry-run action, removal booleans, blocker codes, preservation posture, and source state.                      |
| `orphanCleanup`     | Disabled by default. With `--with-orphans`, previews orphaned dependency items and files without writes.                                |
| `dependencyCleanup` | Disabled by default. With `--with-orphans`, previews package dependency cleanup candidates without writes.                              |
| `dependencies`      | Recorded lockfile dependency decisions; no package-manager mutation is run.                                                             |
| `effects`           | Actual effects. These always report no config, source-file, lockfile, or dependency writes.                                             |
| `wouldEffects`      | Planned remove preview: source-file deletion count, lockfile-record removal count, dependency cleanup count, skips, blocks, and status. |
| `blockers`          | File and item blockers that would prevent strict remove.                                                                                |
| `summary`           | Counts for candidates, lockfile cleanup records, skipped files, blocked files, blockers, and dependency states.                         |

Per-file `dryRunAction` values are:

| Dry-run action                   | Meaning                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `would-remove-file-and-lockfile` | A future strict remove would delete the local file and remove its lockfile record.                   |
| `would-remove-lockfile-record`   | The local file is already missing; a future strict remove would remove only the lockfile record.     |
| `skip-review-required`           | The file needs shared/support ownership review and would be skipped.                                 |
| `skip-preserved-local-change`    | The file has local edits and would be preserved.                                                     |
| `skip-consumer-owned-support`    | The file is consumer-owned support and would be preserved.                                           |
| `skip-unknown`                   | The file has unknown ownership and would be preserved.                                               |
| `skip-ejected`                   | The file is ejected and would be preserved.                                                          |
| `blocked`                        | The file is otherwise removable, but another file in the item requires review or preservation first. |

Dry-run is item-atomic for now. If any file in the requested item is locally modified, unknown, consumer-owned support,
ejected, shared, or a support-file review target, the item state is `blocked`; otherwise-removable files stay visible as
candidates, but `wouldRemoveFile` and `wouldRemoveLockfileRecord` stay false until blockers are resolved. Missing
dependency posture is still reported. With `--with-orphans`, `dependencyCleanup` and
`wouldEffects.dependencies.plannedRemovalCount` preview package dependency cleanup candidates, but
`wouldEffects.dependencies.status` remains `not-written` and no package-manager cleanup is run.

With `--with-orphans`, dry-run also reports `wouldEffects.orphanCleanup`. That block is the strict cleanup gate: strict
`remove` and `delete` only remove orphan dependency items that dry-run reported as unblocked cleanup candidates.

Current fixture evidence proves clean installed remove dry-run, locally modified item blocking, missing local file
lockfile-cleanup preview, unknown ownership preservation, consumer-owned support preservation, ejected preservation,
missing dependency posture, stale source-hash classification, and Wavemap-like orphan plus dependency cleanup dry-run
planning behind `--with-orphans`. It also proves a modified orphan item suppresses dependency removal planning by keeping
the dependency effect `not-written` with zero planned removals.

## Strict Remove

`remove <item> --json` applies an item-scoped remove only after the dry-run gate proves the item is safe:

```sh
aui remove <item> --json --cwd <consumer-project>
aui remove <item> --with-orphans --json --cwd <consumer-project>
```

Strict remove starts by creating the same `remove --dry-run --json` report. It applies only when the item state is
`would-remove`, no dry-run blockers exist, and a final preflight confirms every file path still resolves inside the
consumer root and every planned source-file deletion still matches the dry-run hash.

The JSON report includes:

| Field             | Meaning                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `applied`         | `true` when files or lockfile records were removed; `false` when blockers prevented mutation.                |
| `itemRemoveState` | Aggregate strict state: `removed`, `blocked`, or `unavailable`.                                              |
| `files`           | Per-file dry-run action, strict action, and booleans for source-file deletion and lockfile-record removal.   |
| `orphanCleanup`   | Disabled by default. With `--with-orphans`, reports strict orphan item/file cleanup effects.                 |
| `effects`         | Actual source-file deletion count, lockfile-record removal count, dependency non-mutation, and write status. |
| `blockers`        | Project, item, or file blockers that prevented strict removal.                                               |
| `lockfileData`    | The post-remove lockfile data when applied, or the current parsed lockfile data when blocked.                |

Strict remove can delete registry-owned component files and can clean lockfile records for registry-owned component
files that are already missing. It removes the requested item from `amino-ui.lock.json` after all preflight checks pass.
It does not remove dependencies from package manifests, change package-manager lockfiles, delete shared/support files,
delete locally modified files, delete unknown files, delete consumer-owned support, or delete ejected files.

With `--with-orphans`, strict remove also walks the requested item's registry dependency closure and removes dependency
items that have no remaining dependents outside the cleanup set. Orphan cleanup stays opt-in and separate from the
primary item report. It can remove registry-owned support, theme, and token files only when the orphan dry-run classified
them as cleanup candidates, their current hashes still match, and no outside lockfile item shares the path. If any primary
or orphan file becomes locally modified, unknown, consumer-owned support, ejected, shared outside the cleanup set, missing
unexpectedly, or path-unsafe, the whole strict operation is blocked and no source or lockfile writes are applied.

The command is item-atomic. If one file in the item needs review or preservation, otherwise-removable files remain in
place and the lockfile is not written. Missing dependency posture remains visible in the report, but strict remove does
not run package-manager cleanup or remove package dependency declarations, even when dry-run reported dependency cleanup
candidates.

Current fixture evidence proves temp-copy clean installed strict remove, missing local file lockfile cleanup, locally
modified item blocking, unknown ownership blocking, consumer-owned support blocking, ejected blocking, and missing
dependency non-mutation. The Wavemap-like fixture also proves strict `remove --with-orphans` deletes only the requested
typeahead item, eligible orphan dependency items, and their lockfile records while preserving app-owned adapters. A
modified orphan file blocks strict orphan cleanup atomically and preserves otherwise clean orphan files and lockfile
records.

## Delete Sibling

`delete <item>` is a visible sibling command for the same remove lifecycle:

```sh
aui delete <item> --advisory --json --cwd <consumer-project>
aui delete <item> --advisory --with-orphans --json --cwd <consumer-project>
aui delete <item> --dry-run --json --cwd <consumer-project>
aui delete <item> --dry-run --with-orphans --json --cwd <consumer-project>
aui delete <item> --json --cwd <consumer-project>
aui delete <item> --with-orphans --json --cwd <consumer-project>
```

The command delegates to the remove implementation. Advisory and dry-run modes remain non-mutating, and strict mode uses
the same dry-run gate, preflight checks, item-atomic blocking, lockfile write, and file deletion boundaries as
`remove <item> --json`.

The JSON report remains the remove report schema. Strict `delete` does not introduce dependency removal,
package-manager writes, unknown-file deletion, local-edit deletion, consumer-owned support deletion, or ejected-file
deletion.

`delete --with-orphans` has the same no-write advisory and dry-run orphan cleanup plus dependency cleanup planning as
`remove --with-orphans`. Strict `delete --with-orphans` has the same opt-in orphan cleanup behavior and blockers as
strict `remove --with-orphans`, and it still does not mutate package dependencies.

## Eject Advisory

`eject --advisory --json` is the first eject command, and it is intentionally read-only:

```sh
aui eject <item> --advisory --json --cwd <consumer-project>
```

It starts from `status --json` classification and reports how a future eject flow would transfer ownership from Amino UI
registry provenance to the consumer. It does not modify source files, write config, write lockfile data, change package
metadata, remove dependencies, or touch package-manager lockfiles.

The JSON report includes:

| Field            | Meaning                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `itemEjectState` | Aggregate state: `eject-candidate`, `already-ejected`, `review-required`, or `unavailable`.                          |
| `files`          | Per-file ownership/source state, advisory action, ejection target, preservation posture, and shared references.      |
| `dependencies`   | Recorded lockfile dependency decisions; no package-manager mutation is run.                                          |
| `effects`        | Always reports no config, lockfile, source-file, or dependency writes for this mode.                                 |
| `summary`        | Counts for eject candidates, already-ejected files, review blockers, preservation, support review, and shared paths. |
| `findings`       | Missing item/config/lockfile/registry-source warnings from the status model.                                         |

Per-file `action` values are:

| Action                            | Meaning                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `eject-candidate`                 | Present registry-owned component file could later become `ejected` in the lockfile.          |
| `review-missing-file`             | The local file is missing, so there is no checked-in source file to hand over automatically. |
| `review-support-file`             | Non-component support target needs orphan/shared ownership review before ejection.           |
| `review-shared-file`              | Another lockfile item references the same path, so automatic ownership transfer is blocked.  |
| `preserve-local-change`           | Consumer local edit must be reviewed before ownership transfer.                              |
| `preserve-consumer-owned-support` | Consumer-owned support is already outside automatic ownership transfer.                      |
| `preserve-unknown`                | Unknown ownership is preserved and blocks automatic ejection.                                |
| `already-ejected`                 | The file is already recorded as ejected and needs no further advisory action.                |

Eject advisory treats ejection as a future lockfile ownership change, not a source-file mutation. Clean registry-owned
component files report `ejectionTarget: "lockfile-ownership"`. Support files, shared files, missing files, local edits,
unknown targets, and consumer-owned support require review. Already ejected files stay visible as `already-ejected` so
consumers can distinguish no-op ownership state from missing provenance.

Current fixture evidence proves clean installed eject advisory, locally modified preservation, missing local file review,
unknown ownership preservation, consumer-owned support preservation, already-ejected reporting, missing dependency
posture, and stale source-hash classification.

## Eject Dry Run

`eject --dry-run --json` previews an item-scoped eject without writing:

```sh
aui eject <item> --dry-run --json --cwd <consumer-project>
```

It starts from `eject --advisory` classification and converts advisory actions into no-write lockfile ownership previews.
It does not modify source files, write config, write lockfile data, change package metadata, remove dependencies, or
touch package-manager lockfiles.

The JSON report includes:

| Field            | Meaning                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- |
| `itemEjectState` | Aggregate state: `would-eject`, `already-ejected`, `blocked`, or `unavailable`.                                   |
| `files`          | Per-file advisory action, dry-run action, ejection target, blocker codes, preservation posture, and source state. |
| `dependencies`   | Recorded lockfile dependency decisions; no package-manager mutation is run.                                       |
| `effects`        | Always reports no config, lockfile, source-file, or dependency writes for this mode.                              |
| `wouldEffects`   | Planned eject preview: lockfile ownership-transfer count, skipped files, blocked files, and status.               |
| `blockers`       | File and item blockers that would prevent strict eject.                                                           |
| `summary`        | Counts for eject candidates, already-ejected files, skipped files, blockers, and would-eject lockfile records.    |

Per-file `dryRunAction` values are:

| Action                           | Meaning                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `would-eject-lockfile-ownership` | A future strict eject would change the lockfile record from registry-owned to ejected.        |
| `already-ejected`                | The file is already ejected and needs no further lockfile mutation.                           |
| `skip-review-required`           | Missing, shared, or non-component support state needs review before ownership transfer.       |
| `skip-preserved-local-change`    | A local edit would be preserved.                                                              |
| `skip-consumer-owned-support`    | Consumer-owned support is already outside automatic ownership transfer.                       |
| `skip-unknown`                   | Unknown ownership is preserved.                                                               |
| `blocked`                        | The file is otherwise eligible, but another file in the item requires review or preservation. |

Dry-run is item-atomic for now. If any file in the requested item is locally modified, unknown, consumer-owned support,
missing, shared, or a support-file review target, the item state is `blocked`; otherwise-clean eject candidates stay
visible but `wouldEjectLockfileOwnership` stays false until blockers are resolved. Already ejected files are no-op
records and do not block. Missing dependency posture is still reported, but eject dry-run does not run package-manager
writes or dependency cleanup.

Current fixture evidence proves clean installed eject dry-run, locally modified item blocking, missing local file review,
unknown ownership preservation, consumer-owned support preservation, already-ejected no-op reporting, missing dependency
posture, and stale source-hash classification.

## Strict Eject

`eject <item> --json` applies an item-scoped lockfile ownership transfer only after the dry-run gate proves the item is
safe:

```sh
aui eject <item> --json --cwd <consumer-project>
```

Strict eject starts by creating the same `eject --dry-run --json` report. It applies only when the item state is
`would-eject`, no dry-run blockers exist, and the parsed lockfile still records every planned file as registry-owned.

The JSON report includes:

| Field            | Meaning                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `applied`        | `true` when lockfile ownership records were written; `false` when blocked or already ejected.                   |
| `itemEjectState` | Aggregate strict state: `ejected`, `already-ejected`, `blocked`, or `unavailable`.                              |
| `files`          | Per-file dry-run action, strict action, and booleans proving lockfile-only ownership transfer.                  |
| `effects`        | Actual lockfile write count, source-file non-mutation, dependency non-mutation, and package-manager boundary.   |
| `blockers`       | Project, item, or file blockers that prevented strict ejection.                                                 |
| `lockfileData`   | The post-eject lockfile data when applied, or the current parsed lockfile data when blocked or already ejected. |

Strict eject writes only `amino-ui.lock.json`. Eligible registry-owned component file records are updated to
`ownershipState: "ejected"`, while the source files remain exactly where they are for the consumer to own. Dependency
records stay visible but are not installed, updated, removed, or rewritten. Config files, package manifests, and
package-manager lockfiles are also untouched.

Already ejected items return a no-op report with exit `0`; the lockfile is not rewritten. Missing files, shared files,
support-file review targets, locally modified files, unknown ownership, consumer-owned support, and mixed safe/unsafe
items block the strict write so the command does not partially eject a graph.

Current fixture evidence proves temp-copy clean installed strict eject, locally modified blocking, missing local file
blocking, unknown ownership blocking, consumer-owned support blocking, already-ejected no-op behavior, and missing
dependency non-mutation.

## Ownership States

| State                    | Meaning                                                                    | Default CLI stance                                                                      |
| ------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `registry-owned`         | Installed file still belongs to the registry graph.                        | Eligible for future automated update/remove only after proven lifecycle commands exist. |
| `locally-modified`       | Installed file differs from recorded provenance.                           | Preserve by default; report for manual review.                                          |
| `consumer-owned-support` | Consumer intentionally owns compatible support at the planned target path. | Reuse or validate; do not overwrite by default.                                         |
| `ejected`                | Consumer intentionally took ownership of the file or component slice.      | Preserve by default; never auto-update.                                                 |
| `unknown`                | A target exists without trusted Amino provenance.                          | Treat as a blocker for strict writes.                                                   |

## Deferred Lifecycle Commands

Strict update, strict remove, strict remove/delete orphan cleanup, and strict eject now exist only inside the
dry-run-approved registry-owned boundaries above. Dependency cleanup, strict update beyond item-scoped source writes and
lockfile refreshes, strict eject beyond lockfile-only ownership transfer, and any broader deletion policy remain deferred
until dry-run evidence is broader and intentionally approved.

Generated token writers, broad update/merge behavior, broader ejection policy, public registry hosting, package
publication, and Waveguide validation remain deferred until explicitly approved.
