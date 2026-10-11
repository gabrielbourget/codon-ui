# @codon-ui/react-native

Private native-owned Codon foundation for the Expo SDK 57 / React Native 0.86.3 / React 19.2.3 laboratory. The package currently exports the theme provider, hook and public theme types. Text/Button and the remaining 53-component parity programme have not been implemented.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
```

Metro's react-native export resolves canonical TypeScript source; types and compiled imports use dist. Build before checking consumer types. React and React Native are exact lab peers; Expo is owned by the consumer. The native package has no DOM, React Aria, Expo or CSS runtime imports.

NativeThemeProvider selects explicit light/dark defaults and applies typed partial overrides. Nested providers are independent; omitted mode selects light. useNativeTheme outside a provider returns light defaults. Overrides apply to named roles, not an automatic palette regeneration. System fonts and native line metrics are the defaults, with user text scaling retained by consuming Text views. CSS-variable color strings are not native color inputs even though RN's string color type accepts them.

Tests own public provider behavior. They use the native Jest preset and RNTL 14's async API. Read installed RNTL docs before changing tests; showcase Expo seams have a separate test owner. Passing mocked tests/Metro bundles is not native rendering, accessibility, touch geometry or device acceptance.

The [canonical execution ledger](../../docs/roadmaps/react-native-library-first-pass.md) owns SDK/source revisions, review receipts, evidence limits and subsequent gates. Native registry/CLI lifecycle, package publication and shared runtime token extraction remain later decisions.
