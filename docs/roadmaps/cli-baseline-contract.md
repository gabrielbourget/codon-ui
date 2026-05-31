# CLI Baseline Contract

## Purpose

This document defines the starting contract for renovating `packages/CLI` before changing command behavior.

The CLI is still legacy scaffold. It can stay useful as reference material, but it should not decide registry install
policy, source ownership, component update behavior, package publication, or generated artifact shape before the first
component proof is ready.

## Current Status

Current command surface:

| Command | Current role                                                                                                                       | Renovation read                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `init`  | Detects project shape, writes `amino-ui.config.json`, creates target paths, writes helper support, and installs base dependencies. | Mutating and not proof-ready. Needs a preflight/report contract before it can be trusted.                             |
| `add`   | Fetches component/helper registry JSON, writes files, transforms imports/RSC markers, and installs dependencies.                   | Mutating and coupled to legacy registry artifacts. Freeze behavior until registry source policy is settled.           |
| `diff`  | Fetches registry files and prints local file differences.                                                                          | Closest to read-only, but still exits hard on missing config/registry/component and depends on legacy artifact shape. |

Current helper surface:

| Area                    | Current role                                                                                  | Renovation read                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Config                  | Loads `amino-ui.config.json`, infers paths from `tsconfig-paths`, and resolves aliases.       | Keep, but convert failures into typed diagnostics before command behavior expands.                                     |
| Registry client         | Fetches JSON from `COMPONENT_REGISTRY_URL` or `https://aminoui.com`.                          | Defer behavior changes until generated artifact policy is approved. Add timeouts/advisory behavior before machine use. |
| Registry schemas        | Parses component/helper registry indexes.                                                     | Current shape reflects legacy web registry. Do not treat as final manifest policy.                                     |
| File transforms         | Rewrites imports, removes `"use client"` for non-RSC projects, and converts TS/TSX to JS/JSX. | Needs fixture tests before any behavior changes.                                                                       |
| Package manager helpers | Computes add commands and dev-dependency flags.                                               | Keep as a small leaf, but do not execute package-manager commands in advisory mode.                                    |

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
| Future `--dry-run`        | Preview an intended mutation. May still be strict once apply/update behavior is approved.        |
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
- `bin` points to `dist/index.js`; fresh installs can warn or fail before build output exists.
- `pub:*` scripts call `npm build` and publication behavior is not approved.
- Current command names and options are inherited scaffold surface, not settled public API.

## First Safe Implementation Sequence

1. Add a tiny CLI diagnostic/result helper that can represent `info`, `warning`, and `error` without immediately exiting.
2. Add a shared `--advisory` option parser and a command context type.
3. Convert `diff` to use advisory diagnostics first, because it is closest to read-only.
4. Add fixture tests for config loading, registry schema parsing, package-manager helper output, and file transforms.
5. Add advisory preflight paths for `init` and `add` without enabling new apply behavior.
6. Decide install metadata shape before implementing `status`, `update`, or ejection behavior.

## Stop Conditions

Return to deliberate planning if CLI work requires:

- Changing registry artifact shape.
- Activating component install/update/diff behavior against `packages/react` manifests.
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
