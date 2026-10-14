---
title: "@codon-ui/react-native"
description: Private native foundation and explicit platform support limits.
---

@codon-ui/react-native owns canonical native source independently of the web React package. Its public entry exports native Text and Button with their props/ref/render-state types, plus NativeThemeProvider, useNativeTheme and the public theme types. Other component families remain reviewed work.

## Host And Package Ownership

The laboratory pins Expo SDK 57, React Native 0.86.3 and React 19.2.3 for iOS/Android. React and React Native are package peers. Expo, safe-area handling, app configuration and routing/fixtures belong to the showcase or consuming app. Web CSS, React DOM and React Aria are absent from the library runtime graph. Public native registry/CLI distribution and publication remain separate gates.

The root export has a react-native condition for canonical TypeScript source; declarations and compiled imports use dist. Build before consumer typechecks. The Text/Button pass includes a hashed local package archive and isolated Expo consumer; the ledger owns its exact proof receipt. Bare React Native, RN Web, other operating systems and earlier SDK combinations are unverified.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
```

## Theme Contract

```tsx
import { NativeThemeProvider, type NativeThemeOverrides } from "@codon-ui/react-native"

const overrides: NativeThemeOverrides = {
  colors: { foreground: "#123456" },
  actions: { primary: { background: "#2563eb" } },
  typography: { fontSizes: { b10: 18 } },
}

const Example = () => (
  <NativeThemeProvider mode="dark" overrides={overrides}>
    {/* Native app content */}
  </NativeThemeProvider>
)
```

Mode is explicit light/dark and defaults to light. The app may map OS or account preferences to it. Overrides merge defined named branch/entry values with that mode's defaults; explicitly undefined entries preserve defaults. They do not derive a new action palette from a changed root color. Nested providers resolve independent defaults and overrides. useNativeTheme outside a provider returns light defaults. Removing overrides restores defaults without mutating the caller.

The small theme owns colors, five action orders, spacing unit, radius, disabled opacity, native font-family overrides, 31 font sizes and six weights. Typography uses the inspected mobile-web ten-unit rem calibration (b10 is 14 logical units), system fonts and native default line metrics. Font assets/loading stay host-owned. Native ColorValue includes arbitrary strings; CSS variables and CSS color-mix expressions remain unsupported native inputs. Text/Button validate consumed colors and resolved native style fields at runtime, rejecting CSS variables and currentColor with a descriptive TypeError. RN platform colors are retained.

## Text And Button

Text uses 31 variants, six weights, system fonts and uncapped native scaling. Explicit native role/accessibility-role wins, followed by link intent and heading intent. Element names express semantics, without DOM associations or heading-level guarantees. Ordinary Text defaults selectable; labels and Button-owned content default unselectable. Explicit selection wins. Native labels/IDs take precedence over the supported aliases.

Button exposes native Pressable events and a View ref. Its render state contains pressed, hovered, focused, disabled, pending and final foreground; focus-visible is intentionally absent. Strings/numbers receive an owned Text wrapper, nested Text inherits foreground and render children can use it for icons. Pending suppresses activation/presentation, announces busy and retains focus eligibility. Disabled also disables focus. Mid-gesture blocking balances started end/change transitions.

Computed theme/state styles precede custom and final native styles. Explicit hoverColor wins in the computed layer, pressed state wins over hover and final authored styles always win. This approved native rule differs from the web cascade. Default unconstrained Buttons have 44-point iOS / 48-dp Android minima and grow with text; authored dimensions remain meaningful. Hit testing follows native parent geometry and overflow policy, and an unclipped parent can allow activation outside its bounds. Hosts requiring a strict parent boundary must explicitly clip overflow. Automatic hit slop does not prove an adjacent or constrained target passes.

DOM classes, click/press-up events, HTML forms, CSS dimensions and browser refs are rejected by public type cases. Native styles and callbacks retain native payloads; arbitrary children are not cloned to inject styles.

## Evidence Limits

Public provider/type tests and platform JS bundle checks exercise the source and host graph. Mocked view assertions do not establish measured layout, screen-reader behavior, shadows, native press regions or rendered parity. Post-restart inspection reached development, color/state/layout, larger-text/footer and rotation results on both platforms. The owner-approved follow-up explicitly clips the intentional 24-point fixture and renames its control to “Toggle constrained target.” Fresh hash-verified Release builds passed outside/inside touch checks on both emulators; strict iOS light-fill and dark-outline audits reported zero issues with none ignored. Those audits cover two visible states, without the intentionally constrained target enabled. The ledger preserves the earlier failed baseline and the new artifacts separately. Physical VoiceOver/TalkBack, touch and owner visual acceptance remain open; no support claim substitutes for those results.

The repository's docs/roadmaps/react-native-library-first-pass.md owns exact baseline hashes, per-component compatibility, current proof receipts, independent review and owner checkpoints. Use [Native Showcase](/component-library/native-showcase/) for the generic host and staged next steps.

The owner-approved follow-up fixes the three independent-review findings. Button groups adjacent primitive children through arrays/fragments into owned Text phrases, including callback results; its callback baseline respects custom dimensions; string/structured box-shadow and drop-shadow colors receive contextual validation through RN processColor. Authored child elements, style precedence, explicit minima and supported native input forms retain their contracts. Fresh verification passed 66 native cases, public contracts, five showcase cases and a new isolated archive consumer; follow-up independent source review found the original P2 issues resolved. The ledger owns refreshed installed proof. Low resting contrast in several inherited palette states remains an explicit owner/theme gate; theme values are unchanged, and passing primary-state audits do not certify the other orders.
