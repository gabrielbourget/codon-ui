# Codon UI Docs

This app is the first static documentation surface for the Codon UI monorepo.

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
- Keep active library work in `planning/component-library/roadmap.md` and experiment results in its `experiments.md` companion until stable reference is ready for curated docs pages.
- Keep Wavemap-specific extraction evidence in Wavemap's `COMPONENT_LIBRARY_EXTRACTION.md`.
- Do not publish component API docs before the component source exists in Codon UI.
- Keep generated registry artifacts and deploy evidence out of the docs app until those policies are approved.
