---
title: "@amino-ui/react"
description: The private React source receiver package.
---

`@amino-ui/react` is currently private. It is the canonical home for React component source, package default CSS,
support tokens, and registry manifests.

## Current Surface

- `src/index.ts` exports `Switch` and the package-facing `SwitchProps` alias.
- `src/components/Switch` contains the received `Switch` runtime source, helper source, CSS module, and proof-local
  compatibility bridge.
- `theme.css` is exported as `@amino-ui/react/theme.css`.
- `src/tokens/geometry.ts` owns corner geometry support.
- `src/tokens/theme-order.ts` owns theme-order support.
- `src/registry/manifest.ts` owns the internal registry manifest.
- `src/registry/ingest.ts` owns the type-only component receipt packet shape.
- `src/registry/switch-ingest-packet.data.json` owns the packet data that still feeds early `add switch --advisory`
  planning until generated component registry artifacts exist.
- `src/registry/switch-ingest-packet.ts` exposes that data as the typed packet.

## Peer Policy

React, React DOM, and React Aria Components are current package peers.

`Switch` treats React Aria Components as a first-proof peer requirement at `^1.17.0` and `classnames` as implementation
runtime surface at `^2.3.2`. React Aria Components is also a dev dependency so the private package can typecheck and
build the received source.

## Current Non-Goals

- Public token exports.
- Published package artifacts.
- Component test harness.
- Runtime provider or generated theme machinery.
