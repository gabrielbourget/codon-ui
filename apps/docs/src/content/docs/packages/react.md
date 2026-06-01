---
title: "@amino-ui/react"
description: The private React source receiver package.
---

`@amino-ui/react` is currently private. It is the canonical home for future React component source, package default CSS,
support tokens, and registry manifests.

## Current Surface

- `src/index.ts` is intentionally empty.
- `theme.css` is exported as `@amino-ui/react/theme.css`.
- `src/components/Switch/switch-compatibility.css` owns the narrow proof-local bridge for the first `Switch` trial.
- `src/tokens/geometry.ts` owns corner geometry support.
- `src/tokens/theme-order.ts` owns theme-order support.
- `src/registry/manifest.ts` owns the internal registry manifest.
- `src/registry/ingest.ts` owns the type-only component receipt packet shape.
- `src/registry/switch-ingest-packet.data.json` owns the non-active draft packet data for the first `Switch` proof.
- `src/registry/switch-ingest-packet.ts` exposes that data as the typed draft packet.

## Peer Policy

React and React DOM are the only current package peers.

The draft `Switch` packet treats React Aria Components as a first-proof peer requirement at `^1.17.0` and `classnames`
as implementation runtime surface at `^2.3.2`. Neither package has been installed in `@amino-ui/react` yet because source
receipt has not happened.

## Current Non-Goals

- Public token exports.
- Published package artifacts.
- Component source.
- Active `Switch` component registry metadata.
- Component test harness.
- Runtime provider or generated theme machinery.
