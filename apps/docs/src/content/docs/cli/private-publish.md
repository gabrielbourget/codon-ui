---
title: Private CLI Publish
description: OIDC release SOP for the restricted @codon-ui/cli package.
---

`@codon-ui/cli` publishes from the dedicated `publish-cli.yml` GitHub Actions
workflow through npm trusted publishing. The workflow receives no persistent
npm write token. It publishes only the CLI package; `@codon-ui/react` remains
the workspace source identity and is bundled into the CLI tarball as
registry/source payload during packing.

Publishing is a metered, registry-mutating operation. Preparing and locally
verifying a release does not authorize dispatching the workflow.

## Trusted Publisher Boundary

Configure the npm trusted publisher with these exact values:

| Field              | Value              |
| ------------------ | ------------------ |
| Package            | `@codon-ui/cli`    |
| Provider           | GitHub Actions     |
| GitHub user        | `gabrielbourget`   |
| Repository         | `codon-ui`         |
| Workflow filename  | `publish-cli.yml`  |
| Environment        | `npm-release`      |
| Allowed npm action | `npm publish` only |

The GitHub `npm-release` environment is part of the identity boundary. Restrict
it to the `develop` branch and require an explicit reviewer approval when the
repository plan supports that protection. Do not store an npm token in the
environment.

npm does not validate these identity values when they are saved. A successful,
explicitly authorized publication is the final proof. Keep the existing manual
publication capability until that proof succeeds; then configure npm to
disallow traditional publishing tokens and revoke obsolete write credentials.

## Version And Release Notes

Bump the CLI version before publishing. Use a patch version for private CLI
behavior fixes and a minor version for registry payload or theme contract
releases that consumers need to absorb intentionally.

```sh
pnpm -F @codon-ui/cli version 0.2.0 --no-git-tag-version
```

The release guard intentionally pins the intended package version. Update these
surfaces together in a dedicated release-preparation commit:

- `packages/CLI/package.json`;
- `packages/CLI/scripts/publication-safety.mjs`;
- `packages/CLI/src/helpers/getPackageInfo.ts`;
- `packages/CLI/src/helpers/consumerContract/constants.ts`;
- CLI tests that assert the package version or `init --setup-cli` dependency
  range; and
- `packages/CLI/CHANGELOG.md`.

The changelog entry should describe CLI behavior, registry/theme contract
changes, consumer migration notes, and the verification commands used.

## Local Preflight

Run the exact package gates before requesting a release:

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
NPM_RELEASE_EXPECTED_VERSION=0.2.0 pnpm -F @codon-ui/cli release:request
pnpm verify:github-actions
git diff --check
```

`pack:check` builds the CLI, prepares the package-local registry/source
payload, exercises that payload from a temporary consumer, and requires npm's
dry-run manifest to exactly match the generated `dist` tree. `release:check`
pins package identity, repository identity, version, restricted access, the npm
registry, file allowlist, and publication scripts. `release:request` proves
that the exact version intended for dispatch matches the committed package.

## Dispatch

After the release commit is reviewed and merged to `develop`, obtain explicit
authorization for one workflow run. In GitHub Actions, select **Publish Private
CLI**, leave the source ref on `develop`, enter the exact package version, and
type `publish <version>` in the confirmation field.

The job is skipped before runner allocation if the ref is not `develop` or the
confirmation does not exactly match. For an accepted request it performs one
uncached install, reruns the focused React/CLI release gates, and invokes:

```sh
npm publish --access restricted
```

The package lifecycle performs the final pack and publication guards. The
publish step must not receive `NPM_TOKEN`, `NODE_AUTH_TOKEN`, an npmrc secret,
or any other persistent npm credential. `id-token: write` is granted only to
the publishing job, and npm exchanges the GitHub OIDC identity for a short-lived
publishing credential.

The restricted package does not receive npm's automatic provenance attestation;
that feature currently requires both a public repository and a public package.
OIDC authentication still removes the persistent write token from publication.

## Post-Publish Proof

After the workflow succeeds, confirm the expected version through an
authorized read credential:

```sh
npm view @codon-ui/cli version --registry=https://registry.npmjs.org
pnpm view @codon-ui/cli versions --json
```

Then run the private-package smoke proof from the sibling fixture repository,
replacing `0.2.0` with the published version:

```sh
cd ../codon-ui-consumer-fixtures
CODON_UI_PUBLISHED_CLI_VERSION=0.2.0 pnpm verify:published-package-smoke
```

For a release that changes `init --setup-cli`, also verify the published
bootstrap path:

```sh
pnpm --package=@codon-ui/cli@0.2.0 dlx codon-ui init --setup-cli --json
pnpm install
pnpm cui status
```

Consumer repositories with a `minimumReleaseAge` policy may reject an immediate
internal release. Use a narrow `minimumReleaseAgeExclude` entry for
`@codon-ui/cli`; do not disable the protection globally.
