---
title: "@codon-ui/react"
description: The private React source receiver package.
---

`@codon-ui/react` is currently private. It is the canonical home for React component source, package default CSS,
support tokens, and registry manifests.

## Current Surface

- `src/index.ts` exports the package-facing component surface.
- `src/components` contains received reusable component source, helpers, labels, icons, and CSS modules.
- `theme.css` is exported as `@codon-ui/react/theme.css`.
- `theme.css` exposes the canonical `--cui-*` custom properties; the legacy `--aui-*` compatibility aliases were removed
  after the source flip, fixture, and Wavemap consumer proofs passed.
- `src/theme` owns narrow theme support files that stay outside the default CSS contract.
- `src/tokens` owns registry-owned support tokens.
- `src/registry/manifest.ts` owns the internal registry manifest.
- `src/registry/ingest.ts` owns the type-only component receipt packet shape.
- `src/registry/*-ingest-packet.data.json` records source-receipt metadata for received components.
- Verification scripts such as `verify-table-proof.mjs` and `verify-sort-and-filter-panel-proof.mjs` prove focused
  source receipt boundaries.

## Registry Surface

The active React manifest currently contains 73 items: 52 components, 9 support items, and 12 theme items.

`@codon-ui/react` remains the source of truth. CLI local snapshots are derived from this package and checked so they do
not drift from the manifest.

## Distribution Contract

For the first private npm proof, `@codon-ui/react` remains the canonical source identity but not the runtime source
package that `npx` must resolve. The CLI package bundles a generated source snapshot at pack time so source-installed
consumer workflows can be proven with one private npm package first.

The mature distribution model is still a split package contract: `@codon-ui/cli` owns command behavior and
`@codon-ui/react` owns the versioned registry/source artifact. Moving to that model requires `@codon-ui/react` to publish
registry metadata and source files intentionally, not only `dist` and `theme.css`, and requires the CLI to resolve those
assets from the installed React package.

## Peer Policy

React, React DOM, React Aria, React Aria Components, and Radix Avatar are current package peers. Runtime dependencies
cover implementation packages such as `classnames`, `date-fns`, `embla-carousel`, `@internationalized/date`, and
`motion`.

Manifest entries classify peer, runtime, and dev dependencies per registry item so the CLI can report dependency status
without installing packages by default.

## Current Non-Goals

- Public token exports.
- Publishing `@codon-ui/react` as the source artifact for the first private CLI proof.
- Hosted registry artifacts.
- Runtime provider or generated theme machinery.
