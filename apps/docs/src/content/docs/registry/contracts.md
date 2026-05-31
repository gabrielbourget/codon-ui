---
title: Registry Contracts
description: Current manifest and artifact policy.
---

The registry contract is intentionally small. Canonical source should live in `packages/react`; generated artifacts should
be derived from tracked source and explicit manifests.

## Source Of Truth

```text
packages/react source + explicit registry manifests -> generated registry artifacts
```

The current active manifest entries are support-only:

| Item                 | Role                           |
| -------------------- | ------------------------------ |
| `theme-css`          | Package default CSS support.   |
| `tokens/geometry`    | Corner geometry token support. |
| `tokens/theme-order` | Theme-order token support.     |

No component manifest entry is active yet.

## Artifact Policy

`public/registry` should be treated as generated build output unless a later release or deployment policy deliberately
chooses to track generated artifacts.

The current web app still has legacy registry code. Do not treat it as authoritative for future source ownership.

## Future First Proof

The first `Switch` proof should depend on explicit file lists or manifest entries. It should not rely on broad directory
copies, generated output directories, or CLI behavior that has not been proven.
