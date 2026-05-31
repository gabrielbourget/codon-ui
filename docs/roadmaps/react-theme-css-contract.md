# React Theme CSS Contract

## Purpose

`@amino-ui/react/theme.css` is the default CSS contract for React source distributed by Amino UI.

The first contract should give received component source a stable, package-owned theme vocabulary without copying
Wavemap's full application theme or introducing generated token machinery before the first component proof needs it.

## Current Status

- `packages/react/theme.css` is exported as `@amino-ui/react/theme.css`.
- The file is hand-authored and defines the first narrow default `--aui-` variable contract.
- No Wavemap component source consumes this package yet.
- No registry artifact generator reads from `packages/react` yet.
- React and React DOM are the only declared peers for `@amino-ui/react`.

## Contract Principles

1. Keep the default CSS contract hand-authored until generated-token policy is explicitly approved.
2. Use CSS custom properties with the `--aui-` prefix.
3. Prefer semantic component-system roles before product-specific values.
4. Treat Wavemap's registry theme as reference material, not as a source file to copy wholesale.
5. Keep compatibility aliases for Wavemap-only variable names out of the package default until an install proof shows that
   they are needed.
6. Keep app chrome, route layout, map, social-platform, product typography, and gradient values out of the default
   contract.

## First Stable Surface

The first package default should be narrow enough to review directly and broad enough for simple controls to render
without hidden consumer assumptions.

Initial token families:

| Family                    | Purpose                                                                   | First-contract examples                                                                 |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Foreground and background | Plain readable defaults for unopinionated components.                     | `--aui-foreground`, `--aui-background`                                                  |
| Surface and border roles  | Shared neutral appearance for controls, panels, and component containers. | `--aui-surface`, `--aui-surface-raised`, `--aui-border`, `--aui-border-muted`           |
| Neutral ramp              | Light/dark neutral steps that semantic roles can reference.               | `--aui-neutral-100` through `--aui-neutral-800`                                         |
| Focus                     | Accessible focus affordances shared by controls.                          | `--aui-focus-ring`, `--aui-focus-ring-offset`                                           |
| State                     | Cross-component status and validation colors.                             | `--aui-state-danger`, `--aui-state-warning`, `--aui-state-success`                      |
| Control roles             | Defaults for primitive controls and selected states.                      | `--aui-control-background`, `--aui-control-border`, `--aui-control-selected-background` |
| Spacing                   | Package-local rhythm for component internals.                             | `--aui-space-1` through `--aui-space-20`                                                |
| Radius                    | Package-local corner geometry values.                                     | `--aui-radius-1` through `--aui-radius-5`                                               |
| Shadow                    | Reusable elevation values.                                                | `--aui-shadow-1` through `--aui-shadow-5`                                               |
| Motion and opacity        | Shared transitions and disabled/backdrop opacity.                         | `--aui-transition-color`, `--aui-opacity-disabled`                                      |

## Deferred Surface

These are not part of the first default contract:

- CLI palette generation.
- Generated token files.
- Theme seed configuration.
- Consumer-specific theme writers.
- Wavemap compatibility aliases such as `--foreground`, `--distance_1`, `--border_radius_1`, or `--focusOutline`.
- Wavemap app chrome variables such as navbar height or app-level z-index names.
- Product, map, social-platform, or route-specific colors.
- Component-specific escape hatches unless the first received component proves one is needed.

## Load Order

Consumers should be able to import the package default once and override it later:

```ts
import "@amino-ui/react/theme.css"
```

The default file should declare values under `:root` and theme selector blocks. Consumer overrides should load after the
package default and may override the same `--aui-` variables at `:root`, a theme selector, or an app-specific scope.

The first package proof should avoid importing Wavemap's app theme into Amino UI. Wavemap can later add a local bridge
that maps product-specific variables onto the package `--aui-` contract if the delete-and-reinstall proof needs it.

## Wavemap Reference Mapping

Wavemap's current registry theme already points in the intended direction, but it includes compatibility and app-local
surface that should not become Amino UI defaults automatically.

Use these Wavemap reads as guidance:

| Wavemap reference                                                                       | Amino UI posture                                                                                                |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `--aui-foreground`, `--aui-background`                                                  | Bring forward as core semantic roles.                                                                           |
| `--aui-neutral-1` through `--aui-neutral-8`                                             | Rename to numeric CSS steps such as `--aui-neutral-100` through `--aui-neutral-800` if implemented in Amino UI. |
| `--aui-control-*`, `--aui-surface-*`, `--aui-border*`                                   | Bring forward selectively for primitive controls and containers.                                                |
| `--aui-status-*` and validation aliases                                                 | Bring forward as state roles, using `state` naming for the package default if that remains clearer.             |
| Compatibility shims such as `--foreground`, `--distance_1`, and `--border_radius_1`     | Keep out of the package default until a consumer install proof requires them.                                   |
| App chrome z-index aliases, font-face assumptions, gradients, maps, and platform colors | Keep Wavemap-local.                                                                                             |

## Stop Conditions

Return to deliberate planning if implementation of this contract requires:

- New dependencies.
- Lockfile changes.
- Generated token writers.
- CLI theme generation.
- Registry artifact rewrites.
- Package publication decisions.
- Wavemap source movement.
- Broad Wavemap theme rewrites.

## Verification Expectations

For contract-only changes:

- `pnpm check`
- `git diff --check`

For implementation changes to `packages/react/theme.css`:

- `pnpm -F @amino-ui/react check:theme-css`
- `pnpm check`
- `pnpm build:react`
- `git diff --check`
