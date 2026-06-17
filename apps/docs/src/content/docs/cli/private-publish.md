---
title: Private CLI Publish
description: SOP for publishing the restricted @codon-ui/cli package.
---

Use this SOP to publish the private `@codon-ui/cli` package for trusted consumer repos such as Wavemap and Waveguide.
The current private distribution model publishes only the CLI package; `@codon-ui/react` remains the workspace source
identity and is bundled into the CLI package as registry/source payload at pack time.

## Preconditions

- The publish change is committed and the working tree is clean.
- The intended version is set across all CLI version guard surfaces.
- `packages/CLI/CHANGELOG.md` has an entry for the intended version.
- npm auth is available for the `@codon-ui` organization and restricted package publishing.
- No npm token or registry credential is committed to the repo.

Check auth from a local terminal:

```sh
npm whoami --registry=https://registry.npmjs.org
npm view @codon-ui/cli version --registry=https://registry.npmjs.org
```

If npm auth is missing, log in interactively:

```sh
npm login --scope=@codon-ui --registry=https://registry.npmjs.org --auth-type=web
```

## Version

Bump the CLI version before publishing. Use a patch version for private CLI behavior fixes, such as adding a consumer
bootstrap shortcut. Use a minor version for registry payload or theme contract releases that consumers need to absorb
intentionally.

```sh
pnpm -F @codon-ui/cli version 0.2.0 --no-git-tag-version
```

The release guard intentionally hardcodes the intended package version. Update these surfaces in the same release-prep
commit:

- `packages/CLI/package.json`
- `packages/CLI/scripts/publication-safety.mjs`
- `packages/CLI/src/helpers/getPackageInfo.ts`
- `packages/CLI/src/helpers/consumerContract/constants.ts`
- CLI tests that assert the current package version or `init --setup-cli` dependency range
- `packages/CLI/CHANGELOG.md`

Commit the version bump separately from unrelated work. Do not publish an uncommitted version change.

## Release Notes

Update `packages/CLI/CHANGELOG.md` in the same release-prep commit as the version bump. Each private release entry should
include:

- changed CLI behavior;
- changed registry payload or theme contract behavior;
- consumer-facing migration or bootstrap notes;
- verification commands used for the release.

For a registry payload or theme contract release, note that `@codon-ui/react` is not published separately under the
current model. The CLI tarball is the consumer distribution vehicle, and `pack:check` proves that the bundled registry
source uses the package-local source root.

## Preflight

Run the focused package gates before publishing:

```sh
pnpm -F @codon-ui/react check:contracts
pnpm -F @codon-ui/react stylelint
pnpm -F @codon-ui/react typecheck
pnpm -F @codon-ui/cli test
pnpm -F @codon-ui/cli typecheck
pnpm -F @codon-ui/cli lint
pnpm -F @codon-ui/cli build
pnpm -F @codon-ui/cli pack:check
pnpm -F @codon-ui/cli release:check
git diff --check
```

`pack:check` builds the CLI, prepares the package-local registry/source payload, verifies the packed source shape, and
runs `npm pack --dry-run`. `release:check` validates the package identity, version, restricted publish access, file
allowlist, and publish-script safety.

## Publish

Publish from the repo root through the package filter:

```sh
pnpm -F @codon-ui/cli publish --access restricted
```

The package `prepublishOnly` hook runs `pack:check` and `release:check`. The release guard fails if the package manifest
contains public publish settings, disallowed public publish scripts, an unexpected package name/version, an unexpected
file allowlist, or missing restricted access.

## Post-Publish Smoke

Confirm npm sees the intended version:

```sh
npm view @codon-ui/cli version --registry=https://registry.npmjs.org
pnpm view @codon-ui/cli versions --json
```

Then run the private package smoke proof from the sibling fixture repo. Replace `0.2.0` with the version just published:

```sh
cd ../codon-ui-consumer-fixtures
CODON_UI_PUBLISHED_CLI_VERSION=0.2.0 pnpm verify:published-package-smoke
```

For a version that introduces `init --setup-cli`, add or run a smoke proof that verifies this bootstrap path from the
published package:

```sh
pnpm --package=@codon-ui/cli@0.2.0 dlx codon-ui init --setup-cli --json
pnpm install
pnpm cui status
```

## Consumer Notes

Consumers with a pnpm `minimumReleaseAge` guard may reject same-day internal publishes until the release-age window
passes. For private Codon UI packages that must be consumed immediately, use a narrow `minimumReleaseAgeExclude` entry for
`@codon-ui/cli` instead of disabling the guard globally.

Keep CI credentials out of repo files. Future CI consumers should use secret-backed npm tokens or environment-provided
`.npmrc` content for the `@codon-ui` scope.
