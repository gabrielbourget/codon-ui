---
title: Verification
description: Local checks and CI parity commands for Codon UI.
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
pnpm -F @codon-ui/react check:contracts
pnpm -F @codon-ui/react check:theme-css
pnpm -F @codon-ui/react check:registry-manifest
pnpm -F @codon-ui/react check:registry-graph
pnpm -F @codon-ui/react check:local-registry-snapshot
```

Use these focused commands when touching `packages/react/theme.css`, token support, or registry manifest files.

## CLI And Consumer Evidence

```sh
pnpm -F @codon-ui/cli typecheck
pnpm -F @codon-ui/cli build
pnpm -F @codon-ui/cli test
```

Consumer fixture evidence lives in the sibling `codon-ui-consumer-fixtures` repository. Run its root verifier after CLI
changes that affect advisory output, dry-run planning, strict writes, or fixture evidence:

```sh
pnpm verify
```

Run that command from `../codon-ui-consumer-fixtures`.

Use [Fixture Evidence](/cli/fixture-evidence/) for the expected proof-packet fields, scenario matrix, and non-mutation
assertions.

Use [Private CLI Publish](/cli/private-publish/) when the CLI change needs to become a restricted npm package for
consumer repos.

## Documentation

```sh
pnpm -F @codon-ui/docs format:check
pnpm build:docs
```

Use these for curated docs-site changes. Roadmap-only edits can usually use root formatting plus `git diff --check`.
