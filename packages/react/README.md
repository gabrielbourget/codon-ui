# @codon-ui/react

Canonical React source package for Codon UI components.

This package owns the received reusable React source surface, package-facing exports, source-receipt verification,
registry manifests, and the default CSS entrypoint used by Codon UI consumers.

Current boundaries:

- Component source belongs under `src/components`.
- Package-facing exports belong in `src/index.ts`.
- Default package CSS is exported as `@codon-ui/react/theme.css`.
- The default CSS contract is tracked in `../../docs/roadmaps/react-theme-css-contract.md`.
- Internal registry manifest skeletons belong under `src/registry`.
- The CLI local support registry snapshot must match the support/theme subset of `src/registry/manifest.ts`.
- The CLI full local React registry snapshot must match all active entries in `src/registry/manifest.ts`.
- React, React DOM, and React Aria Components are peer dependencies.
- Runtime dependencies cover implementation packages used by the received source graph.
- Package-side component tests live next to component source under `src/components/**/__tests__`.
- Source-receipt proof scripts such as `verify-table-proof.mjs` and `verify-sort-and-filter-panel-proof.mjs` protect
  package ownership, registry graph, and source boundary assumptions.

Not included yet:

- Registry artifact generation or local registry snapshot codegen.
- Generated token files or token writers.
- Broad Wavemap compatibility aliases in the default theme.
- Wavemap app-specific adapters such as forms, providers, domain tables, galleries, sheets, nav surfaces, upload/media
  workflows, saved views, and route/query-state tests.
