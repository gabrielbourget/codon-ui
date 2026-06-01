---
title: CLI Baseline Contract
description: Current CLI renovation boundaries and advisory-mode policy.
---

The CLI is still legacy scaffold. It should be renovated as a separate lane before command behavior is trusted for
component extraction.

## Current Surface

| Command | Current state                                                                                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`  | Legacy normal mode still mutates config, helper files, directories, and dependencies. `init --advisory` is read-only; `init --defaults` seeds only the new config and lockfile.                |
| `info`  | Read-only project context and init advisory output are available through `info --json`.                                                                                                        |
| `add`   | Legacy normal mode remains for other inputs. `add --advisory --json` and `add switch --dry-run --json` plan the local-registry graph; strict `add switch --json` writes the first proof graph. |
| `diff`  | Reads local files and registry payloads. `diff --advisory` now reports expected missing inputs without failing.                                                                                |

None of these commands should become the first `Switch` proof mechanism until registry artifact policy, install metadata,
dependency policy, and tests are settled.

## Command Names

The package still publishes the existing `aminoui-cli` bin and now also exposes `aui` as the shorter command alias. Both
point at `dist/index.js`; package distribution policy remains separate from this alias.

## Advisory Mode

Future command work should add a shared `--advisory` mode.

Advisory mode should:

- report expected config, registry, dependency, filesystem, and project-shape issues as diagnostics;
- exit `0` for expected findings so larger scripts and background checks are not blocked;
- avoid file writes, config writes, directory creation, package installs, and lockfile changes;
- skip or timebox slow network, package-manager, and full-project scans unless explicitly requested.

`--advisory` is different from dry-run. Advisory mode is for non-blocking diagnostics. Dry-run previews approved mutation
shapes while still avoiding writes.

Current `diff --advisory` reports missing cwd, config, registry, component, and registry payload issues as warnings with
exit `0`. Advisory registry requests are quieted and timeboxed to avoid blocking broader processes.

Current `init --advisory --json` reports the proposed consumer config, package manager, project context, theme tier,
dependency policy, and role paths without writing files. The default `registry-contained` layout places support roles
under `src/components/_registry`.

Current `init --defaults --json` is the first strict new-contract seed path. It writes only `amino-ui.config.json` and an
empty `amino-ui.lock.json` when neither file exists. It does not create directories, write helper/support files, install
dependencies, or touch package-manager lockfiles. Existing config or lockfile files are reported as warnings and are not
overwritten.

Current `info --json` reports the same project context and init advisory packet for fixture checks and future automation.

Current `add --advisory --json` reads the local support registry snapshot and reports planned support files, source
status, target status, graph dependencies, and target package classification without writing files. Available source
files include `sha256:<hex>` content hashes; missing source files produce `source-file-missing` warning findings. Planned
files use `missing` or `existing` target status, and existing targets produce `target-file-exists` warning findings while
the command remains read-only and non-blocking.

When `switch` is explicitly requested, advisory mode reads `packages/CLI/registry/local-react.registry.json` for the
install plan and reads the `Switch` ingest packet for metadata. The output reports component files, support graph files,
public export intent, import rewrites, theme requirements, dependency posture, and planned-but-not-written lockfile
effects. React Aria Components is currently a `^1.17.0` peer requirement and `classnames` is a `^2.3.2` runtime
requirement; compatible declarations in the target package are reported as `satisfied`. Runtime `Switch` source files
report available source; the optional focused test is metadata-only until the component-library testing work area. This
is not strict `add switch`.

Current `add switch --dry-run --json` uses the same local React registry source and packet metadata, but reports
would-apply effects instead of advisory-only effects. It still writes no files, config, lockfile, directories, or package
metadata. Missing `amino-ui.config.json` is a warning for now, and the command falls back to default `registry-contained`
paths so the first fixture can preview the exact write set before strict `init` exists. Existing targets are counted as
blockers, dependency decisions are summarized, and the lockfile effect reports `would-write`.

Current strict `add switch --json` reads the same local React registry source after strict init has created
`amino-ui.config.json` and `amino-ui.lock.json`. It requires already-satisfied dependencies, rejects missing source files
and existing target files, writes the seven planned support/theme/component files, rewrites package-local token imports to
the installed registry token paths, and records hash-based lockfile item/file ownership plus satisfied dependency
decisions. It does not install packages, overwrite files, generate hosted registry artifacts, or implement update/eject
behavior.

## Renovation Order

1. Add fixture tests around config, registry schemas, package-manager helpers, and transforms.
2. Add advisory preflight paths for `init` and `add`.
3. Seed strict init with config and empty Amino lockfile only.
4. Add dry-run previews before strict component writes.
5. Add the first strict `Switch` install path for the satisfied-dependency, no-conflict proof.
6. Defer `status`, `update`, and ejection behavior until installed metadata has proof evidence.

## Design Packet

The next CLI discussion should use the Wavemap extraction and polish roadmaps as inputs. Those roadmaps frame the CLI as
declarative, metadata-driven source distribution, with `Switch` still the first likely proof only after theme delivery,
package-safe imports, dependency policy, and focused tests are settled.

Discussion targets before strict `init` or `add` behavior expands:

- theme tiers: package default CSS, narrow `Switch` compatibility bridge, consumer-owned mapping, later generated output;
- install metadata: file hashes, registry ids, versions, dependencies, and chosen theme tier;
- ownership states: registry-owned, locally modified, ejected, consumer-owned support, and unknown;
- update stance: automatic only for pristine registry-owned files, manual merge for modified files, never auto-update
  ejected files;
- first proof mode: prefer advisory `init`/`add` reports until the metadata ledger and registry authority are approved.

## Boundaries

Do not expand CLI install/update/diff behavior, registry artifact shape, component movement, generated token writers, or
publication policy as incidental cleanup.
