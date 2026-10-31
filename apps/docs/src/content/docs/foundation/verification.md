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

## Cloud To Mac Handoff

For a finite handoff pilot, transfer one documentation commit on a dedicated branch and repeat one existing source check on the exact same commit. Keep the active writer's worktree, branch and index untouched, including `feature/native-stock-rn-migration`. Use separate worktrees; do not switch, reset, stash, rebase or cherry-pick in the writer's checkout.

Start in a clean cloud checkout with the expected `origin` remote. Choose a unique branch suffix and unused worktree path:

```sh
pilot_branch=feature/cloud-to-mac-handoff-UNIQUE
git fetch origin refs/heads/develop:refs/remotes/origin/develop
base_sha=$(git rev-parse refs/remotes/origin/develop)
git worktree add -b "$pilot_branch" ../codon-ui-cloud-handoff "$base_sha"
cd ../codon-ui-cloud-handoff
```

Record `base_sha` in the handoff. If fetching the canonical baseline fails, report the blocker and any local base's age instead of silently treating a cached ref as current. Stop on authentication or network failure; do not configure credentials or widen access for this pilot.

On each host, activate the already provisioned Node **24.15.0** using that host's configured tool manager (for example, `nvm use 24.15.0` on an nvm host). Use pnpm **10.18.3**, pinned by root `packageManager`; an existing Corepack installation can invoke it as `corepack pnpm` if the pnpm shim is absent. Confirm both versions in the shell that runs the check. The prepared cloud task's startup activation is host-local and must not be copied as a macOS tool path.

```sh
node --version
pnpm --version
pnpm -F @codon-ui/react check:theme-css
```

`check:theme-css` runs `packages/react/verify-theme-css-contract.mjs` against the tracked CSS using Node built-ins, so it is a cheap Linux/macOS source contract check without a browser, simulator or native build. Success prints `[theme-css-contract] theme.css contract passed.` It does not require installing workspace dependencies. When documentation checks need dependencies in a fresh worktree, use `pnpm install --frozen-lockfile` there; keep its `node_modules` separate from the active writer's installation.

For this documentation-only change, also run the documentation commands above and `git diff --check`. Commit with the normal repository hooks enabled (activate Husky with `pnpm exec husky` in a fresh cloud checkout), then push only the dedicated branch and verify its remote SHA:

```sh
git add apps/docs/src/content/docs/foundation/verification.md
git commit -m "docs: explain cloud to Mac source handoff"
commit_sha=$(git rev-parse HEAD)
git push origin "HEAD:refs/heads/$pilot_branch"
git ls-remote origin "refs/heads/$pilot_branch"
```

The remote result must equal `commit_sha`. Return the repository URL, branch, full base and commit SHAs, changed files, tool versions, commands and exit results. Do not merge, force-push, publish packages or open a PR as part of this pilot.

On the Mac, substitute the delivered branch and full commit SHA below. Run from the intended repository, use an unused sibling worktree path, and verify the fetched ref before creating the detached worktree:

```sh
pilot_branch=feature/cloud-to-mac-handoff-UNIQUE
expected_sha=FULL_COMMIT_SHA_FROM_CLOUD
git fetch origin "refs/heads/$pilot_branch:refs/remotes/origin/$pilot_branch"
test "$(git rev-parse "refs/remotes/origin/$pilot_branch")" = "$expected_sha" || exit 1
git worktree add --detach ../codon-ui-mac-handoff "$expected_sha"
cd ../codon-ui-mac-handoff
# Activate the host toolchain described above before continuing.
node --version
pnpm --version
test "$(git rev-parse HEAD)" = "$expected_sha" || exit 1
pnpm -F @codon-ui/react check:theme-css
git status --short
```

Return the Mac's full HEAD SHA, tool versions, check result and worktree status. Matching SHAs and successful source checks on both hosts prove Git transfer and source execution only. Installed iOS/Android rendering, input, accessibility, performance and component acceptance require separate platform evidence; this pilot changes no acceptance ledger and runs no native builds or browser suite. Leave native build work with its assigned owner to avoid concurrent builds.
