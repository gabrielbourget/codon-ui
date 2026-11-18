# @codon-ui/cli Changelog

## 0.3.1 - Unreleased

### Fixed

- Package the native Carousel fixes for repeated settled-index callbacks and page sizing in unbounded layouts.
- Package the Compact Typeahead fixes for dismissal after selection, clearing the current query and tapping outside. Controlled query state stays with the app.
- Preserve numeric and string TagComboBox keys through selection and removal, including `0` and `"0"`.
- Include the current native registry, including anchored Select, content-based sizing and the standard backdrop setup. Rebuild the Expo development client when a selected native input changes.

### Consumer notes

- Pin the CLI in the app and use `cui update --dry-run` for installed components before applying updates. The CLI protects local edits and reports ownership changes that need migration.
- Source updates and prior installed witnesses retain their own artifact identities. The new npm release needs a clean consumer check for the four affected platform cases. Calendar selection and viewport checks remain tracked separately in the [consumer evidence ledger](https://github.com/gabrielbourget/codon-ui-consumer-fixtures/pull/35).

## 0.3.0 - 2026-11-16

### Added

- Added `cui init --target react-native` to the existing CLI. Native configuration selects editable component and shared implementation copies; the default remains React/web.
- Added the 52-component native source registry, application-owned Intl bootstrap example, deduplicated dependencies and normal native autolinking configuration.
- Separated Table's component-owned native backend from shared core support while preserving the delivered batching and activation behavior. Core-only and full-Table source variants travel with the selected component graph.

### Fixed

- Preserve canonical public component barrels, cross-directory helpers and the ambient SDK declaration in copied native source.
- Preserve the actual consumer's full/core and ESM/CommonJS profile during status and update planning. Native helper dependency-set changes block before writes; stable-closure updates and local-edit protection remain supported.
- Package all required registry snapshots and native source variants with content/inventory checks and a portable source payload.
- Relay native pointer packets to independently ready sibling scopes and route ordinary calendar day activation through the existing button callback while preserving range-gesture ownership and cancellation. These source corrections do not establish installed calendar acceptance.

### Consumer Notes

- This version published as a restricted npm package using the [trusted publish workflow](https://github.com/gabrielbourget/codon-ui/actions/runs/43969219582).
- In an existing compatible Expo development-client app, run `cui init --target react-native`, then `cui add button input click-popover --dependency-policy install --install-dependencies`. Existing web configurations are not silently converted.
- Import the copied Intl bootstrap before App and compose the documented native providers. Rebuild the development client after native source, codegen or composition changes; Expo Go cannot supply the custom backend. See the [native consumer guide](../../apps/docs/src/content/docs/packages/react-native-consumer.md).
- Existing native helper-ownership drift needs a reviewed source migration or guarded reinstallation. Automatic dependency-closure migration, arbitrary existing-project/provider discovery, durable production filesystem transactions and bare-RN qualification are not included.

### Verification And Remaining Proof

- The merged bridge at `d3ea0e91` passed exact-head full hosted CI, existing web/native CLI tests, normal hooks and relocated package checks. Actual locally packed CLI installation, all-52 source add/repeat, update/edit protection and dependency identity checks passed.
- An isolated external Expo consumer passed types, Android/iOS Metro exports, standard autolinking and core-only/full-Table compile/link on both platforms using the existing pinned toolchains. These are source/build results, not all-52 installed component qualification.
- A clean published consumer verified the package installation and native setup. Scoped installed results and retained failures are tracked in the [consumer evidence repository](https://github.com/gabrielbourget/codon-ui-consumer-fixtures/pull/35). Calendar selection and viewport verification remain separately tracked.

## 0.2.1 - 2026-08-06

### Changed

- Moved package publication to the manual, default-branch-restricted GitHub OIDC workflow prepared for npm trusted
  publishing.
- Added exact-version, repository-identity, package-content, and credential-absence checks around the release path.
- Kept the CLI runtime and registry-source behavior unchanged from `0.2.0`; this patch advances the immutable package
  version for the first trusted-publishing proof.

### Consumer Notes

- No component, theme, registry-layout, or command-behavior migration is required from `0.2.0`.
- Use `pnpm --package=@codon-ui/cli@0.2.1 dlx codon-ui init --setup-cli` for the first verbose bootstrap call when
  running through pnpm. The shorter local `pnpm cui ...` path is available after `init --setup-cli` and `pnpm install`.

### Verification

- `pnpm -F @codon-ui/react check:contracts`
- `pnpm -F @codon-ui/react stylelint`
- `pnpm -F @codon-ui/react typecheck`
- `pnpm -F @codon-ui/cli test`
- `pnpm -F @codon-ui/cli typecheck`
- `pnpm -F @codon-ui/cli lint`
- `pnpm -F @codon-ui/cli build`
- `pnpm -F @codon-ui/cli pack:check`
- `pnpm -F @codon-ui/cli release:check`
- `pnpm verify:github-actions`
- `git diff --check`
- Post-publish registry smoke target: `CODON_UI_PUBLISHED_CLI_VERSION=0.2.1 pnpm verify:published-package-smoke`

## 0.2.0 - 2026-06-17

### Changed

- Packaged the Codon UI React theme contract update that expands the canonical neutral scale to
  `--cui-neutral-100` through `--cui-neutral-900`.
- Packaged refreshed registry source and compatibility CSS for neutral-scale consumers.
- Packaged the registry cleanup that removes the retired web registry scaffold from the published source path.

### Consumer Notes

- Treat this as a theme contract release. Consumers with installed Codon UI theme files should update their local
  registry assets intentionally before applying product-specific theme overrides.
- Use `pnpm --package=@codon-ui/cli@0.2.0 dlx codon-ui init --setup-cli` for the first verbose bootstrap call when
  running through pnpm. The shorter local `pnpm cui ...` path is available after `init --setup-cli` and `pnpm install`.

### Verification

- `pnpm -F @codon-ui/react check:contracts`
- `pnpm -F @codon-ui/react stylelint`
- `pnpm -F @codon-ui/react typecheck`
- `pnpm -F @codon-ui/cli test`
- `pnpm -F @codon-ui/cli typecheck`
- `pnpm -F @codon-ui/cli lint`
- `pnpm -F @codon-ui/cli build`
- `pnpm -F @codon-ui/cli pack:check`
- `pnpm -F @codon-ui/cli release:check`
- `pnpm build:docs`
- `git diff --check`
- Post-publish registry smoke target: `CODON_UI_PUBLISHED_CLI_VERSION=0.2.0 pnpm verify:published-package-smoke`

## 0.1.3 - 2026-06-14

### Fixed

- Packaged the React Button source fix so buttons expose a pointer cursor when interactive and transition hover color
  changes smoothly.
- Packaged the React NumberInput source fix so numeric filter arguments stretch across their full filter argument slot in
  Sort and Filter Panel flows.

### Consumer Notes

- Use `pnpm --package=@codon-ui/cli@0.1.3 dlx codon-ui init --setup-cli` for the first verbose bootstrap call when
  running through pnpm. The shorter local `pnpm cui ...` path is available after `init --setup-cli` and `pnpm install`.

### Verification

- `pnpm -F @codon-ui/react test`
- `pnpm -F @codon-ui/react typecheck`
- `pnpm -F @codon-ui/react lint`
- `pnpm -F @codon-ui/react stylelint`
- `pnpm -F @codon-ui/react check:contracts`
- `pnpm -F @codon-ui/cli test`
- `pnpm -F @codon-ui/cli typecheck`
- `pnpm -F @codon-ui/cli build`
- `pnpm -F @codon-ui/cli lint`
- `pnpm -F @codon-ui/cli pack:check`
- Tarball install proof from `npm pack`
- Post-publish registry smoke target: `pnpm --package=@codon-ui/cli@0.1.3 dlx codon-ui ...`

## 0.1.2 - 2026-06-11

### Fixed

- Fixed CLI package metadata resolution so `pnpm --package=@codon-ui/cli dlx codon-ui ...` reads the Codon UI package
  version instead of the consumer project's `package.json`.

### Consumer Notes

- Use `pnpm --package=@codon-ui/cli@0.1.2 dlx codon-ui init --setup-cli` for the first verbose bootstrap call when
  running through pnpm. The shorter local `pnpm cui ...` path is available after `init --setup-cli` and `pnpm install`.

### Verification

- `pnpm -F @codon-ui/cli test`
- `pnpm -F @codon-ui/cli typecheck`
- `pnpm -F @codon-ui/cli build`
- `pnpm -F @codon-ui/cli lint`
- `pnpm -F @codon-ui/cli pack:check`

## 0.1.1 - 2026-06-11

### Added

- Added `init --setup-cli`, an opt-in bootstrap shortcut that writes `scripts.cui = "cui"` and a local
  `@codon-ui/cli` devDependency when it can do so without overwriting consumer intent.
- Added JSON report fields for the CLI shortcut plan and package manifest write effects.

### Consumer Notes

- `init --setup-cli` does not run a package manager. Consumers should run their normal install command after the manifest
  change, then use `pnpm cui ...` from the target package.
- Existing `dependencies` or `devDependencies` declarations for `@codon-ui/cli` are preserved. Existing conflicting
  `scripts.cui` values are reported and not overwritten.

### Verification

- `pnpm -F @codon-ui/cli test`
- `pnpm -F @codon-ui/cli typecheck`
- `pnpm -F @codon-ui/cli build`
- `pnpm -F @codon-ui/cli lint`
- `pnpm -F @codon-ui/cli pack:check`
