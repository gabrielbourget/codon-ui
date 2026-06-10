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

The remaining blocker before a real private npm proof is publication policy. `packages/CLI/package.json` still carries
legacy public-oriented `pub:*` scripts and old package/bin names.

## Recommended Naming Decisions

These are the target decisions for the first implementation tranche unless a later review explicitly changes them.

| Surface                  | Current                                                  | Target                                                   | Decision                                                                                                                                    |
| ------------------------ | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name             | Amino UI                                                 | Codon UI                                                 | Rename user-facing product/docs labels during the rename tranche.                                                                           |
| npm scope                | `@amino-ui` / unscoped CLI                               | `@codon-ui`                                              | Use the reserved private npm organization scope.                                                                                            |
| CLI package              | `aminoui-cli`                                            | `@codon-ui/cli`                                          | Scope the CLI package before publication.                                                                                                   |
| CLI command              | `aminoui-cli`, `aui`                                     | `codon-ui`                                               | Prefer one durable bin for the private proof; users can create local shell aliases.                                                         |
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

| Area                       | Examples                                                                                      | Handling                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Package manifests          | root `amino-ui`, `aminoui-cli`, `@amino-ui/react`, `@amino-ui/docs`, `@amino-ui/shared-utils` | Rename in one package-manifest tranche with lockfile update and focused package checks.                                         |
| CLI bins and help          | `aminoui-cli`, `aui`, root command names, command examples                                    | Move to `codon-ui`; avoid long-lived old aliases.                                                                               |
| Consumer files             | `amino-ui.config.json`, `amino-ui.lock.json`                                                  | Rename schemas, constants, init output, status/diff/update/remove/eject loaders, tests, and fixtures together.                  |
| Config schema URL          | `https://aminoui.com/schema.json`                                                             | Do not invent a public URL casually. Choose a private-proof schema URL or omit/update `$schema` in the implementation tranche.  |
| Registry metadata          | `sourcePackage`, source identities, local registry snapshot files                             | Rename manifest data and regenerate/verify snapshots in the same tranche.                                                       |
| Default layout             | `src/components/_registry`                                                                    | Default new consumers to `src/components/_codon-ui-registry`; preserve explicit existing paths through lockfile/config records. |
| Fixture repository         | fixture names, evidence Markdown, structured proof ledger, package scripts, expected output   | Rename only with replay proofs that establish equivalent Codon behavior.                                                        |
| Wavemap consumer           | local `_registry` imports, config, lockfile, source provenance                                | Defer physical path migration until a Wavemap-specific pass updates imports, config, lockfile records, and tests together.      |
| Docs labels                | Amino UI docs, CLI examples, registry contracts, fixture evidence docs                        | Rename staged docs labels without implying public hosting or open-source distribution.                                          |
| Release scripts            | `pub:*`, public `npm publish --access public`                                                 | Replace or quarantine before any real publish path exists.                                                                      |
| Repository/directory names | `amino-ui`, `amino-ui-consumer-fixtures`                                                      | Rename after package/tarball and consumer proofs pass, so local evidence remains traceable during implementation.               |

## Theme Token Prefix

The current CSS custom property prefix is `--aui-`. It is a real theme contract, not just branding text.

Do not fold a CSS token-prefix migration into the first package/config rename tranche. A future theme-contract pass should
decide whether to keep `--aui-` as historical internal token vocabulary or migrate to a Codon prefix such as
`--codon-ui-` / `--cui-`. That pass needs its own component CSS updates, fixture compile proofs, Wavemap theme migration,
and visual review.

For the first private npm proof, the package rename may ship with existing `--aui-` tokens only if the docs clearly mark
that prefix as the current theme contract rather than settled long-term branding.

## Implementation Sequence

### Stage 0: Baseline

- Run or record the current focused Amino CLI/package baseline.
- Run or record the current focused fixture baseline.
- Keep this packet and the Wavemap handoff note synchronized.

### Stage 1: Publication Safety

- Remove, rename, or quarantine legacy `pub:*` scripts that publish with `--access public`.
- Add explicit private-pack proof scripts only after their command names and package files are reviewed.
- Verify no script can accidentally publish `aminoui-cli` or public Codon packages.

### Stage 2: Package And Command Rename

- Rename package manifest identities and workspace filters.
- Rename the CLI bin to `codon-ui`.
- Update docs and examples that refer to `aminoui-cli` or `aui`.
- Run focused CLI tests, typecheck, lint, build, docs format, and `git diff --check`.

### Stage 3: Consumer Contract Rename

- Rename config and lockfile constants to `codon-ui.config.json` and `codon-ui.lock.json`.
- Update init output, loaders, schemas, JSON contract tests, and fixture expected reports.
- Default greenfield `registry-contained` layout to `src/components/_codon-ui-registry`.
- Keep explicit existing registry paths authoritative through config and lockfile records.

### Stage 4: Registry Identity Rename

- Rename `sourcePackage` and local source identities to Codon UI values.
- Regenerate or update local registry snapshots from the canonical manifest.
- Verify registry manifest, registry graph, local snapshot consistency, CLI tests, and fixture replay proofs.

### Stage 5: Private Pack Proof

- Define `files` allowlists for the publishable CLI package.
- Ensure built output, executable bin, bundled registry snapshots, and source payload are included.
- Prove `npm pack` installs into a clean external fixture without local monorepo paths.
- Run `pnpm dlx @codon-ui/cli init`, `add`, `status`, `diff`, and a compile proof from the installed package.

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
pnpm -F @amino-ui/docs format:check
git diff --check
```

For later implementation slices, use the narrowest matching checks, then fixture replay gates. Expected gates include:

```sh
pnpm -F aminoui-cli test
pnpm -F aminoui-cli typecheck
pnpm -F aminoui-cli lint
pnpm -F aminoui-cli build
pnpm -F @amino-ui/react check:contracts
pnpm -F @amino-ui/react build
pnpm verify:evidence-ledger
pnpm verify:json-contracts
pnpm verify:init-lifecycle
pnpm verify:add-lifecycle
pnpm verify:wavemap-like-lifecycle
```

Command names in this verification list should be updated as the package rename lands.

## Stop Conditions

Return to deliberate planning before:

- Publishing any npm package.
- Adding or changing npm auth, tokens, registry settings, or CI release secrets.
- Supporting old Amino consumer files as long-lived compatibility inputs.
- Renaming CSS custom properties.
- Migrating Wavemap's physical `_registry` path.
- Renaming repositories or local directories.
- Starting public registry hosting or CDN artifact distribution.
