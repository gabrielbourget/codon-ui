---
title: Component Ingest
description: Source-receipt packet shape for reusable components.
---

Component ingest is the source-receipt contract before a component becomes an active registry item. It makes the source
graph, support files, public exports, theme requirements, dependency policy, and proof checks explicit before files move.

`packages/react/src/registry/ingest.ts` defines the packet shape. It does not copy files, generate registry artifacts,
install dependencies, or mutate consumer projects.

Received components use `*-ingest-packet.data.json` as stable source-receipt metadata and a small TypeScript wrapper to
expose typed packet data. The active manifest owns install planning; packets preserve provenance, public export intent,
import rewrites, exclusions, theme requirements, and verification notes.

## Packet Lifecycle

The packet is the acceptance proposal for a component graph:

1. Record the Wavemap source repository/ref and the source files under review.
2. Classify files by role: runtime source, style, support, theme, asset, or optional test material.
3. List excluded Wavemap paths so consumers and app adapters do not become package source.
4. Record import resolutions that must be handled before or during installation.
5. Declare dependency posture and theme requirements.
6. Name verification commands or scans that prove the receipt.
7. After source exists in `packages/react`, normalize the installable subset into `manifest.ts`.

The packet can be richer than the manifest. For example, it may preserve source provenance, public export intent, or
notes about deferred focused tests, while the manifest stays focused on installable files and dependency maps.

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
| `default-contract`           | The component can use `@codon-ui/react/theme.css` directly.                              |
| `proof-compatibility-bridge` | The proof needs a narrow bridge outside the package default CSS.                         |
| `consumer-owned`             | The component assumes a consumer-owned theme integration that the CLI must validate/add. |

## Manifest Boundary

An ingest packet is not the registry authority after activation. The manifest decides active installable items, files,
registry dependencies, and dependency maps. Packets remain useful for review and CLI metadata that is not part of the
manifest shape.

The CLI can read `packages/CLI/registry/local-react.registry.json` plus packet metadata for local registry items. Advisory
output reports support files, component files, dependency posture, theme requirements, and not-written lockfile effects
without writing files.

Dry-run output reuses the same source and packet metadata to preview write shape. It remains non-mutating, but reports
would-write file counts, existing target blockers, dependency decision counts, and `would-write` lockfile effects.

## Acceptance Versus Distribution

Acceptance happens in the library monorepo:

- source is present under `packages/react`;
- package exports are explicit;
- package typecheck/build requirements are declared;
- manifest entries describe installable files and dependency edges;
- local snapshots match the manifest.

Distribution happens in the consumer CLI:

- snapshots are read as registry sources;
- install plans resolve paths and dependencies for the target consumer;
- advisory and dry-run output explain the result;
- strict add writes source only when blockers are absent and updates `codon-ui.lock.json`.
