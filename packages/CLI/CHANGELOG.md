# @codon-ui/cli Changelog

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
