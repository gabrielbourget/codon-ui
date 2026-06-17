# CI Verification Foundation

## Purpose

The Codon UI monorepo should have a local verification surface that matches the first GitHub Actions CI workflow before
component source starts moving in from Wavemap.

This pass follows the Wavemap pattern: local shell scripts own the verification contract, and CI calls those scripts
instead of duplicating command details directly in workflow YAML.

## Current Status

The root verification surface is:

| Script                       | Purpose                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `pnpm verify:github-actions` | Checks `.github/workflows` and `.github/actions` formatting, YAML parsing, and actionlint semantics.              |
| `pnpm verify:tooling`        | Runs `pnpm check` plus config smoke checks for Stylelint, TypeScript, and ESLint across current workspace owners. |
| `pnpm verify:build`          | Builds the React package, CLI package, and web app.                                                               |
| `pnpm verify:tests`          | Runs present workspace package test scripts with `pnpm -r --if-present test`.                                     |
| `pnpm verify:ci`             | Runs the local CI parity surface in the same broad order as the workflow.                                         |

The initial GitHub Actions workflow separates tooling, build, and test jobs while reusing the local scripts. It also uses
a local `setup-pnpm` composite action adapted from Wavemap so Node, Corepack, the pinned pnpm version, and pnpm store
caching stay consistent between monorepos.

## Build Boundary

`pnpm verify:build` runs the web build through:

```text
pnpm -F web exec next build
```

This is deliberate. The web package `build` script runs the same plain Next build. The CI foundation should validate the
buildable workspace surface without turning registry artifact generation into policy.

## Test Boundary

`pnpm verify:tests` establishes the test entrypoint before the real component proof harness exists. Package-local tests
can be added incrementally, and CI will pick them up through the recursive `--if-present` script.

The CLI currently has a passing no-op test script so the recursive test surface is not blocked by a placeholder failure.
This is only a harness baseline, not CLI behavior proof.

## Out Of Scope

This pass does not:

- Move `Switch` or any other Wavemap component source.
- Add React Aria, test runners, Playwright, Vitest, or other new dependencies.
- Change lockfiles.
- Implement registry artifact generation from `packages/react`.
- Expand CLI install, update, diff, status, or ejection behavior.
- Decide publication, release automation, or deploy workflows.

## Stop Conditions

Return to deliberate planning if CI expansion requires:

- New dependencies or lockfile changes.
- Secrets, deployment targets, package publication, or release automation.
- Treating generated registry output as tracked canonical source.
- Building test harnesses around component source that has not been approved for receipt.
- Reopening the Turbo migration experiment as part of verification.

## Verification Expectations

For this pass:

- `pnpm verify:github-actions`
- `pnpm verify:tooling`
- `pnpm verify:build`
- `pnpm verify:tests`
- `pnpm verify:ci`
- `git diff --check`
