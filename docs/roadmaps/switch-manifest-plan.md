# Switch Manifest Plan

## Purpose

This records the first `Switch` registry manifest plan and the source-receipt checkpoint.

The typed ingest packet lives at `packages/react/src/registry/switch-ingest-packet.ts`, backed by
`packages/react/src/registry/switch-ingest-packet.data.json`. The runtime source has now been received into
`packages/react/src/components/Switch`, and `switch` is active in `reactRegistryManifest`.

The packet now feeds advisory metadata. The planned install files for `add switch --advisory` come from
`packages/CLI/registry/local-react.registry.json` until generated registry artifacts exist.

## Current Read

Wavemap's read-only `Switch` graph audit confirmed:

- Runtime files are `Switch.tsx`, `helpers.tsx`, and `SwitchStyles.module.css`.
- The focused test is `Switch.test.tsx`.
- Current app consumers are Settings, boolean filter argument input, and the component showcase; they are consumers, not
  source ownership.
- Runtime source has no Wavemap app-domain imports, route imports, API contracts, shared-utils imports, i18n imports,
  browser storage, or broad support folders.
- The only app-alias runtime edge is `_registry/tokens` for geometry and theme-order support.

## Active Registry Item

The active registry item is:

```ts
{
  name: "switch",
  type: REGISTRY_ITEM_TYPE__COMPONENT,
  sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
  files: [
    {
      sourcePath: "packages/react/src/components/Switch/Switch.tsx",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/Switch.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "packages/react/src/components/Switch/helpers.tsx",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/helpers.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "packages/react/src/components/Switch/SwitchStyles.module.css",
      targetRole: REGISTRY_TARGET_ROLE__COMPONENTS,
      targetPath: "Switch/SwitchStyles.module.css",
      role: REGISTRY_FILE_ROLE__STYLE,
    },
  ],
  registryDependencies: [
    "theme-css",
    "theme/switch-compatibility",
    "tokens/geometry",
    "tokens/theme-order",
  ],
  peerDependencies: {
    react: "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0",
    "react-aria-components": "^1.17.0",
  },
  runtimeDependencies: {
    classnames: "^2.3.2",
  },
}
```

The target paths are relative to the configured `components` role. Under the default `registry-contained` consumer
layout, `Switch/Switch.tsx` resolves to `src/components/Switch/Switch.tsx`.

`add switch --advisory --json` can now read the full local React registry source for planned component files and support
graph, then read the packet for public export intent, import rewrites, theme requirements, dependency posture, and
verification notes. That advisory output is not a strict install path.

## Support Items To Decide

The `Switch` proof needs support beyond the three component files:

| Support item                 | Current read                                                                                                   | Decision needed                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-css`                  | `@amino-ui/react/theme.css` exists, is checked, and has an active support manifest entry.                      | Use a narrow proof-local compatibility bridge for the first proof; do not broaden the package default wholesale.                          |
| `theme/switch-compatibility` | `packages/react/src/components/Switch/switch-compatibility.css` exists and has an active theme manifest entry. | Install alongside `theme-css` for the first proof; remove later when `Switch` CSS no longer needs Wavemap compatibility aliases.          |
| `tokens/geometry`            | `packages/react/src/tokens/geometry.ts` exists and has an active support manifest entry.                       | Future package source should import directly from `../../tokens/geometry`; do not make it a public package export yet.                    |
| `tokens/theme-order`         | `packages/react/src/tokens/theme-order.ts` exists and has an active support manifest entry.                    | Keep the five current theme orders for the first proof; do not add accent ramps to the package default just because the type allows them. |

## Theme Compatibility Gap

`SwitchStyles.module.css` currently reads variables that the narrow package default does not provide:

- Accent ramp variables: `--aui-color-primary-500`, `--aui-color-secondary-500`, `--aui-color-tertiary-500`,
  `--aui-color-quaternary-500`, `--aui-color-quintenary-500`.
- Old neutral naming: `--aui-neutral-8`.
- Wavemap compatibility aliases: `--disabledOpacity`, `--colorTransition`, `--bgColorTransition`,
  `--borderColorTransition`, `--border_radius_1`, `--focus-ring-color`, `--shadow_1`.

The first implementation path uses a narrow proof-local compatibility bridge at
`packages/react/src/components/Switch/switch-compatibility.css`.

That bridge maps only the names needed by the received `Switch` CSS and stays outside the package default. Do not
broaden `@amino-ui/react/theme.css` with Wavemap aliases or accent ramps unless the owner explicitly approves that theme
policy.

## Test Plan Draft

The focused Wavemap test should remain the behavioral source of truth for the first proof, but it needs package-safe
imports before it can run in Amino UI.

Expected test adaptation:

- Import `Switch` from the package-local source or barrel.
- Import CSS module classes from package-local `SwitchStyles.module.css`.
- Preserve the current behavior coverage for render, controlled/uncontrolled state, styling props, geometry, order, icons,
  content slots, native class/style merge, wrapper prop hygiene, and CSS selector regressions.
- Add only a minimal smoke test if the package test harness is not ready yet.

## Source Receipt Checkpoint

- `Switch.tsx`, `helpers.tsx`, and `SwitchStyles.module.css` now live under `packages/react/src/components/Switch`.
- `helpers.tsx` imports geometry and theme-order constants/types from package-local token support modules.
- The public package barrel exports `Switch` and aliases `TSwitchProps` as `SwitchProps` for the bridge phase.
- `react-aria-components` is a peer dependency and dev dependency for local package builds at `^1.17.0`.
- `classnames` is a package runtime dependency at `^2.3.2`.
- The active manifest entry depends on `theme-css`, `theme/switch-compatibility`, `tokens/geometry`, and
  `tokens/theme-order`.

The focused test remains deferred until the component-library testing work area. The optional packet entry continues to
surface it as missing source so strict install readiness is visible.

## Stop Conditions

Return to deliberate planning if the next pass requires:

- New dependency installs or lockfile changes before dependency policy is approved.
- Generated token writers.
- Strict CLI install/update/diff/status/ejection behavior.
- Registry builder rewrites.
- Package publication or release automation.
- Moving Wavemap consumers with the component.
