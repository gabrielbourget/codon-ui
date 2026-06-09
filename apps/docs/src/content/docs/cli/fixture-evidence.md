---
title: Fixture Evidence
description: Proof packets for Amino UI CLI command behavior.
---

The fixture repo records command behavior evidence for Amino UI consumers. It is not canonical component source and it is
not a replacement for Wavemap mature-consumer proof. Its job is to make CLI behavior systematic, repeatable, and
assertable.

The fixture system has three tiers:

- seed fixtures: checked-in consumer projects that represent known starting or classification states;
- replay proofs: focused verifier gates that replay CLI workflows against temporary fixture copies;
- evidence ledger: Markdown evidence plus the structured `evidence/proof-ledger.mjs` index, validated by
  `pnpm verify:evidence-ledger`.

Checked-in workflow fixtures demonstrate state. Replay proofs demonstrate current CLI compliance on demand. Markdown
evidence explains the results, but verifier assertions are the proof.

The structured ledger validates canonical command and scenario names, rejects unsupported coverage claims, permits only
explicitly justified duplicate coverage, and reports known gaps without failing because gaps remain open.

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
pnpm verify:evidence-ledger
pnpm verify:json-contracts
pnpm verify:init-dry-run
pnpm verify:init-lifecycle
pnpm verify:add-lifecycle
pnpm verify:strict-add-blockers
pnpm verify:compatible-support-reuse
pnpm verify:add-dependency-boundary
pnpm verify:dependency-install-plan
pnpm verify:dependency-policy
pnpm verify:dependency-execution-eligibility
pnpm verify:dependency-execution
pnpm verify:dependency-execution-failure
pnpm verify:dependency-workspace-commands
pnpm verify:dependency-workspace-execution
pnpm verify:dependency-target-resolution
pnpm verify:dependency-out-of-band-resolution
pnpm verify:status
pnpm verify:diff
pnpm verify:update-advisory
pnpm verify:update-all-advisory
pnpm verify:update-dry-run
pnpm verify:strict-update
pnpm verify:update-dependency-execution
pnpm verify:update-dependency-execution-failure
pnpm verify:remove-advisory
pnpm verify:remove-dry-run
pnpm verify:strict-remove
pnpm verify:remove-orphans
pnpm verify:dependency-cleanup-execution
pnpm verify:delete
pnpm verify:eject-advisory
pnpm verify:eject-dry-run
pnpm verify:strict-eject
pnpm verify:wavemap-like-lifecycle
```

## Proof Packet

Each command proof should record the same fields so future lifecycle commands can be compared without reading long run
logs.

| Field                      | Expected evidence                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture name               | Stable fixture or scenario name, such as `vite-registry-contained` or a locally modified variant.                                        |
| Starting state             | Config, lockfile, package metadata, existing target files, and known ownership states.                                                   |
| Command invocation         | Exact command, flags, cwd, and registry source.                                                                                          |
| JSON assertion             | Checked fields in stdout JSON, including findings, effects, file counts, and dependency decisions.                                       |
| File mutation boundary     | Which files must remain unchanged, which files may be written, and which existing targets must block.                                    |
| Lockfile mutation boundary | Whether the lockfile is not written, would be written, or was written with expected item/file metadata.                                  |
| Dependency boundary        | Proof that package manifests and package-manager lockfiles are preserved or intentionally changed only by approved dependency execution. |
| Dependency policy          | Effective dependency policy, source, override, and explicit no-execution posture.                                                        |
| Dependency execution       | Explicit install intent, approval source, noninteractive eligibility, blockers, and no execution.                                        |
| Dependency install plan    | Read-only package-manager detection and proposed install commands when required packages are missing.                                    |
| Dependency target          | Target package manifest, working directory, package-manager override, and no-write override provenance.                                  |
| Dependency resolution      | Consumer-owned package manifest resolution outside the CLI before a later strict add succeeds.                                           |
| Verification after install | Compile, typecheck, or smoke command when the fixture receives source.                                                                   |

## Command Expectations

Use the same evidence shape across the current and planned CLI lifecycle.

| Command mode                                         | Fixture expectation                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init --advisory --json`                             | Reports project shape, default config, theme tier, role paths, and policy without writes.                                                                                                                                                                                                                   |
| `init --dry-run --json`                              | Reports no actual writes plus config and lockfile would-effects for greenfield and existing-file blocker cases.                                                                                                                                                                                             |
| `init --defaults --json`                             | Writes only `amino-ui.config.json` and an empty `amino-ui.lock.json` when both are absent.                                                                                                                                                                                                                  |
| `add --advisory --json`                              | Reports graph, source availability, target status, dependencies, and not-written lockfile effects.                                                                                                                                                                                                          |
| `add --dry-run --json`                               | Reports the exact would-write shape, blockers, dependency counts, and would-write lockfile effects.                                                                                                                                                                                                         |
| Strict `add <item> --json`                           | Writes approved source/support/theme files plus lockfile metadata when blockers are absent or explicit dependency installs succeed; focused lifecycle proof follows strict init through post-add status/diff, existing-target blockers, compatible support reuse/adoption, and missing dependency blockers. |
| `status --json`                                      | Classifies installed graph, local edits, source freshness, dependency posture, and ownership without writes for proven cases.                                                                                                                                                                               |
| `diff --json`                                        | Compares one registry item against installed files without mutating source, lockfile, config, or dependency state.                                                                                                                                                                                          |
| `update --advisory --json`                           | Reports available changes, blockers, ownership states, dependency posture, and no-write effects.                                                                                                                                                                                                            |
| `update --all --advisory --json`                     | Enumerates every installed item, aggregates item-scoped advisory states, and preserves source, lockfile, config, and dependency state.                                                                                                                                                                      |
| `update --dry-run --json`                            | Previews exact item-scoped writes, lockfile-only updates, skips, blocks, and lockfile effects without writing.                                                                                                                                                                                              |
| `update --all --dry-run --json`                      | Enumerates every installed item, aggregates item-scoped dry-run would-effects, blockers, and lockfile effects without writing.                                                                                                                                                                              |
| Strict `update <item> --json`                        | Writes only dry-run-approved source files and lockfile records; preserves unsafe files and can run explicitly approved dependency installs for dependency-only blockers.                                                                                                                                    |
| `remove --advisory --json`                           | Reports removable files, lockfile-cleanup candidates, blockers, ownership states, shared references, and no-write effects.                                                                                                                                                                                  |
| `remove --dry-run --json`                            | Previews item-scoped file deletion, lockfile-record cleanup, skips, blocks, and lockfile effects without writing.                                                                                                                                                                                           |
| Strict `remove <item> --json`                        | Deletes only dry-run-approved registry-owned component files and lockfile records in temporary-copy proofs.                                                                                                                                                                                                 |
| `remove/delete --with-orphans`                       | Reports no-write orphan and dependency cleanup candidates, then proves strict temp-copy cleanup for eligible registry dependency items.                                                                                                                                                                     |
| `remove/delete --with-orphans --remove-dependencies` | Proves explicit strict package dependency cleanup for eligible orphan cleanup candidates while preserving still-required dependencies and local adapters.                                                                                                                                                   |
| `delete <item>` sibling                              | Proves advisory, dry-run, and strict command-line parity with the same remove report schema and mutation boundaries.                                                                                                                                                                                        |
| `eject --advisory --json`                            | Reports ownership-transfer candidates, already-ejected files, blockers, ownership states, shared references, and no-write effects.                                                                                                                                                                          |
| `eject --dry-run --json`                             | Previews item-scoped lockfile ownership transfer, skips, blocks, and lockfile effects without writing.                                                                                                                                                                                                      |
| Strict `eject <item> --json`                         | Transfers only dry-run-approved lockfile ownership records to `ejected`; source files and dependencies are not mutated.                                                                                                                                                                                     |
| Future lifecycle expansion                           | Must preserve modified, consumer-owned-support, unknown, and ejected files unless explicitly approved.                                                                                                                                                                                                      |

## Fixture Matrix

Grow fixture coverage by scenario, not by one-off command notes.

| Scenario                  | What it proves                                                                                                                                                                                                    |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenfield default        | `init` advisory/dry-run/default behavior, config/lockfile-only writes, uninitialized `status --json`, and initialized-empty `status --json`.                                                                      |
| Clean registry-contained  | `add` advisory, dry-run, strict writes, post-add status/diff, lockfile metadata, and compile behavior.                                                                                                            |
| Existing unknown targets  | Strict writes block rather than overwrite unknown local files.                                                                                                                                                    |
| Compatible support reuse  | Existing support is reused only when metadata and content are safe.                                                                                                                                               |
| Locally modified files    | `status` and `diff` report local edits; future lifecycle commands must preserve them by default.                                                                                                                  |
| Consumer-owned support    | Compatible support can be validated/reused without becoming registry-overwritten.                                                                                                                                 |
| Ejected files             | Ejected items stay visible for status/diff but are not mutated.                                                                                                                                                   |
| Missing dependencies      | Advisory and dry-run classify dependency posture; strict add blocks when requirements are missing, and item-scoped strict update can resolve dependency-only blockers after explicit dependency install approval. |
| Broad update advisory     | `update --all --advisory --json` enumerates installed items and aggregates update posture without writes.                                                                                                         |
| Broad update dry-run      | `update --all --dry-run --json` enumerates installed items and aggregates dry-run would-effects without writes.                                                                                                   |
| Dependency policy         | `add` reports dependency policy from default, config, and CLI override sources without package-manager writes.                                                                                                    |
| Dependency execution      | `add` reports explicit install intent and eligibility without running package-manager writes.                                                                                                                     |
| Dependency strict run     | Strict `add` executes fixture-local fake npm/pnpm/yarn/bun only after explicit approval, then replans.                                                                                                            |
| Dependency failure        | Strict `add` returns structured package-manager failure output and blocks Amino source/lockfile writes.                                                                                                           |
| Dependency install plan   | Missing dependency reports propose npm, pnpm, yarn, and bun commands without running package-manager writes.                                                                                                      |
| Dependency workspace      | Nested workspace targets report workspace context and npm/pnpm/yarn/bun command details without package-manager writes.                                                                                           |
| Dependency workspace run  | Strict `add` executes npm/pnpm/yarn/bun workspace commands and replans from the nested target manifest.                                                                                                           |
| Dependency target         | `add` reports target package manifests, override provenance, and command working directories without package-manager writes.                                                                                      |
| Dependency out-of-band    | Consumers can satisfy reported dependencies outside the CLI before strict add, including `--package-json` targets.                                                                                                |
| Dependency cleanup run    | Strict `remove`/`delete --with-orphans --remove-dependencies` executes npm/pnpm/yarn/bun removal commands for eligible cleanup candidates.                                                                        |
| Update dependency run     | Item-scoped strict `update` executes npm/pnpm/yarn/bun install commands only for dependency-only blockers after explicit approval, then replans before source and lockfile writes.                                |
| Update dependency failure | Item-scoped strict `update` returns structured package-manager failure output and blocks Amino source/lockfile writes before and after package boundary mutations.                                                |
| JSON contract validation  | Representative lifecycle reports parse through compiled Amino CLI canonical Zod schemas, including shared dependency install plans, failed dependency commands, and lockfile output when present.                 |
| Snapshot/source drift     | Planner output reports stale or missing registry source clearly.                                                                                                                                                  |
| Mature-consumer shape     | A Wavemap-like graph can be tested without using the full Wavemap repo for every CLI regression.                                                                                                                  |

The current mature-consumer fixture is `wavemap-like-typeahead-lifecycle`. It installs the registry-owned
`typeahead-search` graph and keeps app-owned artist wrapper, API query, route/query state, typeahead controller, local
labels, and focused test files outside `amino-ui.lock.json`. Its focused gate proves status, diff, update, remove/delete,
eject, and temp-copy typecheck/build behavior against that mixed graph.

The `pnpm verify:json-contracts` gate validates representative CLI JSON output through the compiled
`packages/CLI/dist/contracts.js` schemas before command-specific behavioral assertions inspect fields. The source contract
surface lives in `packages/CLI/src/contracts.ts` and re-exports stable report schemas for init, add, status, diff,
update, remove/delete, and eject command families without invoking the CLI executable entrypoint. The fixture gate imports
that compiled contract surface and validates the representative cases by canonical schema key: `initDryRun`, `status`,
`diff`, `addDryRun`, `initStrict`, `addStrict`, `updateAllDryRun`, `updateStrict`, `removeDryRun`, and `ejectDryRun`.

The same gate also validates shared dependency install plans, failed dependency commands, and lockfile output through
canonical schema exports when those structures are present. It covers init dry-run, status, diff, add dependency planning,
strict add lockfile output, broad update dry-run aggregation, strict update dependency failure output, remove dry-run, and
eject dry-run. This gate hardens output shape for already proven lifecycle behavior; it does not grant new write
authority.

## JSON Contract Maintenance

`packages/CLI/src/contracts.ts` is the canonical source for internal CLI JSON report schemas. Keep command output,
fixture assertions, and source-side tests pointed at that schema map instead of re-declaring report shapes in each proof.

When a lifecycle report shape changes:

1. Update the canonical schema and exported type surface in `packages/CLI/src/contracts.ts`.
2. Add or update representative Amino CLI command-test coverage with `assertCliJsonReportContract` from
   `packages/CLI/src/testUtils/cliJsonContracts.ts`.
3. Rebuild the CLI package before fixture contract proofs that import `packages/CLI/dist/contracts.js`.
4. Update the fixture repo's `pnpm verify:json-contracts` coverage when the externally observed report shape changes.
5. Keep behavioral assertions alongside schema assertions so a report can be both structurally valid and semantically
   checked.

The source-side command tests catch drift before the package is compiled. The fixture gate catches drift in the compiled
consumer-facing contract surface. Both checks are required for report shapes that future lifecycle automation or
consumer tooling will rely on.

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

The `pnpm verify:dependency-policy` gate proves the policy reporting scaffold. It checks default `report-only` policy,
config policy values, `--dependency-policy` overrides, `report-only`, `manual`, `prompt`, and `install` mode parsing, and
strict missing-dependency blocking while every policy mode keeps package-manager execution disabled.

The `pnpm verify:dependency-execution-eligibility` gate proves install intent stays separate from policy. It checks
`--install-dependencies`, JSON/noninteractive prompt blocking, install-policy-plus-approval eligibility in dry-run output,
and explicit `not-needed` output when dependencies are already satisfied while every case keeps package-manager execution
disabled.

The `pnpm verify:dependency-execution` gate proves the approved strict path. It uses temporary fake npm, pnpm, yarn, and
bun binaries, proves advisory/dry-run and mixed-blocker cases do not execute, runs strict add with explicit install
approval, replans from the mutated temp package manifest, and records installed dependency actions.

The `pnpm verify:dependency-execution-failure` gate proves the failed strict path. It uses a temporary fake pnpm binary
that can fail before package writes or after mutating `package.json` plus `pnpm-lock.yaml`. Both cases return structured
`failedCommands` output, report `dependencyInstallPlan.status: "failed"`, and block Amino source and lockfile writes.

The `pnpm verify:dependency-install-plan` gate proves the companion read-only package-manager plan. It checks unknown
package-manager state, `packageManager` metadata detection, lockfile fallback detection, npm/pnpm/yarn/bun command
recommendations, and empty `recommendedCommands` when the package manager is unknown. The gate uses temporary fixture
copies and executes no package-manager installs.

The `pnpm verify:dependency-workspace-commands` gate proves read-only workspace command planning. It creates a temporary
workspace root, targets a nested package manifest with `--package-json`, reports root package-manager provenance, and
records npm/pnpm/yarn/bun `workspaceCommand` details without package-manager execution or fixture mutation.

The `pnpm verify:dependency-workspace-execution` gate proves the approved strict workspace path. It executes fake npm,
pnpm, yarn, and bun workspace commands from the temporary workspace root, mutates the nested target `package.json`, writes
the package-manager lockfile at the workspace root, replans, and records installed dependency actions.

The `pnpm verify:dependency-target-resolution` gate proves read-only target manifest selection. It checks
`--package-json`, `--package-manager`, nested target manifests, upward lockfile detection, command `targetManifestPath`
and `workingDirectory`, satisfied target manifests, and override precedence. It uses temporary fixture copies and executes
no package-manager installs.

The `pnpm verify:dependency-out-of-band-resolution` gate proves the current consumer-owned dependency install path. It
starts from the missing-dependency fixture, updates only the temporary target `package.json` to simulate a consumer
installing `react-aria-components` and `classnames` outside the CLI, then proves advisory and dry-run reports are
satisfied and strict `add switch --json` succeeds without package-manager writes. The gate covers both the nearest
package manifest and `--package-json apps/web/package.json`.

The `pnpm verify:update-all-advisory` gate proves broad update advisory without broad write authority. It runs
`update --all --advisory --json` against the Wavemap-like fixture, asserts every installed item is represented with an
item-scoped update state, checks aggregate candidate and blocker counts, and verifies source files, lockfile data,
package manifests, package-manager lockfiles, and local adapter files remain unchanged.

The `pnpm verify:update-all-dry-run` gate proves broad update dry-run as the strict-all planning gate. It runs
`update --all --dry-run --json` against the Wavemap-like fixture, asserts every installed item is represented with an
item-scoped dry-run state, checks aggregate would-write, lockfile-only, skipped, blocked, dependency, and blocker counts,
and verifies source files, lockfile data, package manifests, package-manager lockfiles, and local adapter files remain
unchanged.

The `pnpm verify:update-all-strict` gate proves atomic broad strict update behavior. It runs `update --all --json` in
temporary fixture copies, asserts mixed unsafe items block the whole run without mutation, asserts mature Wavemap-like
installs return a no-op report, and asserts an all-safe update candidate writes only the approved source file plus
`amino-ui.lock.json`. Runtime rollback, merge behavior, dependency writes, and package-manager mutation remain outside
this proof.

The `pnpm verify:update-dependency-execution` gate proves item-scoped strict update dependency execution. It starts from
temporary update-candidate fixture copies, removes only the required package dependency, proves dry-run install
eligibility without mutation, proves strict update still blocks without explicit install approval, then executes fake npm,
pnpm, yarn, and bun installs before replanning and writing the approved source file plus `amino-ui.lock.json`. Broad
update dependency writes, dependency removals, and mixed-blocker dependency mutation remain outside this proof.

The `pnpm verify:update-dependency-execution-failure` gate proves item-scoped strict update dependency failure handling.
It uses a temporary fake pnpm binary that fails before package writes and after mutating `package.json` plus
`pnpm-lock.yaml`. Both cases return structured `failedCommands` output, report
`strict-update-dependency-execution-failed`, and block Amino source files plus `amino-ui.lock.json`.

The `pnpm verify:remove-orphans` gate uses the same fixture to prove `remove`/`delete --with-orphans` advisory,
dry-run, and strict temp-copy behavior. It verifies that the requested `typeahead-search` item remains item-scoped, that
orphaned registry dependency items appear in a separate `orphanCleanup` block, that registry-owned support files can be
planned and removed there, that package dependency cleanup candidates appear in a no-write `dependencyCleanup` block, and
that app-owned adapters remain outside both the lockfile and orphan cleanup report. The same gate mutates a temporary
orphan file to prove modified orphan items remain installed, keep their package dependencies `still-required`, suppress
dry-run dependency removals, and block strict cleanup atomically.

The `pnpm verify:dependency-cleanup-execution` gate proves the explicit strict cleanup path. It runs `remove` and
`delete --with-orphans --remove-dependencies` in temporary Wavemap-like fixture copies with fake npm, pnpm, yarn, and bun
binaries. The gate asserts package manifest removals, fake package-manager lockfile records, `dependencyCleanupExecution`
metadata, Amino lockfile dependency-record cleanup, delete parity, still-required dependency preservation, and
Wavemap-like local adapter preservation.

## Non-Mutation Rule

Advisory and dry-run fixture proofs must assert that no source files, config files, lockfiles, package manifests,
package-manager lockfiles, directories, or generated registry artifacts changed unless the command mode explicitly owns
that mutation.

Strict command proofs should assert the positive write set and the negative preservation set. A successful strict `add`
is not enough if it silently overwrites unknown targets, modified files, or package-manager state.

## Deferred Behaviors

Fixture evidence should describe deferred behavior without implying it exists. Public registry hosting, package
publication, generated token writers, package-manager dependency writes outside approved strict add and explicit strict
remove/delete orphan dependency cleanup, broad update rollback and merge behavior, strict eject behavior beyond
lockfile-only ownership transfer, dependency cleanup outside `--with-orphans --remove-dependencies`, strict orphan
cleanup beyond the opt-in dry-run-approved registry item cleanup path, and Waveguide validation remain separate
approval-gated lanes.
