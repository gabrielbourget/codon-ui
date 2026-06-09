# CLI Baseline Contract

## Purpose

This document defines the starting contract for renovating `packages/CLI` before changing command behavior.

The CLI is still legacy scaffold. It can stay useful as reference material, but it should not decide registry install
policy, source ownership, component update behavior, package publication, or generated artifact shape before the first
component proof is ready.

## Graduated Reference

Stable CLI guidance has moved into the docs site:

- `apps/docs/src/content/docs/cli/baseline-contract.md`
- `apps/docs/src/content/docs/cli/consumer-lifecycle.md`
- `apps/docs/src/content/docs/registry/local-snapshots.md`

Keep this roadmap focused on remaining lifecycle behavior such as dependency cleanup writes outside explicit strict
`remove`/`delete --with-orphans --remove-dependencies`, broad strict update behavior, merge behavior, broader
eject policy, non-orphan support cleanup, public registry hosting, and package publication.

## Current Status

Current command surface:

| Command | Current role                                                                                                                       | Renovation read                                                                                                                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`  | Detects project shape, writes `amino-ui.config.json`, creates target paths, writes helper support, and installs base dependencies. | Legacy normal mode remains mutating; `init --advisory` reports the new consumer contract, `init --dry-run` previews the default seed without writes, and `init --defaults` seeds only the new config/lockfile contract. |
| `info`  | Reports consumer project context and the same init advisory packet.                                                                | Read-only JSON output is available for fixture checks and future agent passes.                                                                                                                                          |
| `add`   | Fetches component/helper registry JSON, writes files, transforms imports/RSC markers, and installs dependencies.                   | Legacy normal mode remains mutating for other inputs; `add switch` now has a strict local-registry proof path after advisory and dry-run review.                                                                        |
| `diff`  | Fetches registry files and prints local file differences.                                                                          | First advisory diagnostics slice is implemented, but normal mode still depends on legacy artifact shape.                                                                                                                |

Current helper surface:

| Area                    | Current role                                                                                   | Renovation read                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Config                  | Loads `amino-ui.config.json`, infers paths from `tsconfig-paths`, and resolves aliases.        | Keep, but convert failures into typed diagnostics before command behavior expands.                                     |
| Registry client         | Fetches JSON from `COMPONENT_REGISTRY_URL` or `https://aminoui.com`.                           | Defer behavior changes until generated artifact policy is approved. Add timeouts/advisory behavior before machine use. |
| Registry schemas        | Parses component/helper registry indexes.                                                      | Legacy web-registry schemas still exist; new install-plan schemas model support registry snapshots separately.         |
| Local registry snapshot | Stores support-only and full React manifest-shaped JSON sources for early CLI planning.        | Proves support graph and `Switch` planning/install without public registry hosting or generated artifacts.             |
| Install plan resolver   | Resolves requested registry items, support graph dependencies, target paths, and dependencies. | Support and `Switch` planning now classify target package metadata for default `registry-contained` layout.            |
| File transforms         | Rewrites imports, removes `"use client"` for non-RSC projects, and converts TS/TSX to JS/JSX.  | Needs fixture tests before any behavior changes.                                                                       |
| Package manager helpers | Computes add commands and dev-dependency flags.                                                | Keep as a small leaf, but do not execute package-manager commands in advisory mode.                                    |

## Advisory Mode Requirement

Future CLI renovation should add an advisory-only run mode before expanding install/update behavior.

Canonical flag:

```text
--advisory
```

The flag should be accepted consistently by every command once that command is renovated. Command-specific aliases such
as `--report-only` can be considered later, but `--advisory` is the shared contract.

Advisory mode means:

- Expected environmental, config, registry, dependency, filesystem, or project-shape issues are reported as diagnostics
  instead of thrown as blocking errors.
- The command exits `0` for expected findings so it can run inside larger scripts, CI comments, preflight checks, editor
  integrations, or background audits without slowing or failing unrelated work.
- The command avoids package installation, file writes, config writes, lockfile mutations, and directory creation.
- The command skips or timeboxes expensive network, package-manager, and full-project scans unless a later explicit flag
  opts into slow checks.
- The command prints enough detail for a human to act, but does not require follow-up prompts.
- Unexpected programming errors can still be surfaced for debugging, but advisory user-facing behavior should remain
  non-blocking whenever the process can produce a coherent diagnostic report.

Advisory mode is not the same as dry-run:

| Mode                      | Meaning                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `--advisory`              | Non-blocking diagnostics. Avoid mutations and downgrade expected findings to warnings.           |
| `--dry-run`               | Preview an intended mutation. Stays non-mutating, but can report would-apply blockers/effects.   |
| Future default apply mode | Mutate files or install packages only after command contracts, manifests, and tests are settled. |

## Command Advisory Expectations

| Command                    | Advisory behavior before apply behavior expands                                                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `init --advisory`          | Detect project type, config presence, alias support, planned paths, and base dependency needs. Never write config, create directories, append helper files, or install dependencies. Unsupported projects report warnings and exit `0`.                                                                |
| `add --advisory`           | Resolve requested component ids against the registry when available, report planned files, dependencies, overwrites, and missing support. Never write source files, append helper files, create directories, or run package-manager commands. Registry unavailability reports a warning and exits `0`. |
| `diff --advisory`          | Report missing config, missing registry, missing component, and file drift without hard exits. Prefer component-scoped checks first; all-component scans should be timeboxed or explicitly opted into if they become slow.                                                                             |
| Future `status --advisory` | Read install metadata and report drift without failing broader processes.                                                                                                                                                                                                                              |
| Future `update --advisory` | Report update availability and blockers only. No writes.                                                                                                                                                                                                                                               |
| Future `eject --advisory`  | Report which files would become consumer-owned. No metadata mutation.                                                                                                                                                                                                                                  |

## Baseline Risks

Do not broaden behavior before these risks are handled deliberately:

- `add` and helper file processing use async `forEach` without awaiting child work.
- `add` and `init` can write files and run package-manager installs in the same command path.
- `diff` is read-only in intent but uses `process.exit(1)` for ordinary missing-config, missing-registry, and
  missing-component cases.
- The registry client has no timeout or advisory fallback.
- The current registry schema is legacy web-registry shape, not the approved `packages/react` manifest/artifact contract.
- Transform helpers have no fixture tests.
- `bin` aliases point to `dist/index.js`; fresh installs can warn or fail before build output exists.
- `pub:*` scripts call `npm build` and publication behavior is not approved.
- Current command names and options are inherited scaffold surface, not settled public API.

## First Safe Implementation Sequence

1. Add a tiny CLI diagnostic/result helper that can represent `info`, `warning`, and `error` without immediately exiting.
2. Add a shared `--advisory` option parser and a command context type.
3. Convert `diff` to use advisory diagnostics first, because it is closest to read-only.
4. Add fixture tests for config loading, registry schema parsing, package-manager helper output, and file transforms.
5. Add advisory preflight paths for `init` and `add` without enabling new apply behavior.
6. Decide install metadata shape before implementing `status`, `update`, or ejection behavior.

## Implementation Notes

The first implementation slice added shared command context and diagnostic helpers, then wired `diff --advisory`.

Current `diff --advisory` behavior:

- Reports missing `cwd`, missing config, missing registry, missing component, and missing registry payload as warnings.
- Exits `0` for those expected findings.
- Suppresses lower-level raw registry fetch logging for advisory registry requests.
- Uses a five-second registry fetch timeout so advisory checks do not stall broader processes indefinitely.
- Does not write files, create directories, install packages, mutate lockfiles, or prompt.

Normal `diff` behavior remains strict.

The next cleanup slice normalized Commander option parsing for `init`, `add`, and `diff` so each command maps external
flag names into its internal option shape in one place. It also made the current `add` command await component file
writes, nested directory writes, helper writes, and dependency installs in sequence. That does not make `add` proof-ready;
it only removes accidental async behavior before the command contract is redesigned.

The consumer contract slice added the first new CLI-side contract for the `Switch` proof path:

- `amino-ui.config.json` remains the human-authored setup intent file.
- `amino-ui.lock.json` is reserved as the generated install provenance file.
- `registry-contained`, `integrated`, and `custom` layout modes are modeled, but only `registry-contained` has path
  resolution behavior.
- The default `registry-contained` layout resolves support roles under `src/components/_registry`.
- The default dependency policy is `report-only`.
- Ownership states are modeled as `registry-owned`, `locally-modified`, `consumer-owned-support`, `ejected`, and
  `unknown`.

Current read-only command behavior:

```sh
aminoui-cli init --advisory --json --cwd <consumer-project>
aminoui-cli init --dry-run --json --cwd <consumer-project>
aminoui-cli info --json --cwd <consumer-project>
```

The package also exposes `aui` as a shorter bin alias for future command examples. Existing local pnpm shims may need an
install refresh before `pnpm exec aui` resolves, but package metadata now points both `aminoui-cli` and `aui` at
`dist/index.js`.

The first strict init seed slice added a new-contract default path:

```sh
aui init --defaults --json --cwd <consumer-project>
```

This path writes only `amino-ui.config.json` and an empty `amino-ui.lock.json` when neither file exists. It does not
create directories, install dependencies, write helper files, install support files, or touch package-manager lockfiles.
If either file already exists, it reports warnings and writes nothing; overwrite policy is deferred.

`init --dry-run --json` previews that same strict default seed without writing. Its actual effects always report no
config, lockfile, directory, or dependency writes. Its `wouldEffects` report `would-write` for greenfield config and
lockfile creation, `blocked` for existing files, and `not-written` for the counterpart in partial existing-file states.

Against the `vite-registry-contained` fixture, both commands report:

- package manager: `pnpm`
- project kind: `vite-like`
- layout mode: `registry-contained`
- theme tier: `default-contract`
- dependency policy: `report-only`
- role paths under `src/components/_registry`

These commands do not write config, lockfiles, support files, directories, or dependencies.

The support-item add advisory slice added the first read-only registry planning path:

- A local support-only registry source at `packages/CLI/registry/local-react-support.registry.json`.
- A local registry snapshot contract check that verifies the tracked support JSON still matches the support/theme subset
  of `packages/react/src/registry/manifest.ts`.
- A read-only local registry source reader.
- An install-plan resolver for requested registry items, graph dependencies, resolved target files, and dependency
  summaries.
- `add --advisory --json` support-item output.
- Read-only source payload status for planned files: `available` when the declared source file can be read and `missing`
  when it cannot.
- Computed source `contentHash` values using `sha256:<hex>` for available source files.
- Read-only target status for planned files: `missing` when the target does not exist and `existing` when a consumer file
  already occupies the target path.
- Missing source findings using `source-file-missing` warnings. These make strict install readiness visible without
  turning advisory mode into a failing command.
- Existing target findings using `target-file-exists` warnings. These remain advisory findings and do not make the
  command write files or exit non-zero.

Current support advisory commands:

```sh
aminoui-cli add tokens/geometry --advisory --json --cwd <consumer-project>
aminoui-cli add --all --advisory --json --cwd <consumer-project>
```

The local support snapshot currently covers `theme-css`, `theme/switch-compatibility`, `tokens/geometry`, and
`tokens/theme-order`. Against the `vite-registry-contained` fixture, planned files resolve under
`src/components/_registry`. Fixture assertions now verify that `tokens/geometry` is reported as a missing target in the
default fixture, `theme-css` is reported as an existing target in the `--all` support plan, the narrow
`theme/switch-compatibility` bridge is available as a planned theme file, and an explicit existing-token fixture reports
an existing `tokens/geometry` target. They also verify available source status, `sha256:<hex>` content hashes, missing
source warnings from a fixture registry source, and no-mutation behavior. This is not strict writes, config writing,
lockfile writing, dependency installation, generated registry artifact hosting, update/ejection classification, or
package publication behavior.

The snapshots are still tracked JSON, not generated output. Until a later generator pass exists,
`pnpm -F @amino-ui/react check:local-registry-snapshot` fails if the support snapshot drifts from the support/theme subset
or if the full local React snapshot drifts from the canonical React manifest.

The local `Switch` registry source slice removed the draft append path:

- A full local React registry source now lives at `packages/CLI/registry/local-react.registry.json`.
- `add switch --advisory --json` selects that full local registry source by default when `switch` is explicitly
  requested.
- `add --all --advisory --json` stays support-only for now and continues to use
  `packages/CLI/registry/local-react-support.registry.json`.
- The packet data at `packages/react/src/registry/switch-ingest-packet.data.json` still provides metadata such as public
  exports, import rewrites, exclusions, theme requirements, and verification notes.
- The component packet status is now `local-registry`, not `draft-only`.
- The plan resolves `theme-css`, `theme/switch-compatibility`, `tokens/geometry`, `tokens/theme-order`, and received
  `Switch` runtime files under the default `registry-contained` layout.
- Runtime `Switch` source files report `available`; the optional focused test is metadata-only until the
  component-library testing work area.
- React Aria Components is classified as a `^1.17.0` peer requirement and `classnames` as a `^2.3.2` runtime
  requirement. If a target repo already declares compatible ranges, the advisory plan reports `satisfied` and takes no
  package action.
- Focused-test package versions are no longer declared in the packet; the testing dependency decision is deferred until
  the package-side proof harness exists.
- Advisory effects report no file writes, config writes, lockfile writes, or dependency installs; lockfile output is
  planned metadata only.

Current `Switch` advisory command:

```sh
aui add switch --advisory --json --cwd <consumer-project>
```

The first `Switch` dry-run slice now uses the same local React registry source and packet metadata, but reports
would-apply effects instead of advisory-only effects:

- `add switch --dry-run --json` stays non-mutating: no file writes, config writes, lockfile writes, dependency installs,
  prompts, or directory creation.
- Missing `amino-ui.config.json` is a warning for now. The command uses the default `registry-contained` paths so the
  first fixture can preview exact writes before strict `init` exists.
- Existing target files are counted as blockers in `effects.files.blockedExistingTargetCount`; the current fixture has
  one blocker for `src/components/_registry/theme.css`.
- `effects.files.wouldWriteCount` counts available-source files that do not already exist.
- `effects.dependencies` summarizes satisfied, missing, incompatible, unresolved, and decision-required dependency
  entries without modifying package metadata.
- `effects.lockfile.status` reports `would-write` to distinguish dry-run from advisory `not-written` effects.

Current `Switch` dry-run command:

```sh
aui add switch --dry-run --json --cwd <consumer-project>
```

The first strict `Switch` install slice now consumes the same local React registry source after the consumer has run
strict init:

```sh
aui init --defaults --json --cwd <consumer-project>
aui add switch --json --cwd <consumer-project>
```

This strict path currently supports only the explicit `switch` request. It reads `amino-ui.config.json` and
`amino-ui.lock.json`, requires the default dependency graph to be already satisfied, rejects missing source files,
rejects existing target files rather than overwriting, writes the seven planned support/theme/component files, rewrites
package-local token imports to the installed consumer registry token paths, and updates `amino-ui.lock.json` with
hash-based item/file ownership metadata plus satisfied dependency decisions. It does not install or update packages,
generate hosted registry artifacts, run component tests, or implement status/update/eject behavior.

Later lifecycle slices added item-scoped `status`, `diff`, `update`, `remove`, `delete`, and `eject` behavior behind
fixture evidence. `update --all --advisory --json` now enumerates every installed item and aggregates item-scoped update
posture, and `update --all --dry-run --json` now aggregates item-scoped dry-run previews without opening broad strict
update writes. `remove` and `delete` now also accept `--with-orphans` to
report dependency items that would become orphan cleanup candidates in advisory and dry-run modes, then remove
dry-run-approved orphan dependency items in strict temporary-copy proofs. The orphan plan and effects live in a separate
`orphanCleanup` report block. Advisory and dry-run also report a separate no-write `dependencyCleanup` block that
classifies package dependency cleanup candidates and dependencies still required by remaining installed items. Fixture
evidence now covers the blocked path where a modified orphan item keeps dependencies still-required, suppresses dry-run
dependency removals, and blocks strict cleanup atomically. Strict orphan cleanup remains opt-in. `--remove-dependencies`
adds a second explicit strict gate that can remove no-longer-required package dependencies through the detected npm,
pnpm, yarn, or bun command and clean stale Amino dependency records. Cleanup outside that explicit path, non-orphan
support cleanup, and broad deletion policy remain deferred.

## Design Discussion Packet

This packet is an agenda for the next CLI design conversation, not approval to implement the behaviors below.

Reference inputs from the Wavemap roadmaps:

- The extraction roadmap frames the component-library CLI as declarative rather than investigative: registry metadata
  should tell the CLI what to install, track, diff, update, and eject.
- The extraction roadmap's delete-and-reinstall proof expects Wavemap to remove a local component slice, rehydrate it
  from the library surface, and verify the app with reviewable diffs.
- The polish roadmap keeps `Switch` as the first proof candidate, but only after package-safe imports, CSS-module support,
  theme delivery, peer/runtime policy, and focused tests are decided.
- Both roadmaps keep generated token output, broad theme generation, publication automation, and open-ended CLI behavior
  outside the first proof.

Topics to settle before real `init` or `add` implementation expands:

| Topic                       | Discussion target                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme integration tiers     | Decide which tiers the CLI can report or install: package default CSS, narrow proof-local bridge, consumer-owned mapping, and later generated token output.                   |
| Install metadata            | Decide whether the consumer ledger lives in `amino-ui.config.json`, a sidecar file, or both, and whether it records file hashes, registry item ids, versions, and theme tier. |
| Source ownership states     | Define `registry-owned`, `locally modified`, `ejected`, `consumer-owned support`, and `unknown` before update/status commands exist.                                          |
| Update behavior             | Decide which states are eligible for automatic update, which require manual merge, and which should never be changed by the CLI.                                              |
| Registry artifact authority | Decide whether `add` consumes generated JSON artifacts, package-local manifests, or an explicit proof file list for the first `Switch` case.                                  |
| Dependency policy           | Decide whether command output installs peer/runtime packages, reports missing packages, or defers to project package managers during the first proof.                         |
| Verification surface        | Decide the minimum fixture tests and command smokes needed before `init`, `add`, `status`, `update`, or `eject` become trusted behavior.                                      |

Recommended starting theme tiers for discussion:

| Tier | Name                         | CLI posture before first proof                                                                                            |
| ---- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0    | Package default CSS          | Report or install `@amino-ui/react/theme.css` as the baseline import. No generated tokens.                                |
| 1    | Narrow compatibility bridge  | For the first `Switch` proof only, install or report the small bridge that maps the current required compatibility names. |
| 2    | Consumer-owned theme mapping | Detect and report that the consumer owns the mapping. Do not overwrite without explicit approval.                         |
| 3    | Generated theme output       | Defer. The CLI may eventually generate palette/theme files, but that is not part of the first proof.                      |

Recommended starting ownership states for discussion:

| State                    | Meaning                                                                                  | Update stance                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `registry-owned`         | Installed file hash still matches the recorded registry payload.                         | Eligible for automatic update after update behavior is approved.           |
| `locally-modified`       | File was installed by the registry but now differs from the recorded install hash.       | Show diff and require manual merge or explicit overwrite.                  |
| `ejected`                | Consumer intentionally took ownership of the file or component slice.                    | Never auto-update. Registry can still show upstream changes for reference. |
| `consumer-owned-support` | Theme bridge, mapping, or support file is intentionally maintained by the consumer repo. | Validate/report presence and drift, but do not overwrite by default.       |
| `unknown`                | File exists at a target path without matching install metadata.                          | Treat as a blocker in strict apply mode and a warning in advisory mode.    |

Minimum command direction before the first `Switch` proof:

- `init --advisory` should report config presence, target paths, package manager, theme tier candidates, and missing
  peer/runtime packages without writing files or running installs.
- `add --advisory Switch` should resolve the planned component graph, support files, theme tier, dependencies, and
  overwrite conflicts without writing files or running installs.
- `add --dry-run Switch` should preview the exact write set, overwrite blockers, dependency decisions, and lockfile shape
  before strict mutation exists.
- The first strict `add Switch` path should stay limited to the satisfied-dependency, no-existing-target proof path until
  dependency prompts, overwrite policy, and update/eject metadata are designed.
- `status`, `update`, and `eject` should wait until the metadata ledger exists; otherwise the CLI cannot distinguish
  registry-owned source from consumer-owned edits.

## Stop Conditions

Return to deliberate planning if CLI work requires:

- Changing registry artifact shape.
- Broadening component install/update/diff behavior beyond the explicit `Switch` proof path.
- Moving Wavemap component source.
- Adding React Aria, `classnames`, Vitest, Testing Library, or other first-proof dependencies.
- Deciding package publication, release automation, or `bin` distribution policy.
- Implementing generated token writers or CLI palette generation.
- Mutating consumer projects outside an advisory/preflight path.

## Verification Expectations

For this docs-only baseline:

- `pnpm check`
- `pnpm build:docs`
- `git diff --check`

For future CLI implementation:

- Focused CLI typecheck/build:

```sh
pnpm -F aminoui-cli typecheck
pnpm -F aminoui-cli build
```

- Full CI mirror after behavior or package metadata changes:

```sh
pnpm verify:ci
```
