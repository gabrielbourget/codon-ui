---
title: Amino UI
description: Component-library foundation, registry, and extraction planning docs.
---

Amino UI is being renovated into the canonical source for reusable React component source, registry manifests, default
theme CSS, and future source-distribution tooling.

The current repository state is foundation-only. It defines the monorepo shape and receiver contracts that must exist
before Wavemap component source moves into this repo.

## Current Status

- `@amino-ui/react` exists as the private React source receiver package.
- `@amino-ui/react/theme.css` is a hand-authored default CSS contract.
- Registry manifests can express tracked theme/support files.
- CI and local verification commands are in place.
- Internal geometry and theme-order token support exists for the future `Switch` proof.

No component source has moved yet.

## Start Here

- [Monorepo Layout](/foundation/monorepo/) explains package ownership.
- [Verification](/foundation/verification/) lists the local and CI parity commands.
- [Extraction Boundaries](/foundation/extraction-boundaries/) captures the guardrails for the first component proof.
- [`@amino-ui/react`](/packages/react/) summarizes the receiver package.
- [Registry Contracts](/registry/contracts/) explains the current manifest posture.
