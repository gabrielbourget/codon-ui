---
title: CLI Baseline Contract
description: Current CLI renovation boundaries and advisory-mode policy.
---

The CLI still contains legacy scaffold paths, but the local-registry lane now supports advisory planning, dry-run
planning, strict init, strict single-component installs, read-only status inspection, focused read-only diff inspection,
item-scoped update advisory, item-scoped update dry-run, item-scoped remove advisory, and item-scoped remove dry-run
against the React registry snapshot, strict item-scoped update for fixture-proven cases, strict item-scoped remove for
fixture-proven cases, opt-in strict remove/delete orphan cleanup for fixture-proven cases, item-scoped eject advisory,
item-scoped eject dry-run, and strict item-scoped eject for fixture-proven lockfile ownership transfer. The visible
`delete` command is an alias-style sibling for the current remove lifecycle surface.

## Current Surface

| Command  | Current state                                                                                                                                                                                                                                                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`   | Legacy normal mode still mutates config, helper files, directories, and dependencies. `init --advisory` is read-only; `init --defaults` seeds only the new config and lockfile.                                                                                                                                                                                                         |
| `info`   | Read-only project context and init advisory output are available through `info --json`.                                                                                                                                                                                                                                                                                                 |
| `add`    | Legacy normal mode remains for other inputs. Local-registry `add --advisory --json` and `add --dry-run --json` plan the graph; strict `add <component> --json` writes one local React component graph when blockers are absent.                                                                                                                                                         |
| `delete` | Visible sibling for `remove`. `delete <item> --advisory --json`, `delete <item> --dry-run --json`, `delete <item> --json`, and their `--with-orphans` variants use the same remove reports, blockers, effects, and mutation boundaries.                                                                                                                                                 |
| `diff`   | `diff <item> --json` compares one installed lockfile item against the local registry source and emits preservation-oriented file recommendations without writing.                                                                                                                                                                                                                       |
| `eject`  | `eject <item> --advisory --json` reports item-scoped ownership-transfer posture from the status model without writing files or lockfile data. `eject <item> --dry-run --json` previews item-scoped lockfile ownership transfer without writing. Strict `eject <item> --json` writes only dry-run-approved lockfile ownership records and leaves source files untouched.                 |
| `remove` | `remove <item> --advisory --json` reports item-scoped remove posture from the status model without deleting files or writing lockfile data. `remove <item> --dry-run --json` previews item-scoped file and lockfile-record removals without writing. Strict `remove <item> --json` applies only when dry-run reports no blockers; `--with-orphans` opts into dependency orphan cleanup. |
| `status` | `status --json` reads config, lockfile, local registry source, installed file hashes, and recorded dependency decisions without writing.                                                                                                                                                                                                                                                |
| `update` | `update <item> --advisory --json` reports item-scoped update posture from the diff model without writing. `update <item> --dry-run --json` previews item-scoped writes, skips, blockers, dependency posture, and lockfile effects without writing. Strict `update <item> --json` applies only dry-run-approved source-file writes and lockfile-record updates.                          |

These commands are local proof tooling. They do not decide public registry hosting, package publication, generated token
output, broad update/merge behavior, broader ejection policy, dependency cleanup, or non-orphan support cleanup.

## Command Names

The package still publishes the existing `aminoui-cli` bin and now also exposes `aui` as the shorter command alias. Both
point at `dist/index.js`; package distribution policy remains separate from this alias.

## Advisory Mode

Renovated command paths use `--advisory` as the shared non-mutating diagnostics mode.

Advisory mode should:

- report expected config, registry, dependency, filesystem, and project-shape issues as diagnostics;
- exit `0` for expected findings so larger scripts and background checks are not blocked;
- avoid file writes, config writes, directory creation, package installs, and lockfile changes;
- skip or timebox slow network, package-manager, and full-project scans unless explicitly requested.

`--advisory` is different from dry-run. Advisory mode is for non-blocking diagnostics. Dry-run previews approved mutation
shapes while still avoiding writes.

Current `diff <item> --json` reports focused, read-only comparison output for lockfile items. It does not use the legacy
hosted-registry advisory path.

Current `init --advisory --json` reports the proposed consumer config, package manager, project context, theme tier,
dependency policy, and role paths without writing files. The default `registry-contained` layout places support roles
under `src/components/_registry`.

Current `init --defaults --json` is the strict new-contract seed path. It writes only `amino-ui.config.json` and an empty
`amino-ui.lock.json` when neither file exists. It does not create directories, write helper/support files, install
dependencies, or touch package-manager lockfiles. Existing config or lockfile files are reported as warnings and are not
overwritten.

Current `init --dry-run --json` previews the same strict default seed without writing files. It reports actual effects as
no-write and reports config/lockfile `wouldEffects` as `would-write`, `blocked`, or `not-written` depending on whether the
consumer is greenfield, already initialized, or partially initialized.

Current `info --json` reports the same project context and init advisory packet for fixture checks and future automation.

Current `add --advisory --json` reads the local support registry snapshot and reports planned support files, source
status, target status, graph dependencies, and target package classification without writing files. Available source
files include `sha256:<hex>` content hashes; missing source files produce `source-file-missing` warning findings. Planned
files use `missing` or `existing` target status, and existing targets produce `target-file-exists` warning findings while
the command remains read-only and non-blocking.

When an explicit local React component is requested, advisory mode reads `packages/CLI/registry/local-react.registry.json`
for the install plan and packet metadata for review context. The output reports component files, support graph files,
public export intent, import rewrites, theme requirements, dependency posture, and planned-but-not-written lockfile
effects. Compatible declarations in the target package are reported as `satisfied`.

Current `add <component> --dry-run --json` uses the same local React registry source and packet metadata, but reports
would-apply effects instead of advisory-only effects. It still writes no files, config, lockfile, directories, or package
metadata. Missing `amino-ui.config.json` is a warning for now, and the command falls back to default `registry-contained`
paths so fixtures can preview the exact write set before strict init. Existing targets are counted as blockers,
dependency decisions are summarized, and the lockfile effect reports `would-write`.

Current strict `add <component> --json` reads the same local React registry source after strict init has created
`amino-ui.config.json` and `amino-ui.lock.json`. It requires already-satisfied dependencies, rejects missing source files
and unsafe existing target files, writes the planned support/theme/component graph, rewrites package-local imports to the
installed registry paths, and records hash-based lockfile item/file ownership plus satisfied dependency decisions. It can
reuse compatible support files when the lockfile proves they are reusable. It does not install packages, overwrite
unknown files, generate hosted registry artifacts, or implement update/eject behavior.

Current `status --json` is read-only. It loads `amino-ui.config.json` and `amino-ui.lock.json`, selects the full local
React registry for component items such as `circle-loader`, computes current file hashes, compares them to installed and
source hashes, reports lockfile dependency posture, and emits summary counts for file and source states. Fixture evidence
currently proves greenfield, clean installed, locally modified, unknown, consumer-owned-support, missing, ejected,
dependency issue, and stale source-hash cases.

Current `diff <item> --json` is read-only and item-scoped. It builds on the status model, emits per-file comparisons,
review recommendations, optional source-to-local line diff segments, dependency posture, and explicit no-write effects.
Fixture evidence currently proves clean installed, locally modified, unknown, consumer-owned-support, missing, ejected,
dependency issue, and stale source-hash cases.

Current `update <item> --advisory --json` is read-only and item-scoped. It builds on the diff model, emits per-file
advisory actions, item update state, dependency posture, automatic-update blocker counts, and explicit no-write effects.
It reports `update-candidate` only for pristine registry-owned files with source changes. It preserves locally modified,
missing, unknown, consumer-owned-support, and ejected files by default. Fixture evidence currently proves clean installed,
locally modified, unknown, consumer-owned-support, missing, ejected, dependency issue, and stale source-hash cases.

Current `update <item> --dry-run --json` is also non-mutating and item-scoped. It reuses the update advisory
classification, recomputes the current registry install plan for the item, applies the same relative-import rewrite logic
used by strict add when calculating planned installed hashes, and reports `wouldEffects` separately from actual effects.
Actual effects always report no source, config, lockfile, or dependency writes. `wouldEffects` reports whether strict
update would write source files, update only lockfile hashes, skip preservation-sensitive files, block on dependencies or
project state, or do nothing. The command marks the item `blocked` when any file in that installed item requires
preservation, even if another file remains visible as an update candidate.

Current strict `update <item> --json` reuses the dry-run report as its gate. It applies only when the item state is
`would-update`, no dry-run blockers exist, and a final preflight proves the local file hashes and current registry source
still match the dry-run plan. It writes dry-run-approved registry-owned component source files, updates matching lockfile
file records, and supports lockfile-only hash refresh when the local file already matches the planned installed content.
Up-to-date items return a no-op report with exit 0. It does not merge local edits, update unknown files, update
consumer-owned support, update ejected files, install dependencies, mutate package manifests, or touch package-manager
lockfiles.

Current `remove <item> --advisory --json` is read-only and item-scoped. It builds on the status model, emits per-file
remove advisory actions, item remove state, dependency posture, shared lockfile reference counts, and explicit no-write
effects. It reports `remove-candidate` only for registry-owned component files that are present locally and not shared
with another lockfile item. Missing registry-owned component files are lockfile-cleanup candidates only. Locally modified,
unknown, consumer-owned-support, ejected, shared, and non-component support files block automatic removal and require
review.

Current `remove <item> --dry-run --json` is also non-mutating and item-scoped. It reuses remove advisory classification
and reports `wouldEffects` separately from actual effects. Actual effects always report no source-file deletion, config
writes, lockfile writes, or dependency writes. `wouldEffects` reports whether a future strict remove would delete source
files, remove lockfile records for present or already-missing files, skip preservation-sensitive files, block on
review-required files, or do nothing. The command marks the item `blocked` when any file in that installed item requires
review or preservation, so it does not preview partial deletion for mixed safe/unsafe items.

Current strict `remove <item> --json` reuses the dry-run report as its gate. It applies only when the item state is
`would-remove`, no dry-run blockers exist, and the preflight still proves every planned source-file deletion or
lockfile-only cleanup is current. It deletes registry-owned component files, removes the item from `amino-ui.lock.json`,
and preserves dependency records. It does not remove package dependencies, package-manager lockfiles, shared/support
files, unknown files, locally modified files, consumer-owned support, or ejected files.

Current `remove <item> --with-orphans --json` and `delete <item> --with-orphans --json` use the same dry-run gate, then
opt into dependency orphan cleanup for items with no remaining dependents outside the cleanup set. Orphan cleanup lives in
the separate `orphanCleanup` report block. It removes only dry-run-approved orphan item files and lockfile records, and it
stays blocked by local edits, unknown ownership, consumer-owned support, ejected files, outside shared references,
unexpectedly missing files, or path-boundary violations.

Current `delete <item>` is a visible sibling command for the same lifecycle surface. It supports `--advisory`, `--dry-run`,
and strict JSON modes by delegating to the remove implementation. The JSON schema remains the remove report schema; the
command does not add dependency cleanup or any broader deletion policy.

Current `eject <item> --advisory --json` is read-only and item-scoped. It builds on the status model, emits per-file
eject advisory actions, item eject state, dependency posture, shared lockfile reference counts, and explicit no-write
effects. It reports `eject-candidate` only for present registry-owned component files that can later become `ejected`
through lockfile ownership changes. Missing files, shared files, support files, local edits, unknown ownership, and
consumer-owned support require review or preservation. Already ejected files report `already-ejected` without requiring
additional mutation.

Current `eject <item> --dry-run --json` is also non-mutating and item-scoped. It reuses eject advisory classification
and reports `wouldEffects` separately from actual effects. Actual effects always report no source-file writes, config
writes, lockfile writes, or dependency writes. `wouldEffects` reports whether a future strict eject would transfer
lockfile ownership to the consumer, skip preservation-sensitive files, block on review-required files, or do nothing.
The command marks the item `blocked` when any file in that installed item requires review or preservation, so it does
not preview partial lockfile ownership transfer for mixed safe/unsafe items.

Current strict `eject <item> --json` reuses the dry-run report as its gate. It applies only when the item state is
`would-eject`, no dry-run blockers exist, and the lockfile still records the planned component files as registry-owned.
It writes only `amino-ui.lock.json`, changing eligible file records to `ejected`, and it leaves source files,
package-manager files, config, and dependency records untouched. Already ejected items return a no-op report with exit 0. Missing files, shared/support files, local edits, unknown ownership, consumer-owned support, and mixed unsafe items
block the strict write.

## Command Data Flow

The semi-developed command lane is intentionally linear:

```text
init advisory -> init dry-run -> init defaults -> add advisory -> add dry-run -> strict add -> status -> diff -> update advisory -> update dry-run -> strict update -> remove advisory -> remove dry-run -> strict remove -> delete sibling -> remove/delete orphan cleanup -> eject advisory -> eject dry-run -> strict eject
```

`init` establishes consumer intent and provenance storage. `add` consumes registry metadata and the consumer files created
by `init`.

| Stage                          | Reads                                                | Writes                                   |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------- |
| `init --advisory`              | Project shape and package metadata.                  | Nothing.                                 |
| `init --dry-run`               | Project shape and existing Amino config/lockfile.    | Nothing.                                 |
| `init --defaults`              | Project shape and existing Amino config/lockfile.    | Config and empty lockfile only.          |
| `add --advisory`               | Local snapshot, packet metadata, target package.     | Nothing.                                 |
| `add --dry-run`                | Local snapshot, packet metadata, config if present.  | Nothing.                                 |
| Strict `add`                   | Snapshot, packet metadata, config, lockfile, source. | Source/support/theme files and lockfile. |
| `status --json`                | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| `diff --json`                  | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| `update --advisory --json`     | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| `update --dry-run --json`      | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| Strict `update`                | Config, lockfile, local snapshot, installed files.   | Source files and lockfile.               |
| `remove --advisory --json`     | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| `remove --dry-run --json`      | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| Strict `remove`                | Config, lockfile, local snapshot, installed files.   | Source-file deletes and lockfile.        |
| `delete` sibling               | Same as matching `remove` mode.                      | Same as matching `remove` mode.          |
| `remove/delete --with-orphans` | Config, lockfile, local snapshot, installed files.   | Source-file deletes and lockfile.        |
| `eject --advisory --json`      | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| `eject --dry-run --json`       | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |
| Strict `eject`                 | Config, lockfile, local snapshot, installed files.   | Lockfile only.                           |

This lane is designed so fixture evidence can capture each transition before stricter lifecycle commands exist.

## Completed Renovation Sequence

1. Add fixture tests around config, registry schemas, package-manager helpers, and transforms.
2. Add advisory preflight paths for `init` and `add`.
3. Seed strict init with config and empty Amino lockfile only.
4. Add dry-run previews before strict component writes.
5. Add strict single-component local registry install paths for satisfied-dependency, no-conflict proofs.
6. Add read-only `status --json` for greenfield, clean installed, locally modified, and classification fixture proofs.
7. Add focused read-only `diff --json` for clean installed, locally modified, and classification fixture proofs.
8. Add item-scoped read-only `update --advisory --json` for clean installed, locally modified, and classification fixture
   proofs.
9. Add item-scoped no-write `update --dry-run --json` for clean installed, update-candidate, locally modified, and
   classification fixture proofs.
10. Add strict item-scoped `update <item> --json` for clean installed no-op, update-candidate source writes,
    lockfile-only refresh, locally modified blocking, and classification fixture proofs.
11. Add item-scoped read-only `remove --advisory --json` for clean installed, locally modified, and classification
    fixture proofs.
12. Add item-scoped no-write `remove --dry-run --json` for clean installed, locally modified, and classification fixture
    proofs.
13. Add item-scoped read-only `eject --advisory --json` for clean installed, locally modified, and classification
    fixture proofs.
14. Add item-scoped no-write `eject --dry-run --json` for clean installed, locally modified, and classification fixture
    proofs.
15. Add strict item-scoped `remove <item> --json` for clean installed, missing-file cleanup, locally modified, and
    classification fixture proofs.
16. Add visible sibling `delete <item>` command coverage for advisory, dry-run, and strict remove-equivalent fixture
    proofs.
17. Add strict item-scoped `eject <item> --json` for clean installed lockfile ownership transfer, already-ejected no-op,
    locally modified blocking, and classification fixture proofs.
18. Add opt-in strict `remove/delete --with-orphans` for Wavemap-like dependency orphan cleanup in temporary fixture
    copies.

## Next Lifecycle Targets

The next CLI discussion should use the consumer fixture evidence and Wavemap reinstall checkpoints as inputs. The CLI
should remain declarative and metadata-driven: registry metadata should tell the CLI what to install, track, diff, update,
remove, and eject.

Discussion targets before lifecycle behavior expands:

- theme tiers: package default CSS, narrow compatibility bridges, consumer-owned mapping, later generated output;
- install metadata: file hashes, registry ids, versions, dependencies, and chosen theme tier;
- ownership states: registry-owned, locally modified, ejected, consumer-owned support, and unknown;
- update stance: automatic only for pristine registry-owned files, manual merge for modified files, never auto-update
  ejected files;
- lifecycle proof mode: use `status --json`, `diff --json`, and `update --advisory --json` as the read-only
  classification base, then use `update --dry-run --json` to gate strict item-scoped update writes,
  `remove --dry-run --json` to gate strict remove behavior, and `eject --dry-run --json` to gate strict lockfile-only
  ownership transfer.

## Boundaries

Do not expand strict update beyond dry-run-approved item-scoped source writes and lockfile refreshes, strict
remove/delete cleanup beyond opt-in orphan dependency cleanup, strict eject beyond lockfile-only ownership transfer,
registry artifact hosting, generated token writers, dependency cleanup, non-orphan support cleanup, or publication policy
as incidental cleanup.
