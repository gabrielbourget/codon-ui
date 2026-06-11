# Codon UI Rename Decision Packet

## Purpose

This packet records the first no-behavior-change planning slice for renaming Amino UI to Codon UI and preparing private
npm distribution under the reserved `@codon-ui` namespace.

It is an implementation gate, not a package rename. Do not change package names, CLI binaries, consumer config files,
lockfiles, source identities, registry snapshots, fixture paths, or repository directories until the relevant stage below
is approved and fixture-proven.

## Current Read

The component-library and CLI proof work is far enough along for private-use distribution planning:

- Canonical React source and registry manifests live in `packages/react`.
- The CLI lifecycle supports `init`, `add`, `status`, `diff`, `update`, `remove` / `delete`, and `eject` for the
  fixture-proven private-use surface.
- Local registry snapshots are package-derived proof inputs, not public hosted registry artifacts.
- The sibling fixture repository is the scale evidence repository for consumer states, replay proofs, and command
  lifecycle assertions.
- Wavemap remains the mature first consumer. Its local adapters and existing `_registry` path should not be migrated as
  incidental cleanup during the package rename.

The publication-safety pass removed legacy public-oriented `pub:*` scripts from `packages/CLI/package.json` and moved
`prepublishOnly` from a hard blocker to a guarded private publish preflight. The first publishable CLI package is
`@codon-ui/cli@0.1.0` with `publishConfig.access: "restricted"` and a CLI-bundled registry/source payload.

## Recommended Naming Decisions

These are the target decisions for the first implementation tranche unless a later review explicitly changes them.

| Surface                  | Current                                                  | Target                                                   | Decision                                                                                                                                    |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name             | Amino UI                                                 | Codon UI                                                 | Rename user-facing product/docs labels during the rename tranche.                                                                           |
| npm scope                | `@amino-ui` / unscoped CLI                               | `@codon-ui`                                              | Use the reserved private npm organization scope.                                                                                            |
| CLI package              | `aminoui-cli`                                            | `@codon-ui/cli`                                          | Scope the CLI package before publication.                                                                                                   |
| CLI command              | `aminoui-cli`, `aui`                                     | `codon-ui`, `cui`, `codonui`                             | Keep `codon-ui` canonical and ship `cui` / `codonui` as Codon-era convenience aliases.                                                      |
| React source package     | `@amino-ui/react`                                        | `@codon-ui/react`                                        | Rename the workspace package identity, but do not publish it in the first proof unless split-package distribution is deliberately approved. |
| Shared tooling package   | `@amino-ui/shared-utils`                                 | `@codon-ui/shared-utils`                                 | Rename as workspace-internal tooling when package manifests are updated. Keep it private.                                                   |
| Docs package             | `@amino-ui/docs`                                         | `@codon-ui/docs`                                         | Rename as workspace-internal documentation tooling. Keep it private.                                                                        |
| Consumer config          | `amino-ui.config.json`                                   | `codon-ui.config.json`                                   | Prefer direct rename before external consumers depend on the old file name.                                                                 |
| Consumer lockfile        | `amino-ui.lock.json`                                     | `codon-ui.lock.json`                                     | Prefer direct rename with matching schema and fixture proof.                                                                                |
| Greenfield registry root | `src/components/_registry`                               | `src/components/_codon-ui-registry`                      | Use the explicit Codon default for new consumers. Existing consumers can keep resolved paths until a migration pass.                        |
| Registry source package  | `@amino-ui/react`                                        | `@codon-ui/react`                                        | Move manifest metadata and config defaults to the Codon identity.                                                                           |
| Local source identities  | `@amino-ui/react-local`, `@amino-ui/react-local-support` | `@codon-ui/react-local`, `@codon-ui/react-local-support` | Rename snapshots and lockfile provenance together.                                                                                          |

## Compatibility Stance

Because Amino UI has not been broadly adopted as a distributed package, the rename should favor a clean semantic break
over long-lived compatibility aliases.

The first implementation tranche should not preserve public `aminoui-cli`, `aui`, `amino-ui.config.json`, or
`amino-ui.lock.json` compatibility as product surface. If an existing local proof fixture or Wavemap branch needs a
transition, handle it as a deliberate migration step with fixture evidence, not as permanent dual-name behavior.

## Distribution Shape

Use package-bundled registry/source metadata for the first private npm proof. Public registry hosting, CDN artifact
distribution, and generated token writers stay deferred.

Recommended first private proof:

1. Publish only `@codon-ui/cli` privately after local `npm pack` proof passes.
2. Bundle the registry snapshots and source payload needed by the CLI in that CLI package.
3. Keep `@codon-ui/react` as the canonical workspace source package and source identity, but leave actual publishing of
   the React package for a later split-package proof.
4. Require normal private npm auth for `pnpm dlx @codon-ui/cli ...`.
5. Prove a clean consumer can run `init`, `add`, `status`, `diff`, and compile without local monorepo paths.

This keeps the first distribution proof small: consumers need one private package to execute the source-distribution CLI.
The split `@codon-ui/cli` plus `@codon-ui/react` distribution can come later if package size, source ownership, runtime
imports, or registry refresh policy justify it.

## Inventory

Rename implementation must account for these surfaces.

| Area                       | Examples                                                                                      | Handling                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Package manifests          | root `amino-ui`, `aminoui-cli`, `@amino-ui/react`, `@amino-ui/docs`, `@amino-ui/shared-utils` | Rename in one package-manifest tranche with lockfile update and focused package checks.                                                                               |
| CLI bins and help          | `aminoui-cli`, `aui`, root command names, command examples                                    | Move to canonical `codon-ui` with `cui` / `codonui` aliases; avoid long-lived old Amino aliases.                                                                      |
| Consumer files             | `amino-ui.config.json`, `amino-ui.lock.json`                                                  | Rename schemas, constants, init output, status/diff/update/remove/eject loaders, tests, and fixtures together.                                                        |
| Config schema URL          | `https://aminoui.com/schema.json`                                                             | Do not invent a public URL casually. Choose a private-proof schema URL or omit/update `$schema` in the implementation tranche.                                        |
| Registry metadata          | `sourcePackage`, source identities, local registry snapshot files                             | Rename manifest data and regenerate/verify snapshots in the same tranche.                                                                                             |
| Default layout             | `src/components/_registry`                                                                    | Default new consumers to `src/components/_codon-ui-registry`; preserve explicit existing paths through lockfile/config records.                                       |
| Fixture repository         | fixture names, evidence Markdown, structured proof ledger, package scripts, expected output   | Rename only with replay proofs that establish equivalent Codon behavior.                                                                                              |
| Wavemap consumer           | local `_registry` imports, config, lockfile, source provenance                                | Defer physical path migration until a Wavemap-specific pass updates imports, config, lockfile records, and tests together.                                            |
| Docs labels                | Amino UI docs, CLI examples, registry contracts, fixture evidence docs                        | Rename staged docs labels without implying public hosting or open-source distribution.                                                                                |
| Release scripts            | retired `pub:*`, public `npm publish --access public`, guarded `prepublishOnly` preflight     | Permit only the private restricted CLI publish path after local tarball and npm publish dry-runs pass.                                                                |
| Repository/directory names | `codon-ui`, `codon-ui-consumer-fixtures`                                                      | Physical repo/folder rename remains last, after package/tarball and consumer proofs pass; transitional tooling may still fall back to unrenamed local checkout paths. |

## Theme Token Prefix

The CSS custom property bridge has completed its cleanup pass: canonical `--cui-*` variables are the active contract, and
legacy `--aui-*` compatibility aliases are no longer emitted by the package default or installed support CSS.

Source-read flips, fixture override proofs, Wavemap theme migration, and compatibility alias removal were intentionally
handled as separate tranches with compile proofs and consumer status checks.

For the first private npm proof, the package should ship with `--cui-*` as the canonical CSS variable prefix.

## Implementation Sequence

### Stage 0: Baseline

- Run or record the current focused Amino CLI/package baseline.
- Run or record the current focused fixture baseline.
- Keep this packet and the Wavemap handoff note synchronized.

### Stage 1: Publication Safety

- [x] Remove, rename, or quarantine legacy `pub:*` scripts that publish with `--access public`.
- [x] Move `prepublishOnly` from a hard blocker to the guarded private publish preflight once the first CLI package
      policy is approved.
- [x] Add a `release:check` guard that fails if `pub:*`, script-level publish commands, `--access public`, public
      `publishConfig.access`, an unexpected package name/version, missing restricted access, or an unexpected package
      file allowlist return.
- [x] Add explicit private-pack proof scripts after their command names and package files are reviewed.

### Stage 2: Package And Command Rename

- [x] Rename package manifest identities and workspace filters.
- [x] Rename the CLI bin to canonical `codon-ui`.
- [x] Add Codon-era `cui` and `codonui` bin aliases without restoring old Amino aliases.
- [x] Update docs and examples that refer to `aminoui-cli` or `aui`.
- [x] Run focused CLI tests, typecheck, lint, build, docs format, and `git diff --check`.

### Stage 3: Consumer Contract Rename

- [x] Rename config and lockfile constants to `codon-ui.config.json` and `codon-ui.lock.json`.
- [x] Update init output, loaders, schemas, JSON contract tests, and fixture expected reports.
- [x] Default greenfield `registry-contained` layout to `src/components/_codon-ui-registry`.
- [x] Keep explicit existing registry paths authoritative through config and lockfile records.

### Stage 4: Registry Identity Rename

- Rename `sourcePackage` and local source identities to Codon UI values.
- Regenerate or update local registry snapshots from the canonical manifest.
- Verify registry manifest, registry graph, local snapshot consistency, CLI tests, and fixture replay proofs.

### Stage 5: Private Pack Proof

- [x] Define `files` allowlists for the publishable CLI package.
- [x] Ensure built output, executable bin, bundled registry snapshots, and source payload are included.
- [x] Prove the local tarball installs into a clean external fixture without local monorepo paths.
- [x] Run installed-tarball `codon-ui init`, `add switch`, `status switch`, `diff switch`, and a compile proof from the
      external fixture.
- [ ] After each private publish, run registry-backed smoke checks. For pnpm, use the explicit package form when invoking
      the CLI from a temporary install, such as `pnpm --package=@codon-ui/cli@0.1.2 dlx codon-ui`.

### Stage 6: Private Publish

- Publish the minimum private package set under `@codon-ui` with `--access restricted` only after pack/install proof.
- Record consumer auth requirements without committing secrets.
- Add a clean personal-project proof after Wavemap so the distribution model is not Wavemap-shaped only.

### Stage 7: Repository And Directory Rename

- Rename repositories and local directories after the package and consumer proofs are stable.
- Update sibling-repo references, working notes, and fixture evidence paths after the physical rename.

## Verification Expectations

For this packet-only slice:

```sh
pnpm -F @codon-ui/docs format:check
git diff --check
```

For later implementation slices, use the narrowest matching checks, then fixture replay gates. Expected gates include:

```sh
pnpm -F @codon-ui/cli test
pnpm -F @codon-ui/cli typecheck
pnpm -F @codon-ui/cli lint
pnpm -F @codon-ui/cli build
pnpm -F @codon-ui/react check:contracts
pnpm -F @codon-ui/react build
pnpm verify:evidence-ledger
pnpm verify:json-contracts
pnpm verify:init-lifecycle
pnpm verify:add-lifecycle
pnpm verify:wavemap-like-lifecycle
```

Registry source identities and consumer file names remain deferred to their dedicated stages.

## Stop Conditions

Return to deliberate planning before:

- Publishing any npm package.
- Adding or changing npm auth, tokens, registry settings, or CI release secrets.
- Supporting old Amino consumer files as long-lived compatibility inputs.
- Renaming CSS custom properties.
- Migrating Wavemap's physical `_registry` path.
- Renaming repositories or local directories.
- Starting public registry hosting or CDN artifact distribution.
