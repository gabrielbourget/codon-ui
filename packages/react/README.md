# @amino-ui/react

Canonical React source package for Amino UI components.

This package is currently an empty receiver shell. It exists to establish package ownership, exports, verification, and
the default CSS entrypoint before any Wavemap component source is moved into the monorepo.

Current boundaries:

- Component source belongs under `src/`.
- Package-facing exports belong in `src/index.ts`.
- Default package CSS is exported as `@amino-ui/react/theme.css`.
- The default CSS contract is tracked in `../../docs/roadmaps/react-theme-css-contract.md`.
- React and React DOM are peer dependencies.
- React Aria dependencies should be added only when the first component that needs them lands.

Not included yet:

- Wavemap component source.
- Registry artifact generation.
- CLI install, update, or diff behavior.
- Generated token files or token writers.
