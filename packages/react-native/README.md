# @codon-ui/react-native

Private native-owned Codon foundation for the Expo SDK 57 / React Native 0.86.3 / React 19.2.3 laboratory. The package exports native Text, Button, the theme provider, hook and public types. The remaining component families are gated by the parity programme.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
```

Metro's react-native export resolves canonical TypeScript source; types and compiled imports use dist. Build before checking consumer types. React and React Native are exact lab peers; Expo is owned by the consumer. The native package has no DOM, React Aria, Expo or CSS runtime imports.

NativeThemeProvider selects explicit light/dark defaults and applies typed partial overrides. Nested providers are independent; omitted mode selects light. useNativeTheme outside a provider returns light defaults. Overrides apply to named roles, not an automatic palette regeneration. System fonts and native line metrics are the defaults, with user text scaling retained by consuming Text views. CSS-variable color strings are not native color inputs even though RN's string color type accepts them.

Tests own public provider behavior. They use the native Jest preset and RNTL 14's async API. Read installed RNTL docs before changing tests; showcase Expo seams have a separate test owner. Passing mocked tests/Metro bundles is not native rendering, accessibility, touch geometry or device acceptance.

`Text` is the native typography component. It uses the provider's 31 variants and six weights, native line metrics and uncapped system scaling. Heading/link intent and explicit native roles are separate from font variants. Ordinary text defaults selectable; label and Button-owned content default unselectable, with an explicit `selectable` override. Native labels/IDs win over `aria-label`/`data-testid` aliases. RN Text refs and native events are retained; DOM class/form/click props are unsupported.

Text resolves provider/inherited foreground, own color, custom native styles and final native styles in that order. Nested Text inherits the resolved foreground unless it supplies its own color/styles. Consumed color fields reject unresolved CSS variables and `currentColor` at runtime while supporting RN platform colors. Build the public package before running its unit tests: those tests exercise the compiled public entry.

The [canonical execution ledger](../../docs/roadmaps/react-native-library-first-pass.md) owns SDK/source revisions, review receipts, evidence limits and subsequent gates. Native registry/CLI lifecycle, package publication and shared runtime token extraction remain later decisions.

`Button` uses a View-backed Pressable ref and native event payloads. It wraps string/number children with Text; nested Text inherits the final root foreground. Render children receive that foreground for icons. Its state exposes pressed, hovered, focused, disabled and pending flags; focus-visible, HTML form, click and press-up APIs are unsupported. Pending announces busy and suppresses activation while retaining focus eligibility. Disabled also disables focus. Blocking an active gesture clears its presentation and balances already-started end/change callbacks.

Button resolves computed base/state styles, custom styles and final styles in order. An explicit hover color wins in the computed hover layer; pressed state wins over hover. Custom colors keep their base pressed appearance. Transparent hover computes a clear background, while explicit final backgrounds still win. This approved native precedence differs from the current web cascade. Default unconstrained targets have a 44-point iOS / 48-dp Android minimum and can grow with text. Explicit dimensions remain authored. Hit testing follows native parent geometry and overflow policy; an unclipped parent can allow activation outside its bounds. Hosts requiring a strict parent boundary must explicitly clip overflow. Measured hit slop does not establish adjacent-target acceptance.
