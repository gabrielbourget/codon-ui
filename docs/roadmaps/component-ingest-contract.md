# Component Ingest Contract

## Purpose

Component ingest is the source-receipt step before a component becomes an active registry item.

The ingest packet should make source ownership, dependency graph content, public exports, theme requirements, and proof
verification explicit before files move from Wavemap into Amino UI.

## Current Status

`packages/react/src/registry/ingest.ts` defines a type-only packet shape. It does not copy files, generate registry
artifacts, install dependencies, or mutate consumers.

The first packet target remains `Switch`, but no `Switch` packet is active yet.

## Packet Shape

The packet captures:

| Area                  | Purpose                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `name` and `type`     | Registry identity and category for the received source graph.                               |
| Source provenance     | Source repository/ref metadata for the extraction proof record.                             |
| `files`               | Explicit source, style, test, support, theme, and asset files with target roles.            |
| `publicExports`       | Component and type exports that should become package surface.                              |
| `importResolutions`   | App-local imports, support imports, and advisory rewrites that must be settled during copy. |
| `excludedSourcePaths` | Consumers and app-owned files that must not travel with the component.                      |
| Dependencies          | Registry, peer, runtime, and dev dependency declarations.                                   |
| `themeRequirements`   | Default theme use, proof compatibility bridge needs, or consumer-owned theme assumptions.   |
| `verification`        | Commands or scans needed to prove the receipt; each step can be advisory.                   |

The ingest packet should be normalized into manifest items only after the source files exist in `packages/react` and the
dependency/theme decisions are approved.

## Theme Strategies

The initial type contract names three strategies:

| Strategy                     | Meaning                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `default-contract`           | The component can use `@amino-ui/react/theme.css` directly.                              |
| `proof-compatibility-bridge` | The proof needs a narrow bridge outside the package default CSS.                         |
| `consumer-owned`             | The component assumes a consumer-owned theme integration that the CLI must validate/add. |

`Switch` should start with `proof-compatibility-bridge` unless a later pass approves rewriting its CSS directly to the
current `--aui-` theme contract.

## Dependency Graph Content

Each ingest file uses the same role-based destination model as the manifest contract:

- `targetRole` decides the consumer bucket, such as components, tokens, utilities, types, theme, or assets.
- `targetPath` is relative to the selected root for that role.
- Support content can therefore land in a contained registry directory for the default proof or map into a consumer's
  existing source conventions later.

This keeps the first proof minimal while preserving room for richer consumer layouts.

## First `Switch` Packet Checklist

- [ ] Record source provenance from Wavemap.
- [ ] List `Switch.tsx`, `helpers.tsx`, `SwitchStyles.module.css`, and focused test material.
- [ ] Mark Wavemap app call sites as excluded consumer paths.
- [ ] Declare support dependencies on `theme-css`, `tokens/geometry`, and `tokens/theme-order`.
- [ ] Decide React Aria Components and `classnames` versions before activation.
- [ ] Record proof-local compatibility bridge requirements.
- [ ] Record forbidden-import scans and focused verification commands.
- [ ] Normalize into an active manifest item only after source receipt.

## Stop Conditions

Return to deliberate planning if ingest work requires:

- Moving `Switch` or another Wavemap component before the packet is approved.
- Adding dependency installs or lockfile changes.
- Generating token writers.
- Implementing CLI install/update/diff/status/ejection behavior.
- Committing generated registry artifacts as source.
- Deciding package publication or release automation.
