---
title: Source Graph
description: Canonical reusable React component source in Codon UI.
---

`packages/react` is the canonical local source receiver for the reusable React component graph extracted from Wavemap.
It owns component source, component-local CSS modules, helpers, labels, package default theme CSS, support tokens, and
the manifest entries that describe installable source slices.

## Current Receipt

The active manifest currently contains 73 registry items:

| Item type   | Count | Role                                                                 |
| ----------- | ----- | -------------------------------------------------------------------- |
| `component` | 52    | Reusable React component source and component-local style files.     |
| `support`   | 9     | Token/support modules installed before components that depend on it. |
| `theme`     | 12    | Default theme CSS and narrow compatibility CSS files.                |

The received graph covers primitives, composed controls, overlays, table/filtering/query support, typeahead controls,
thumbnail fallback, loaders, and `SortAndFilterPanel`.

## Acceptance Flow

A reusable component is accepted into the library monorepo through an evidence trail, not by copying a folder and fixing
imports afterward.

| Step | Owner surface                        | What must become true                                                                  |
| ---- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| 1    | Wavemap extraction notes             | Candidate is classified as reusable, adapter-heavy/later, or Wavemap-local.            |
| 2    | `src/registry/*-ingest-packet.*`     | Packet records provenance, source files, exclusions, dependency posture, and proofs.   |
| 3    | `src/components/*` and support paths | Runtime source is copied into package-owned paths with app/domain imports removed.     |
| 4    | `packages/react/package.json`        | Package can typecheck/build by declaring needed peers, runtime deps, and dev deps.     |
| 5    | `src/index.ts`                       | The package-facing component and type exports are explicit.                            |
| 6    | `src/registry/manifest.ts`           | The source graph is activated as registry items with files and registry dependencies.  |
| 7    | CLI local registry snapshots         | Generated or updated snapshots match the manifest and feed install plans.              |
| 8    | Consumer fixtures and Wavemap        | Advisory, dry-run, strict install, and mature-consumer reinstall evidence is recorded. |

The acceptance point is the manifest activation plus verification evidence. Ingest packets remain review metadata after
activation; the manifest becomes the install authority.

## Acceptance Criteria

Accepted component source should satisfy these conditions:

- Source paths live under `packages/react` and avoid Wavemap app aliases.
- Consumer call sites and app adapters are listed as exclusions, not copied into the package.
- Package-local imports point at package-local source before distribution.
- Registry dependencies name support/theme items instead of relying on implicit directory presence.
- Peer and runtime dependencies are declared in the manifest and in package metadata where the private package needs them
  to typecheck or build.
- A focused proof script or contract check verifies the receipt boundary.
- The local registry snapshot and consumer fixture evidence prove the CLI can resolve the graph.

## Acceptance Checklist

Use this checklist when a reusable graph moves from Wavemap evidence into Codon UI source.

### Before Receipt

- [ ] Classify the candidate as reusable source, adapter-heavy/later, or consumer-local.
- [ ] List every runtime, style, support, theme, asset, and optional test file under review.
- [ ] List excluded consumer files, including call sites, adapters, translations, route/query state, DTOs, providers, and
      product workflows.
- [ ] Scan imports for Wavemap aliases, route state, API contracts, app providers, i18n adapters, and product media/query
      dependencies.
- [ ] Decide the theme strategy: default contract, narrow compatibility bridge, or consumer-owned mapping.
- [ ] Classify external packages as peer, runtime, or dev dependencies.

### During Receipt

- [ ] Copy only approved source into `packages/react/src`.
- [ ] Replace Wavemap-local imports with package-local or registry-owned support imports.
- [ ] Keep component-local CSS modules, helpers, labels, and small defaults beside the component graph.
- [ ] Add package-facing exports for the public component and supported public types.
- [ ] Add or update focused package proof scripts, source scans, or tests for the received graph.
- [ ] Add an ingest packet that preserves provenance, exclusions, import resolutions, dependency posture, theme
      requirements, public export intent, and verification notes.

### Activation And Proof

- [ ] Activate installable items in `packages/react/src/registry/manifest.ts`.
- [ ] Declare registry dependencies instead of relying on implicit sibling files.
- [ ] Refresh or update local registry snapshots from the manifest.
- [ ] Run package contract checks and CLI local-registry tests.
- [ ] Add fixture evidence for advisory, dry-run, strict install, lockfile metadata, dependency posture, and compile
      behavior.
- [ ] Reinstall the graph in Wavemap only after fixture proof is present, preserving consumer-owned adapters.

## Source Ownership

Canonical source lives under `packages/react/src` and `packages/react/theme.css`.

| Source area                         | Owns                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `src/components/*`                  | Runtime component source, helpers, labels, icons, and CSS modules.          |
| `src/components/Table/*`            | Table source plus reusable filter draft, filter metadata, and query types.  |
| `src/components/Filtering/*`        | Reusable filter row and dynamic filter argument support.                    |
| `src/components/Search/*`           | Typeahead search source shared by typeahead-style consumers.                |
| `src/tokens/*`                      | Registry-owned support tokens such as geometry, placement, motion, and SVG. |
| `src/theme/*` and component bridges | Narrow CSS compatibility files that remain outside the default theme.       |
| `src/registry/*`                    | Ingest packets, manifest, graph planner, and registry type contracts.       |

`packages/react/src/index.ts` exports the package-facing component surface. Internal support tokens remain implementation
support unless a later public API pass deliberately promotes them.

## Registry Relationship

The source graph is not generated registry output. The data flow is:

```text
packages/react source + explicit manifest -> local registry snapshots -> CLI install plans
```

The manifest declares the installable graph. Local registry snapshots let the CLI plan and apply consumer installs before
public registry hosting or generated artifact publication exists.

## Distribution Shape

Consumers do not import directly from `packages/react` during the current source-installed proof. Instead, the CLI
distributes source slices:

1. A registry item lists source files and target roles.
2. The graph planner adds registry dependencies before the requested component.
3. The install plan resolves target paths for the consumer layout.
4. Dry-run/advisory modes report the plan without writes.
5. Strict add writes source and support files, rewrites package-local relative imports to installed relative paths, and
   records file hashes in `codon-ui.lock.json`.

## Current Non-Goals

- Public package publication.
- Hosted public registry artifacts.
- Generated token writers or palette generation.
- Broad theme compatibility aliases in `theme.css`.
- Consumer app adapters, providers, route state, DTOs, translations, media upload flows, or product/domain tables.
