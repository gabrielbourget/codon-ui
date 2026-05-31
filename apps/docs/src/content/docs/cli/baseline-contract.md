---
title: CLI Baseline Contract
description: Current CLI renovation boundaries and advisory-mode policy.
---

The CLI is still legacy scaffold. It should be renovated as a separate lane before command behavior is trusted for
component extraction.

## Current Surface

| Command | Current state                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------- |
| `init`  | Mutates config, helper files, directories, and package dependencies.                                            |
| `add`   | Fetches legacy registry JSON, writes files, transforms source, and installs dependencies.                       |
| `diff`  | Reads local files and registry payloads. `diff --advisory` now reports expected missing inputs without failing. |

None of these commands should become the first `Switch` proof mechanism until registry artifact policy, install metadata,
dependency policy, and tests are settled.

## Advisory Mode

Future command work should add a shared `--advisory` mode.

Advisory mode should:

- report expected config, registry, dependency, filesystem, and project-shape issues as diagnostics;
- exit `0` for expected findings so larger scripts and background checks are not blocked;
- avoid file writes, config writes, directory creation, package installs, and lockfile changes;
- skip or timebox slow network, package-manager, and full-project scans unless explicitly requested.

`--advisory` is different from a future dry-run. Advisory mode is for non-blocking diagnostics. Dry-run can later preview
approved mutations.

Current `diff --advisory` reports missing cwd, config, registry, component, and registry payload issues as warnings with
exit `0`. Advisory registry requests are quieted and timeboxed to avoid blocking broader processes.

## Renovation Order

1. Add fixture tests around config, registry schemas, package-manager helpers, and transforms.
2. Add advisory preflight paths for `init` and `add`.
3. Defer `status`, `update`, and ejection behavior until install metadata is approved.

## Boundaries

Do not expand CLI install/update/diff behavior, registry artifact shape, component movement, generated token writers, or
publication policy as incidental cleanup.
