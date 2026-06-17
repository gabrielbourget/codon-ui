# Codon UI Web App

This app is a lightweight Next.js surface for Codon UI web experiments. It does
not own registry source, registry manifests, or generated registry artifacts.

Canonical registry source lives under `packages/react`; the current publishable
CLI proof bundles manifest-derived snapshots and source files from
`packages/CLI`.

## Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm stylelint
```

Use the root package scripts for repository verification.
