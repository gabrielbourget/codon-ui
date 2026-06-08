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
pnpm verify:init-dry-run
pnpm verify:init-lifecycle
pnpm verify:add-lifecycle
pnpm verify:strict-add-blockers
pnpm verify:compatible-support-reuse
pnpm verify:add-dependency-boundary
pnpm verify:dependency-install-plan
pnpm verify:status
pnpm verify:diff
pnpm verify:update-advisory
pnpm verify:update-dry-run
pnpm verify:strict-update
pnpm verify:remove-advisory
pnpm verify:remove-dry-run
pnpm verify:strict-remove
pnpm verify:remove-orphans
pnpm verify:delete
pnpm verify:eject-advisory
pnpm verify:eject-dry-run
pnpm verify:strict-eject
pnpm verify:wavemap-like-lifecycle
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
| Dependency install plan    | Read-only package-manager detection and proposed install commands when required packages are missing.   |
| Verification after install | Compile, typecheck, or smoke command when the fixture receives source.                                  |

## Command Expectations

Use the same evidence shape across the current and planned CLI lifecycle.

| Command mode                   | Fixture expectation                                                                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init --advisory --json`       | Reports project shape, default config, theme tier, role paths, and policy without writes.                                                                                                                                                                                |
| `init --dry-run --json`        | Reports no actual writes plus config and lockfile would-effects for greenfield and existing-file blocker cases.                                                                                                                                                          |
| `init --defaults --json`       | Writes only `amino-ui.config.json` and an empty `amino-ui.lock.json` when both are absent.                                                                                                                                                                               |
| `add --advisory --json`        | Reports graph, source availability, target status, dependencies, and not-written lockfile effects.                                                                                                                                                                       |
| `add --dry-run --json`         | Reports the exact would-write shape, blockers, dependency counts, and would-write lockfile effects.                                                                                                                                                                      |
| Strict `add <item> --json`     | Writes only approved source/support/theme files plus lockfile metadata when blockers are absent; focused lifecycle proof follows strict init through post-add status/diff, existing-target blockers, compatible support reuse/adoption, and missing dependency blockers. |
| `status --json`                | Classifies installed graph, local edits, source freshness, dependency posture, and ownership without writes for proven cases.                                                                                                                                            |
| `diff --json`                  | Compares one registry item against installed files without mutating source, lockfile, config, or dependency state.                                                                                                                                                       |
| `update --advisory --json`     | Reports available changes, blockers, ownership states, dependency posture, and no-write effects.                                                                                                                                                                         |
| `update --dry-run --json`      | Previews exact item-scoped writes, lockfile-only updates, skips, blocks, and lockfile effects without writing.                                                                                                                                                           |
| Strict `update <item> --json`  | Writes only dry-run-approved source files and lockfile records; preserves unsafe files and package-manager state.                                                                                                                                                        |
| `remove --advisory --json`     | Reports removable files, lockfile-cleanup candidates, blockers, ownership states, shared references, and no-write effects.                                                                                                                                               |
| `remove --dry-run --json`      | Previews item-scoped file deletion, lockfile-record cleanup, skips, blocks, and lockfile effects without writing.                                                                                                                                                        |
| Strict `remove <item> --json`  | Deletes only dry-run-approved registry-owned component files and lockfile records in temporary-copy proofs.                                                                                                                                                              |
| `remove/delete --with-orphans` | Reports no-write orphan and dependency cleanup candidates, then proves strict temp-copy cleanup for eligible registry dependency items without package writes.                                                                                                           |
| `delete <item>` sibling        | Proves advisory, dry-run, and strict command-line parity with the same remove report schema and mutation boundaries.                                                                                                                                                     |
| `eject --advisory --json`      | Reports ownership-transfer candidates, already-ejected files, blockers, ownership states, shared references, and no-write effects.                                                                                                                                       |
| `eject --dry-run --json`       | Previews item-scoped lockfile ownership transfer, skips, blocks, and lockfile effects without writing.                                                                                                                                                                   |
| Strict `eject <item> --json`   | Transfers only dry-run-approved lockfile ownership records to `ejected`; source files and dependencies are not mutated.                                                                                                                                                  |
| Future lifecycle expansion     | Must preserve modified, consumer-owned-support, unknown, and ejected files unless explicitly approved.                                                                                                                                                                   |

## Fixture Matrix

Grow fixture coverage by scenario, not by one-off command notes.

| Scenario                 | What it proves                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenfield default       | `init` advisory/dry-run/default behavior, config/lockfile-only writes, uninitialized `status --json`, and initialized-empty `status --json`. |
| Clean registry-contained | `add` advisory, dry-run, strict writes, post-add status/diff, lockfile metadata, and compile behavior.                                       |
| Existing unknown targets | Strict writes block rather than overwrite unknown local files.                                                                               |
| Compatible support reuse | Existing support is reused only when metadata and content are safe.                                                                          |
| Locally modified files   | `status` and `diff` report local edits; future lifecycle commands must preserve them by default.                                             |
| Consumer-owned support   | Compatible support can be validated/reused without becoming registry-overwritten.                                                            |
| Ejected files            | Ejected items stay visible for status/diff but are not mutated.                                                                              |
| Missing dependencies     | Advisory and dry-run classify dependency posture; strict add blocks when requirements are missing.                                           |
| Dependency install plan  | Missing dependency reports propose npm, pnpm, yarn, and bun commands without running package-manager writes.                                 |
| Snapshot/source drift    | Planner output reports stale or missing registry source clearly.                                                                             |
| Mature-consumer shape    | A Wavemap-like graph can be tested without using the full Wavemap repo for every CLI regression.                                             |

The current mature-consumer fixture is `wavemap-like-typeahead-lifecycle`. It installs the registry-owned
`typeahead-search` graph and keeps app-owned artist wrapper, API query, route/query state, typeahead controller, local
labels, and focused test files outside `amino-ui.lock.json`. Its focused gate proves status, diff, update, remove/delete,
eject, and temp-copy typecheck/build behavior against that mixed graph.

The `pnpm verify:add-lifecycle` gate proves the clean `circle-loader` path in one temporary `vite-registry-contained`
copy. It strict-initializes config and lockfile, runs add advisory and dry-run without mutation, performs the strict add
with only the two expected source-file writes plus lockfile metadata, and then verifies post-add `status --json` and
`diff --json` remain read-only and clean.

The `pnpm verify:strict-add-blockers` gate proves strict `add switch --json` refuses to overwrite unsafe existing targets.
It runs after strict init in temporary copies, asserts exit-status `1` with structured blocker JSON, and verifies no
source, config, lockfile, package manifest, or package-manager lockfile mutation for both an existing component target
and an incompatible support token target.

The `pnpm verify:compatible-support-reuse` gate proves a compatible existing support target is reused rather than
overwritten. It strict-initializes a temporary `vite-registry-contained-compatible-token` copy, runs `add switch`
advisory and dry-run without mutation, then proves strict add writes only the missing `Switch` graph files plus lockfile
metadata while adopting `tokens/geometry` as `consumer-owned-support`.

The `pnpm verify:add-dependency-boundary` gate proves dependency handling stays classification-first. It strict-initializes
a temporary `vite-registry-contained-missing-dependencies` copy, reports missing `react-aria-components` and `classnames`
dependencies in advisory and dry-run output without mutation, and proves strict `add switch --json` blocks before source,
lockfile, package manifest, package-manager lockfile, or dependency writes.

The `pnpm verify:dependency-install-plan` gate proves the companion read-only package-manager plan. It checks unknown
package-manager state, `packageManager` metadata detection, lockfile fallback detection, npm/pnpm/yarn/bun command
recommendations, and empty `recommendedCommands` when the package manager is unknown. The gate uses temporary fixture
copies and executes no package-manager installs.

The `pnpm verify:remove-orphans` gate uses the same fixture to prove `remove`/`delete --with-orphans` advisory,
dry-run, and strict temp-copy behavior. It verifies that the requested `typeahead-search` item remains item-scoped, that
orphaned registry dependency items appear in a separate `orphanCleanup` block, that registry-owned support files can be
planned and removed there, that package dependency cleanup candidates appear in a no-write `dependencyCleanup` block, and
that app-owned adapters remain outside both the lockfile and orphan cleanup report. The same gate mutates a temporary
orphan file to prove modified orphan items remain installed, keep their package dependencies `still-required`, suppress
dry-run dependency removals, and block strict cleanup atomically.

## Non-Mutation Rule

Advisory and dry-run fixture proofs must assert that no source files, config files, lockfiles, package manifests,
package-manager lockfiles, directories, or generated registry artifacts changed unless the command mode explicitly owns
that mutation.

Strict command proofs should assert the positive write set and the negative preservation set. A successful strict `add`
is not enough if it silently overwrites unknown targets, modified files, or package-manager state.

## Deferred Behaviors

Fixture evidence should describe deferred behavior without implying it exists. Public registry hosting, package
publication, generated token writers, package-manager dependency writes, broad update/merge behavior, strict eject
behavior beyond lockfile-only ownership transfer, strict dependency cleanup or package-manager removal, strict orphan
cleanup beyond the opt-in dry-run-approved registry item cleanup path, and Waveguide validation remain separate
approval-gated lanes.
