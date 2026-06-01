# Amino UI Docs

This app is the first static documentation surface for the Amino UI monorepo.

It is intentionally a local documentation foundation. Hosting, deployment workflows, versioned docs, generated registry
docs, and public site policy remain separate decisions.

## Commands

```sh
pnpm -C apps/docs dev
pnpm -C apps/docs build
pnpm -C apps/docs preview
```

## Content Policy

- Put durable docs pages under `src/content/docs`.
- Keep active planning documents in the root `docs/roadmaps` folder until they are ready to become curated docs pages.
- Keep Wavemap-specific extraction evidence in Wavemap's `COMPONENT_LIBRARY_EXTRACTION.md`.
- Do not publish component API docs before the component source exists in Amino UI.
- Keep generated registry artifacts and deploy evidence out of the docs app until those policies are approved.
