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

## Peer Policy

React, React DOM, React Aria, React Aria Components, and Radix Avatar are current package peers. Runtime dependencies
cover implementation packages such as `classnames`, `date-fns`, `embla-carousel`, `@internationalized/date`, and
`motion`.

Manifest entries classify peer, runtime, and dev dependencies per registry item so the CLI can report dependency status
without installing packages by default.

## Current Non-Goals

- Public token exports.
- Published package artifacts.
- Hosted registry artifacts.
- Runtime provider or generated theme machinery.
