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

## Ownership States

| State                    | Meaning                                                                    | Default CLI stance                                             |
| ------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `registry-owned`         | Installed file still belongs to the registry graph.                        | Eligible for future automated update only after update exists. |
| `locally-modified`       | Installed file differs from recorded provenance.                           | Preserve by default; report for manual review.                 |
| `consumer-owned-support` | Consumer intentionally owns compatible support at the planned target path. | Reuse or validate; do not overwrite by default.                |
| `ejected`                | Consumer intentionally took ownership of the file or component slice.      | Preserve by default; never auto-update.                        |
| `unknown`                | A target exists without trusted Amino provenance.                          | Treat as a blocker for strict writes.                          |

## Deferred Lifecycle Commands

The next lifecycle work should add `update --advisory`, `update --dry-run`, safe remove/delete, focused diff, and eject
behavior without weakening the preservation defaults above.

Generated token writers, strict update/eject mutation, public registry hosting, package publication, and Waveguide
validation remain deferred until explicitly approved.
