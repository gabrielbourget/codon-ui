---
title: Codon UI
description: Component-library source, registry, CLI, and verification docs.
---

Codon UI is the canonical local receiver for the reusable React component graph extracted from Wavemap. It now owns the
React source package, registry manifest, local registry snapshots, default theme CSS, and CLI planning surface used by
consumer reinstall proofs.

The current docs separate durable contracts from roadmap planning. Use these pages as the reference for what the repo
currently owns; roadmap files remain useful for remaining lifecycle work and deferred decisions.

## Current Status

- `@codon-ui/react` owns received reusable component source and package-facing exports.
- `packages/react/src/registry/manifest.ts` owns the active React registry graph.
- Local registry snapshots feed CLI planning and strict single-component installs before public hosting exists.
- `codon-ui.config.json` and `codon-ui.lock.json` model consumer setup intent and generated install provenance.
- Wavemap remains the mature consumer proof target; Wavemap-owned adapters stay local.

## Start Here

- [Monorepo Layout](/foundation/monorepo/) explains package ownership.
- [Verification](/foundation/verification/) lists the local and CI parity commands.
- [Extraction Boundaries](/foundation/extraction-boundaries/) captures the current guardrails after source receipt.
- [Source Graph](/component-library/source-graph/) explains what the component package now owns.
- [Adapter Boundaries](/component-library/adapter-boundaries/) records what stays in consumers.
- [Consumer Proofs](/component-library/consumer-proofs/) explains Wavemap reinstall evidence and adapter preservation.
- [`@codon-ui/react`](/packages/react/) summarizes the receiver package.
- [Registry Contracts](/registry/contracts/) explains the current manifest posture.
- [Local Snapshots](/registry/local-snapshots/) explains checked-in registry snapshots for CLI planning.
- [CLI Baseline Contract](/cli/baseline-contract/) records the renovated CLI surface.
- [Consumer Lifecycle](/cli/consumer-lifecycle/) explains config, lockfile, ownership, and preservation defaults.
- [Fixture Evidence](/cli/fixture-evidence/) defines repeatable proof packets for CLI command behavior.
