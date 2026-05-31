# Switch Manifest Plan

## Purpose

This is the first draft of the `Switch` registry manifest plan. It is intentionally docs-only.

Do not activate a `Switch` manifest item until the source files exist in Amino UI and the remaining proof decisions are
approved.

## Current Read

Wavemap's read-only `Switch` graph audit confirmed:

- Runtime files are `Switch.tsx`, `helpers.tsx`, and `SwitchStyles.module.css`.
- The focused test is `Switch.test.tsx`.
- Current app consumers are Settings, boolean filter argument input, and the component showcase; they are consumers, not
  source ownership.
- Runtime source has no Wavemap app-domain imports, route imports, API contracts, shared-utils imports, i18n imports,
  browser storage, or broad support folders.
- The only app-alias runtime edge is `_registry/tokens` for geometry and theme-order support.

## Draft Registry Item

The likely registry item is:

```ts
{
  name: "switch",
  type: REGISTRY_ITEM_TYPE__COMPONENT,
  sourcePackage: REGISTRY_SOURCE_PACKAGE__REACT,
  files: [
    {
      sourcePath: "packages/react/src/components/Switch/Switch.tsx",
      targetPath: "components/Switch/Switch.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "packages/react/src/components/Switch/helpers.tsx",
      targetPath: "components/Switch/helpers.tsx",
      role: REGISTRY_FILE_ROLE__SOURCE,
    },
    {
      sourcePath: "packages/react/src/components/Switch/SwitchStyles.module.css",
      targetPath: "components/Switch/SwitchStyles.module.css",
      role: REGISTRY_FILE_ROLE__STYLE,
    },
  ],
  registryDependencies: [
    "theme-css",
    "tokens/geometry",
    "tokens/theme-order",
  ],
  peerDependencies: {
    react: "^18.2.0 || ^19.0.0",
    "react-dom": "^18.2.0 || ^19.0.0",
    "react-aria-components": "TO_DECIDE",
  },
  runtimeDependencies: {
    classnames: "TO_DECIDE",
  },
}
```

This draft uses the current manifest skeleton shape, but it should not be copied into
`packages/react/src/registry/manifest.ts` yet because the referenced files do not exist and the dependency versions are
not settled.

## Support Items To Decide

The `Switch` proof needs support beyond the three component files:

| Support item         | Current read                                                                                | Decision needed                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-css`          | `@amino-ui/react/theme.css` exists, is checked, and has an active support manifest entry.   | Use a narrow proof-local compatibility bridge for the first proof; do not broaden the package default wholesale.                          |
| `tokens/geometry`    | `packages/react/src/tokens/geometry.ts` exists and has an active support manifest entry.    | Future package source should import directly from `../../tokens/geometry`; do not make it a public package export yet.                    |
| `tokens/theme-order` | `packages/react/src/tokens/theme-order.ts` exists and has an active support manifest entry. | Keep the five current theme orders for the first proof; do not add accent ramps to the package default just because the type allows them. |

## Theme Compatibility Gap

`SwitchStyles.module.css` currently reads variables that the narrow package default does not provide:

- Accent ramp variables: `--aui-color-primary-500`, `--aui-color-secondary-500`, `--aui-color-tertiary-500`,
  `--aui-color-quaternary-500`, `--aui-color-quintenary-500`.
- Old neutral naming: `--aui-neutral-8`.
- Wavemap compatibility aliases: `--disabledOpacity`, `--colorTransition`, `--bgColorTransition`,
  `--borderColorTransition`, `--border_radius_1`, `--focus-ring-color`, `--shadow_1`.

The first implementation pass should use a narrow proof-local compatibility bridge.

That bridge should map only the names needed by the received `Switch` CSS and should stay outside the package default.
Do not broaden `@amino-ui/react/theme.css` with Wavemap aliases or accent ramps unless the owner explicitly approves that
theme policy.

## Test Plan Draft

The focused Wavemap test should remain the behavioral source of truth for the first proof, but it needs package-safe
imports before it can run in Amino UI.

Expected test adaptation:

- Import `Switch` from the package-local source or barrel.
- Import CSS module classes from package-local `SwitchStyles.module.css`.
- Preserve the current behavior coverage for render, controlled/uncontrolled state, styling props, geometry, order, icons,
  content slots, native class/style merge, wrapper prop hygiene, and CSS selector regressions.
- Add only a minimal smoke test if the package test harness is not ready yet.

## Blockers Before Active Manifest

Do not activate the manifest until these are resolved:

- Source location in Amino UI.
- Final component import edits from Wavemap `_registry/tokens` to `../../tokens/geometry` and `../../tokens/theme-order`.
- Exact proof-local compatibility bridge file location and install shape.
- React Aria Components version/range.
- `classnames` direct dependency version or replacement.
- Test harness location and command.
- Whether `SwitchProps` is an alias over `TSwitchProps` or a source rename.

## Stop Conditions

Return to deliberate planning if the next pass requires:

- New dependency installs or lockfile changes before dependency policy is approved.
- Generated token writers.
- CLI install/update/diff/status/ejection behavior.
- Registry builder rewrites.
- Package publication or release automation.
- Moving Wavemap consumers with the component.
