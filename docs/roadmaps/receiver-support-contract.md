# Receiver Support Contract

## Purpose

This pass closes the target-repo support decisions that blocked the first `Switch` receipt plan: geometry/theme-order
token ownership and theme compatibility strategy.

It does not move Wavemap component source, activate a `Switch` manifest item, install runtime dependencies, rewrite the
registry builder, or add CLI behavior.

## Graduated Reference

Stable support and theme guidance has moved into the docs site:

- `apps/docs/src/content/docs/component-library/source-graph.md`
- `apps/docs/src/content/docs/registry/contracts.md`
- `apps/docs/src/content/docs/cli/consumer-lifecycle.md`

Keep this roadmap as historical context for the first receiver-support decisions.

## Support Token Path

`@amino-ui/react` now owns the first internal support token modules:

| Source file                                | Owns                                         | First `Switch` need                                                                 |
| ------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `packages/react/src/tokens/geometry.ts`    | Corner geometry codes and `TCornerGeometry`. | `ORTHOGONAL`, `ROUNDED`, `ROUND`, `TCornerGeometry`.                                |
| `packages/react/src/tokens/theme-order.ts` | Theme-order codes and `TThemingOrderCode`.   | Primary, secondary, tertiary, quaternary, and quintenary order constants plus type. |
| `packages/react/src/tokens/index.ts`       | Package-local support barrel.                | Internal convenience only.                                                          |

For the first `Switch` receipt, prefer direct package-local imports from the component source:

```ts
import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"
```

This replaces Wavemap's current `@/src/components/_registry/tokens` app-alias edge with package-local support. The
package-local barrel may stay useful for future internal source, but the first registry file list should not require
barrel installation unless the component proof explicitly chooses that import style.

These support tokens are not package-public exports yet. Do not add `package.json` export entries for them until a public
package API decision is approved.

## Active Support Manifest Entries

`packages/react/src/registry/manifest.ts` now activates only support/theme entries:

| Manifest item                | Source                                                          | Suggested registry target                           |
| ---------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| `theme-css`                  | `packages/react/theme.css`                                      | `src/components/_registry/theme.css`                |
| `theme/switch-compatibility` | `packages/react/src/components/Switch/switch-compatibility.css` | `src/components/_registry/switch-compatibility.css` |
| `tokens/geometry`            | `packages/react/src/tokens/geometry.ts`                         | `src/components/_registry/tokens/geometry.ts`       |
| `tokens/theme-order`         | `packages/react/src/tokens/theme-order.ts`                      | `src/components/_registry/tokens/theme-order.ts`    |

There is still no active `switch` component item. The manifest checker now proves that the first support entries point at
tracked source files and use the current registry item/file roles.

## Theme Compatibility Strategy

Use a narrow proof-local compatibility bridge for the first `Switch` receipt.

Reasoning:

- The current Wavemap `Switch` CSS still reads five accent ramp names, `--aui-neutral-8`, and legacy compatibility aliases
  such as `--disabledOpacity`, `--border_radius_1`, `--focus-ring-color`, and transition aliases.
- `@amino-ui/react/theme.css` intentionally keeps those names out of the package default contract until a component proof
  requires a durable expansion.
- Rewriting all `Switch` CSS variables during receipt would mix extraction mechanics with a visual-token migration.
- A proof-local bridge isolates the first source-install mechanics while keeping the package default narrow.

The bridge should be included only with the first proof slice or Wavemap consumer bridge, not folded into the package
default. It should map only the variables needed by the received `Switch` CSS, and it should remain easy to delete once
the component CSS is rewritten to the durable `--aui-` contract.

The current proof bridge lives at `packages/react/src/components/Switch/switch-compatibility.css` and is exposed as the
`theme/switch-compatibility` registry item. The default consumer layout resolves it under
`src/components/_registry/switch-compatibility.css`.

## Still Blocked Before `Switch`

Before moving or copying `Switch`, the next approved pass still needs:

- Exact proof location for the component source graph.
- Final package-facing export names for `Switch` and `SwitchProps`.
- Test-only package ranges if the focused test moves with the proof.
- Focused test relocation plan.

## Stop Conditions

Return to deliberate planning if a follow-up requires:

- Moving or copying `Switch` before the proof packet is approved.
- Adding dependencies or changing lockfiles.
- Broadening `@amino-ui/react/theme.css` with Wavemap compatibility aliases wholesale.
- Generated token writers or CLI theme generation.
- Registry builder rewrites.
- CLI install, update, diff, status, or ejection behavior.
- Package publication or release automation.

## Verification Expectations

For this support-contract pass:

- `pnpm -F @amino-ui/react check:contracts`
- `pnpm check`
- `pnpm build:react`
- `git diff --check`
