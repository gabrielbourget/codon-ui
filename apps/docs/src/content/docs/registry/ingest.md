---
title: Component Ingest
description: Type-only packet shape for receiving component source.
---

Component ingest is the source-receipt contract before a component becomes an active registry item. It makes the source
graph, support files, public exports, theme requirements, dependency policy, and proof checks explicit before files move.

`packages/react/src/registry/ingest.ts` defines the current type-only packet. It does not copy files, generate registry
artifacts, install dependencies, or mutate consumer projects.

`packages/react/src/registry/switch-ingest-packet.data.json` is the first concrete draft packet data source, and
`packages/react/src/registry/switch-ingest-packet.ts` exposes it as a typed packet. It is not an active manifest item and
does not approve source movement, dependency installs, strict `add switch`, or registry artifact generation.

## Packet Areas

| Area               | Purpose                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Identity           | Registry item name and type.                                                              |
| Provenance         | Source repository and source ref metadata.                                                |
| Files              | Source, style, test, support, theme, and asset files with role-based target destinations. |
| Public exports     | Component and type exports that should become package surface.                            |
| Import resolutions | Support imports and advisory rewrites that must be settled during receipt.                |
| Exclusions         | Consumer files and app-owned paths that must not move with the component.                 |
| Dependencies       | Registry dependencies plus peer, runtime, and dev dependency maps.                        |
| Theme requirements | Default contract use, proof compatibility bridges, or consumer-owned theme assumptions.   |
| Verification       | Commands or scans needed to prove the receipt; each step can be advisory.                 |

## Theme Strategies

The initial strategies are:

| Strategy                     | Use when                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `default-contract`           | The component can use `@amino-ui/react/theme.css` directly.                              |
| `proof-compatibility-bridge` | The proof needs a narrow bridge outside the package default CSS.                         |
| `consumer-owned`             | The component assumes a consumer-owned theme integration that the CLI must validate/add. |

## First Proof Boundary

`Switch` remains the first packet target, but the packet is still draft-only. It records source files, optional focused
test material, excluded Wavemap consumers, import rewrites, support dependencies, theme bridge requirements, dependency
posture, and verification commands. It should be normalized into manifest items only after the source files exist in
`packages/react` and the theme/dependency decisions are approved.

The CLI can now read the draft packet for `add switch --advisory --json`. That output is planning evidence only: it
reports support files, draft component files, dependency posture, theme requirements, missing source status, and
not-written lockfile effects without writing files or activating `Switch`.
