---
title: CLI Baseline Contract
description: Current CLI renovation boundaries and advisory-mode policy.
---

The CLI still contains legacy scaffold paths, but the local-registry lane now supports advisory planning, dry-run
planning, strict init, strict single-component installs, and read-only status inspection against the React registry
snapshot.

## Current Surface

| Command  | Current state                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`   | Legacy normal mode still mutates config, helper files, directories, and dependencies. `init --advisory` is read-only; `init --defaults` seeds only the new config and lockfile.                                                 |
| `info`   | Read-only project context and init advisory output are available through `info --json`.                                                                                                                                         |
| `add`    | Legacy normal mode remains for other inputs. Local-registry `add --advisory --json` and `add --dry-run --json` plan the graph; strict `add <component> --json` writes one local React component graph when blockers are absent. |
| `diff`   | Reads local files and registry payloads. `diff --advisory` now reports expected missing inputs without failing.                                                                                                                 |
| `status` | `status --json` reads config, lockfile, local registry source, installed file hashes, and recorded dependency decisions without writing.                                                                                        |

These commands are local proof tooling. They do not decide public registry hosting, package publication, generated token
output, update behavior, or ejection behavior.

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

Current `diff --advisory` reports missing cwd, config, registry, component, and registry payload issues as warnings with
exit `0`. Advisory registry requests are quieted and timeboxed to avoid blocking broader processes.

Current `init --advisory --json` reports the proposed consumer config, package manager, project context, theme tier,
dependency policy, and role paths without writing files. The default `registry-contained` layout places support roles
under `src/components/_registry`.

Current `init --defaults --json` is the strict new-contract seed path. It writes only `amino-ui.config.json` and an empty
`amino-ui.lock.json` when neither file exists. It does not create directories, write helper/support files, install
dependencies, or touch package-manager lockfiles. Existing config or lockfile files are reported as warnings and are not
overwritten.

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
currently proves greenfield, clean installed, and locally modified installed-file cases.

## Command Data Flow

The semi-developed command lane is intentionally linear:

```text
init advisory -> init defaults -> add advisory -> add dry-run -> strict add -> status
```

`init` establishes consumer intent and provenance storage. `add` consumes registry metadata and the consumer files created
by `init`.

| Stage             | Reads                                                | Writes                                   |
| ----------------- | ---------------------------------------------------- | ---------------------------------------- |
| `init --advisory` | Project shape and package metadata.                  | Nothing.                                 |
| `init --defaults` | Project shape and existing Amino config/lockfile.    | Config and empty lockfile only.          |
| `add --advisory`  | Local snapshot, packet metadata, target package.     | Nothing.                                 |
| `add --dry-run`   | Local snapshot, packet metadata, config if present.  | Nothing.                                 |
| Strict `add`      | Snapshot, packet metadata, config, lockfile, source. | Source/support/theme files and lockfile. |
| `status --json`   | Config, lockfile, local snapshot, installed files.   | Nothing.                                 |

This lane is designed so fixture evidence can capture each transition before stricter lifecycle commands exist.

## Completed Renovation Sequence

1. Add fixture tests around config, registry schemas, package-manager helpers, and transforms.
2. Add advisory preflight paths for `init` and `add`.
3. Seed strict init with config and empty Amino lockfile only.
4. Add dry-run previews before strict component writes.
5. Add strict single-component local registry install paths for satisfied-dependency, no-conflict proofs.
6. Add read-only `status --json` for greenfield, clean installed, and locally modified fixture proofs.

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
- lifecycle proof mode: use `status --json` as the read-only classification base, then prefer advisory and dry-run
  reports until update, remove/delete, focused diff, and eject metadata behavior is approved.

## Boundaries

Do not expand update, remove/delete, focused diff, eject, registry artifact hosting, generated token writers, or
publication policy as incidental cleanup.
