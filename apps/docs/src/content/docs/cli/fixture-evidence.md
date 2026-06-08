---
title: Fixture Evidence
description: Proof packets for Amino UI CLI command behavior.
---

The fixture repo records command behavior evidence for Amino UI consumers. It is not canonical component source and it is
not a replacement for Wavemap mature-consumer proof. Its job is to make CLI behavior systematic, repeatable, and
assertable.

## Evidence Repository

Consumer fixture projects live in the sibling `amino-ui-consumer-fixtures` repository. Use them when CLI behavior affects:

- config or lockfile creation;
- advisory or dry-run output;
- source/support/theme file writes;
- dependency classification;
- target collision handling;
- ownership states;
- compile behavior for installed source.

Run fixture verification from the fixture repo:

```sh
pnpm verify
```

Use focused gates for narrow lifecycle slices:

```sh
pnpm verify:status
pnpm verify:diff
```

## Proof Packet

Each command proof should record the same fields so future lifecycle commands can be compared without reading long run
logs.

| Field                      | Expected evidence                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fixture name               | Stable fixture or scenario name, such as `vite-registry-contained` or a locally modified variant.       |
| Starting state             | Config, lockfile, package metadata, existing target files, and known ownership states.                  |
| Command invocation         | Exact command, flags, cwd, and registry source.                                                         |
| JSON assertion             | Checked fields in stdout JSON, including findings, effects, file counts, and dependency decisions.      |
| File mutation boundary     | Which files must remain unchanged, which files may be written, and which existing targets must block.   |
| Lockfile mutation boundary | Whether the lockfile is not written, would be written, or was written with expected item/file metadata. |
| Dependency boundary        | Proof that package-manager lockfiles are not changed and dependency decisions are classification-only.  |
| Verification after install | Compile, typecheck, or smoke command when the fixture receives source.                                  |

## Command Expectations

Use the same evidence shape across the current and planned CLI lifecycle.

| Command mode               | Fixture expectation                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `init --advisory --json`   | Reports project shape, default config, theme tier, role paths, and policy without writes.                                     |
| `init --defaults --json`   | Writes only `amino-ui.config.json` and an empty `amino-ui.lock.json` when both are absent.                                    |
| `add --advisory --json`    | Reports graph, source availability, target status, dependencies, and not-written lockfile effects.                            |
| `add --dry-run --json`     | Reports the exact would-write shape, blockers, dependency counts, and would-write lockfile effects.                           |
| Strict `add <item> --json` | Writes only approved source/support/theme files plus lockfile metadata when blockers are absent.                              |
| `status --json`            | Classifies installed graph, local edits, source freshness, dependency posture, and ownership without writes for proven cases. |
| `diff --json`              | Compares one registry item against installed files without mutating source, lockfile, config, or dependency state.            |
| Future `update --advisory` | Must report available changes, blockers, ownership states, dependency changes, and expected effects.                          |
| Future `update --dry-run`  | Must preview exact writes, reuses, skips, blocks, and lockfile effects without writing.                                       |
| Future remove/delete/eject | Must preserve modified, consumer-owned-support, unknown, and ejected files unless explicitly approved.                        |

## Fixture Matrix

Grow fixture coverage by scenario, not by one-off command notes.

| Scenario                 | What it proves                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Greenfield default       | `init` advisory/default behavior, config/lockfile-only writes, and uninitialized `status --json`.  |
| Clean registry-contained | `add` advisory, dry-run, strict writes, lockfile metadata, and compile behavior.                   |
| Existing unknown targets | Strict writes block rather than overwrite unknown local files.                                     |
| Compatible support reuse | Existing support is reused only when metadata and content are safe.                                |
| Locally modified files   | `status` and `diff` report local edits; future lifecycle commands must preserve them by default.   |
| Consumer-owned support   | Compatible support can be validated/reused without becoming registry-overwritten.                  |
| Ejected files            | Ejected items stay visible for status/diff but are not mutated.                                    |
| Missing dependencies     | Advisory and dry-run classify dependency posture; strict add blocks when requirements are missing. |
| Snapshot/source drift    | Planner output reports stale or missing registry source clearly.                                   |
| Mature-consumer shape    | A Wavemap-like graph can be tested without using the full Wavemap repo for every CLI regression.   |

## Non-Mutation Rule

Advisory and dry-run fixture proofs must assert that no source files, config files, lockfiles, package manifests,
package-manager lockfiles, directories, or generated registry artifacts changed unless the command mode explicitly owns
that mutation.

Strict command proofs should assert the positive write set and the negative preservation set. A successful strict `add`
is not enough if it silently overwrites unknown targets, modified files, or package-manager state.

## Deferred Behaviors

Fixture evidence should describe deferred behavior without implying it exists. Public registry hosting, package
publication, generated token writers, package-manager dependency writes, strict update behavior, strict ejection, and
Waveguide validation remain separate approval-gated lanes.
