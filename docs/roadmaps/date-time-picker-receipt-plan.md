# DateTimePicker Receipt Plan

## Purpose

This records the Codon UI-side plan for receiving Wavemap's reusable `DateTimePicker` as a prerequisite for the richer
`add table` graph. The immediate goal is to satisfy Table date/date-time filter argument support without weakening the
public `add table` scope or pulling Wavemap app adapters into Codon UI.

The registry item name should be `date-time-picker`.

## Current Read

`DateTimePicker` is reusable component source, not a Wavemap domain adapter. It composes React Aria date-picker/calendar
primitives, package-local Button, Text typography classes, geometry and placement tokens, English default labels, local SVG
defaults, and two CSS modules.

`DateTimeRangePicker` is a separate component and should not be moved with this pass.

## Candidate Source Files

The first receipt packet should list these Wavemap runtime files:

| Wavemap path                                                                           | Handling                                                                                                                               |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/wavemap-front-end/src/components/DateTimePicker/DateTimePicker.tsx`              | Receive as the component runtime.                                                                                                      |
| `apps/wavemap-front-end/src/components/DateTimePicker/helpers.tsx`                     | Receive as props, constants, calibration, and style merge support. Keep calibration private unless a public API review says otherwise. |
| `apps/wavemap-front-end/src/components/DateTimePicker/labels.ts`                       | Receive default English labels and partial-label type support.                                                                         |
| `apps/wavemap-front-end/src/components/DateTimePicker/DefaultDateTimePickerIcons.tsx`  | Receive tiny component-owned default SVG icons.                                                                                        |
| `apps/wavemap-front-end/src/components/DateTimePicker/DateTimePickerStyles.module.css` | Receive after CSS variable rewrites to the default Codon theme contract.                                                               |
| `apps/wavemap-front-end/src/components/DateTimePicker/CalendarStyles.module.css`       | Receive after CSS variable rewrites and dark-theme selector review.                                                                    |

Focused Wavemap test evidence should remain advisory metadata for the source receipt unless a later testing pass deliberately
copies test files into package-local proof material.

## Public Exports Draft

The likely package-facing surface should export:

| Export area | Candidate exports                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component   | `DateTimePicker`                                                                                                                                                                              |
| Props       | `DateTimePickerProps` aliasing source `TDateTimePickerProps`                                                                                                                                  |
| Labels      | `DateTimePickerLabels`, `PartialDateTimePickerLabels`, `DEFAULT_DATE_TIME_PICKER_LABELS`, and `resolveDateTimePickerLabels` if label customization is treated like other received components. |

Keep `calibrateComponent`, internal class/style merge helpers, local icon prop types, and size/day/hour/granularity constants
private unless the source receipt identifies a clear consumer need.

## Import Rewrite Plan

The source receipt should rewrite Wavemap-local imports to package-local paths:

| Wavemap import shape                          | Package direction                                                                                   |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `@/src/components/Button/Button`              | Use package-local `../Button/Button`; Button is already an active registry dependency.              |
| `@/src/components/_registry/tokens`           | Split into package-local `../../tokens/geometry` and `../../tokens/placement` imports.              |
| `@/src/components/DateTimePicker/*`           | Use relative DateTimePicker-local imports.                                                          |
| `@/src/components/Text/TextStyles.module.css` | Reuse package-local `../Text/TextStyles.module.css`; Text is already an active registry dependency. |

Do not add Wavemap path alias support to Codon UI.

## Dependency Draft

Expected dependency posture:

| Dependency kind       | Draft read                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Registry dependencies | `theme-css`, `theme/action-colors`, `tokens/geometry`, `tokens/placement`, `text`, and `button`.                              |
| Peer dependencies     | React, React DOM, and React Aria Components.                                                                                  |
| Runtime dependencies  | `classnames`; no new runtime package should be added unless source receipt proves it.                                         |
| Deferred dependencies | Wavemap i18n, DateTimeRangePicker, table/filter consumers, route state, app showcase code, and broader date utility adapters. |

`@internationalized/date` is relevant to consumer values and Table filter argument code, but `DateTimePicker` source itself
does not directly import it. Do not add it to `@codon-ui/react` because of this receipt alone.

## Theme And CSS Rewrite Draft

The receipt should rewrite legacy Wavemap CSS aliases directly to the existing Codon default contract where possible:

| Legacy pressure                            | Direction                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `--disabledOpacity`                        | `--aui-opacity-disabled`                                                                                                        |
| `--distance_1`                             | `--aui-space-1`                                                                                                                 |
| `--focus-ring-color`                       | `--aui-focus-ring`                                                                                                              |
| `--colorTransition`                        | `--aui-transition-color`                                                                                                        |
| `--borderColorTransition`                  | `--aui-transition-border-color`                                                                                                 |
| `--bgColorTransition`                      | `--aui-transition-background-color`                                                                                             |
| `--boxShadowTransition`                    | `--aui-transition-box-shadow`                                                                                                   |
| `--border_radius_1`                        | `--aui-radius-1`                                                                                                                |
| `--fadeInAnimation` / `--fadeOutAnimation` | `--aui-animation-fade-in` / `--aui-animation-fade-out`                                                                          |
| `--shadow_1`                               | `--aui-shadow-1`                                                                                                                |
| `--Z_INDEX_MODAL`                          | Existing or narrow package z-index token only if source proof needs it.                                                         |
| `--aui-validation-*` aliases               | Prefer default state/control tokens used by current TimePicker proof unless a deliberate validation-token contract is approved. |

The dark-theme selector `body[data-theme="dark"]` needs explicit review during source receipt. Prefer an existing package
theme attribute contract instead of promoting Wavemap app theme assumptions.

## Exclusions

The receipt must not move nearby app or broader date-picker source by proximity:

| Excluded area                         | Reason                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DateTimePicker/i18n.ts`              | Wavemap i18n adapter using app i18n utilities and packages. Codon core should expose labels. |
| `DateTimeRangePicker/**`              | Separate range component with its own React Aria graph, labels, styles, and tests.           |
| Filtering and Table consumers         | DateTimePicker should be received as a child dependency before Table source movement.        |
| Component showcase and app routes     | Consumer/demo source stays local.                                                            |
| Generated or hosted registry behavior | Not needed for source receipt.                                                               |

## Verification Draft

Before activation, the source receipt should prove:

| Step               | Expected command or evidence                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source proof       | `pnpm -F @codon-ui/react test` after adding `verify-date-time-picker-proof.mjs`.                                                                      |
| Package checks     | `pnpm -F @codon-ui/react format:check`, `pnpm -F @codon-ui/react lint`, `pnpm -F @codon-ui/react stylelint`, and `pnpm -F @codon-ui/react typecheck`. |
| Registry contracts | `pnpm -F @codon-ui/react check:contracts` after manifest/snapshot activation.                                                                         |
| Build              | `pnpm build:react` once package source and public exports are active.                                                                                 |
| CLI registry tests | `pnpm -F @codon-ui/cli test` after local registry snapshots change.                                                                                   |
| Forbidden imports  | Scan received DateTimePicker source for Wavemap aliases, app i18n, route/media/query adapters, and legacy CSS aliases.                                |

Focused Wavemap proof remains:

`pnpm -C apps/wavemap-front-end test --run src/components/DateTimePicker/__tests__/DateTimePicker.test.tsx`

## Stop Conditions

Return to planning before source movement if the next pass requires:

- Moving `DateTimeRangePicker`, Table/filter consumers, or Wavemap app i18n adapters.
- Adding package dependencies not directly proven by DateTimePicker source.
- Adding Wavemap import aliases to Codon UI.
- Promoting Wavemap dark-theme selectors or z-index names as public theme contracts without a narrow token review.
- Changing CLI install/update/diff/eject behavior, package publication, hosted registry behavior, or generated token writers.
