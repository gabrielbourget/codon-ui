# First Component Proof Requirements

## Purpose

The first component proof should show that Amino UI can own a small real component graph before broad registry, CLI,
publication, or generated-token work expands around it.

`Switch` remains the likely first proof candidate because Wavemap's polish and extraction roadmaps already classify it as
small, representative, and free of app-domain runtime imports. This document names the approval packet needed before any
source movement.

## Source Roadmaps

Use these Wavemap notes as the current source of truth for candidate readiness:

- `apps/wavemap-docs/working-notes/COMPONENT_LIBRARY_EXTRACTION.md`
- `apps/wavemap-docs/working-notes/WAVEMAP_COMPONENT_POLISH_AUDIT.md`

The Amino UI repo should not duplicate every Wavemap finding. It should track only the target-repo decisions needed to
receive and prove the component.

The first draft `Switch` manifest plan lives in `switch-manifest-plan.md`.

## Required Packet Before Source Movement

The first implementation pass must know:

| Area | Required decision |
| ---- | ----------------- |
| Proof model | Source-installed registry slice, package import, or CLI-installed behavior. The current recommendation is source-installed registry slice first. |
| Proof location | Exact temporary or durable location where the received source graph lands. |
| Public exports | Component export name, props type export name, and whether helper/default values stay private. |
| Source graph | Exact source, style, support, and test files included in the proof. |
| Exclusions | Wavemap consumers and app/domain files that must not travel with the component. |
| Import strategy | Whether source imports are edited in place, rewritten during copy, or routed through package-local support barrels. |
| Theme CSS | Default CSS import path, load order, and whether a Wavemap compatibility bridge is needed. |
| Token support | Concrete import path for geometry and theme-order support. |
| CSS modules | Whether the proof assumes consumer CSS-module support or introduces a build transform. |
| Runtime dependencies | Peer/direct policy for React, React DOM, React Aria Components, `classnames`, and test-only packages. |
| Client boundary | Whether `"use client"` is preserved and how SSR/type-only imports are documented. |
| Verification | Focused tests, smoke checks, forbidden-import scan, typecheck/build commands, and roadmap verification. |

## `Switch` First-Read Assumptions

Carry these assumptions forward from the Wavemap polish audit unless a fresh source audit contradicts them:

- Runtime source files are `Switch.tsx`, `helpers.tsx`, and `SwitchStyles.module.css`.
- The focused Wavemap test is useful proof material, but it needs package-safe imports before it can become a package
  test.
- Current Wavemap consumers prove usage only. Settings, filtering, showcase, and commented legacy consumers should not be
  installed with the component.
- `Switch` should expose a named public component export.
- The package-facing props type should be `SwitchProps`; the first implementation may alias current source naming rather
  than rename everything immediately.
- `calibrateComponent`, `DEFAULT_ON_ICON`, and `DEFAULT_OFF_ICON` should stay private unless a later API review chooses
  otherwise.
- React and React DOM are peers.
- React Aria Components is expected to be a peer for source-installed component proof once `Switch` lands.
- `classnames` is implementation runtime surface, not a consumer-provided platform peer.
- CSS modules are part of the first proof; flattening CSS belongs to a later packaging decision.
- Generated token writers, CLI theme generation, package publication, CLI install/update/diff behavior, and deploy
  workflows are outside the first proof.

## Required Read-Only Evidence

Before implementing the proof, collect and record:

- `Switch` source files and focused test files.
- Direct runtime import graph.
- Forbidden-import scan result for app/domain/runtime coupling.
- Current call sites, classified as consumers rather than source ownership.
- CSS custom properties used by the CSS module, split into component-local channels, package theme roles, and Wavemap
  compatibility aliases if any remain.
- External package and peer/runtime dependency needs.
- Candidate manifest entries or explicit file-list plan.

## Stop Conditions

Return to deliberate planning if the proof requires:

- Moving source before the approval packet is complete.
- New dependency installs or lockfile changes.
- Broad registry builder rewrites.
- CLI install, update, diff, status, or ejection behavior.
- Generated token writers or palette generation.
- Package publication or release automation.
- Wavemap component source edits outside the named proof graph.
- Public prop-contract changes beyond package-facing aliases already approved for the proof.

## Verification Expectations

For this planning document:

- `pnpm check`
- `git diff --check`

For the future first implementation proof:

- `pnpm check`
- `pnpm build:react`
- `pnpm -F @amino-ui/react check:contracts`
- Focused package or consumer tests once the proof harness exists.
- Wavemap roadmap verification when Wavemap notes are updated.
