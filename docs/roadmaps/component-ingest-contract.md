# Component Ingest Contract

## Purpose

Component ingest is the source-receipt step before a component becomes an active registry item.

The ingest packet should make source ownership, dependency graph content, public exports, theme requirements, and proof
verification explicit before files move from Wavemap into Amino UI.

## Graduated Reference

Stable source-receipt guidance has moved into the docs site:

- `apps/docs/src/content/docs/component-library/source-graph.md`
- `apps/docs/src/content/docs/component-library/adapter-boundaries.md`
- `apps/docs/src/content/docs/registry/ingest.md`

Keep this roadmap focused on remaining ingest decisions and historical proof context.

## Current Status

`packages/react/src/registry/ingest.ts` defines a type-only packet shape. It does not copy files, generate registry
artifacts, install dependencies, or mutate consumers.

The first concrete packet target is now represented by
`packages/react/src/registry/switch-ingest-packet.data.json`, with
`packages/react/src/registry/switch-ingest-packet.ts` exposing the typed packet. The runtime `Switch` source now points at
copied package source and `switch` is active in the producer manifest. The packet now provides advisory metadata while
install-plan files come from the local React registry source.

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

The ingest packet can be normalized into manifest items only after the source files exist in `packages/react` and the
dependency/theme decisions are approved. `Switch` has passed that producer-side checkpoint; strict consumer installation
remains separate.

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

- [x] Record source provenance from Wavemap.
- [x] List `Switch.tsx`, `helpers.tsx`, `SwitchStyles.module.css`, and focused test material.
- [x] Mark Wavemap app call sites as excluded consumer paths.
- [x] Declare support dependencies on `theme-css`, `theme/switch-compatibility`, `tokens/geometry`, and
      `tokens/theme-order`.
- [x] Decide first-proof React Aria Components and `classnames` ranges before activation.
- [x] Record proof-local compatibility bridge requirements.
- [x] Record forbidden-import scans and focused verification commands.
- [x] Make the packet readable by CLI advisory planning without making it the registry item authority.
- [x] Normalize into an active manifest item only after source receipt.

## `Switch` Packet Read

The packet captures:

- Package source paths for `Switch.tsx`, `helpers.tsx`, and `SwitchStyles.module.css`; the focused test remains optional
  deferred proof material.
- Role-based consumer targets under `Switch/...` so the default `components` role resolves to `src/components/Switch/...`
  instead of duplicating a `components` path segment.
- Public surface intent: named `Switch` export and package-facing `SwitchProps` type aliasing the current `TSwitchProps`
  source name.
- Import rewrites from Wavemap's `_registry/tokens` alias to package-local geometry and theme-order modules.
- Exclusions for Settings form usage, boolean filter usage, component showcase usage, and commented legacy event-form
  scratch.
- Existing support dependencies on `theme-css`, `theme/switch-compatibility`, `tokens/geometry`, and
  `tokens/theme-order`.
- First-proof dependency posture: React and React DOM peers, React Aria Components peer at `^1.17.0`, and `classnames`
  runtime dependency at `^2.3.2`; test packages are deferred until the testing work area.
- Default theme variables already covered by `theme.css` and missing compatibility variables that require a narrow
  proof-local bridge.

The packet deliberately keeps `calibrateComponent`, `DEFAULT_ON_ICON`, and `DEFAULT_OFF_ICON` private unless a later
public API review says otherwise.

`add switch --advisory --json` now reads `switch` from `packages/CLI/registry/local-react.registry.json` and reads the
packet for metadata only. The non-mutating plan reports support files, received component files, public export intent,
import rewrites, theme requirements, dependency classification, available source status for the received runtime `Switch`
files, and planned-but-not-written lockfile effects. The deferred optional focused test is packet metadata only until the
component-library testing work area.

`add switch --dry-run --json` now reuses that same registry source and packet metadata to preview the first strict-write
shape without mutating the consumer. The dry-run output reports existing target blockers, available write candidates,
dependency decision counts, and `would-write` lockfile effects while still leaving config, files, lockfiles, directories,
and package metadata untouched.

## Stop Conditions

Return to deliberate planning if ingest work requires:

- Moving another Wavemap component before the packet is approved.
- Adding unapproved dependency installs or lockfile changes.
- Generating token writers.
- Implementing CLI install/update/diff/status/ejection behavior.
- Committing generated registry artifacts as source.
- Deciding package publication or release automation.
