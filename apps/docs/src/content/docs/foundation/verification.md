---
title: Verification
description: Local checks and CI parity commands for Amino UI.
---

Local verification is script-owned so the GitHub Actions workflow can call the same commands that developers run.

## Main Commands

```sh
pnpm check
pnpm verify:github-actions
pnpm verify:tooling
pnpm verify:build
pnpm verify:tests
pnpm verify:ci
```

`pnpm verify:ci` is the local aggregate for the initial CI surface.

## Build Surface

```sh
pnpm build:react
pnpm build:cli
pnpm build:web
pnpm build:docs
```

`pnpm verify:build` calls these package builds through the wrapper in `bin/verify-monorepo-build.sh`.

The web build intentionally uses `pnpm -F web exec next build`, not the web package `build` script, because registry
artifact generation policy is still unresolved.

## React Package Contracts

```sh
pnpm -F @amino-ui/react check:contracts
pnpm -F @amino-ui/react check:theme-css
pnpm -F @amino-ui/react check:registry-manifest
```

Use these focused commands when touching `packages/react/theme.css`, token support, or registry manifest files.
