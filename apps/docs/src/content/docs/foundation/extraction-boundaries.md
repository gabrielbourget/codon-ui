---
title: Extraction Boundaries
description: Guardrails for source receipt, consumer proofs, and deferred lifecycle work.
---

The component extraction proof has moved from first-source planning into local registry receipt and consumer reinstall
evidence. The boundary now protects the split between reusable source, consumer adapters, and deferred lifecycle tooling.

## Closed Proof Areas

- Source receipt into `packages/react` for the current reusable component graph.
- Registry activation through `packages/react/src/registry/manifest.ts`.
- Local registry snapshots for support/theme and full React graph planning.
- Consumer fixture evidence for default Vite installs and compile behavior.
- Wavemap delete/reinstall checkpoints for recent registry items.
- Default `registry-contained` consumer layout with `_registry` support paths.
- Config and lockfile ownership through `amino-ui.config.json` and `amino-ui.lock.json`.

## Consumer-Owned Boundaries

The following stay outside Amino UI by default:

- API contracts, DTOs, route/query state, saved views, translations, and providers.
- Media upload and gallery flows.
- Product/domain tables and app-specific table adapters.
- Broad app shell, maps, layout rails, and product navigation.

See [Adapter Boundaries](/component-library/adapter-boundaries/) for the durable rule set.

## Deferred Work

- `update --advisory` and `update --dry-run`.
- Safe remove/delete behavior.
- Focused diff behavior.
- Eject behavior and strict update/eject mutation.
- Public registry hosting and package publication.
- Generated token writers and Waveguide validation.

## Stop Conditions

Return to deliberate planning if a pass requires:

- New dependencies without explicit dependency-policy approval.
- Broad default-theme compatibility aliases.
- Registry builder or hosting policy rewrites.
- Strict update/eject behavior.
- Generated token writers or palette generation.
- Package publication or release automation.
