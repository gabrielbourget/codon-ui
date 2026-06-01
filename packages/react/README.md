# @amino-ui/react

Canonical React source package for Amino UI components.

This package now owns the first received `Switch` source slice. It exists to establish package ownership, exports,
verification, registry manifests, and the default CSS entrypoint before consumer-side delete-and-rehydrate proof work.

Current boundaries:

- Component source belongs under `src/`; `Switch` currently lives under `src/components/Switch`.
- Package-facing exports belong in `src/index.ts`.
- Default package CSS is exported as `@amino-ui/react/theme.css`.
- The default CSS contract is tracked in `../../docs/roadmaps/react-theme-css-contract.md`.
- Internal registry manifest skeletons belong under `src/registry`.
- The CLI local support registry snapshot must match the support/theme subset of `src/registry/manifest.ts`.
- React, React DOM, and React Aria Components are peer dependencies.
- `classnames` is a runtime dependency while the received `Switch` source still uses it.

Not included yet:

- Registry artifact generation or local registry snapshot codegen.
- CLI install, update, or diff behavior.
- Generated token files or token writers.
- Broad Wavemap compatibility aliases in the default theme.
- Package-side component test harness.
