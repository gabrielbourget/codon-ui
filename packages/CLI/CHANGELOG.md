# @codon-ui/cli Changelog

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
