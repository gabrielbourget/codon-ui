# Codon Native Showcase

Generic Expo consumer of @codon-ui/react-native. The foundation scene exercises explicit themes, typed overrides, reset, live window metadata and simulated compact/expanded/blocked-region fixtures. Controls in this shell are app-owned core Pressable/Text fixtures; they do not imply that Codon Text/Button exist yet.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/native-showcase start
pnpm -F @codon-ui/native-showcase typecheck
pnpm -F @codon-ui/native-showcase test --runInBand
pnpm -F @codon-ui/native-showcase bundle:ios
pnpm -F @codon-ui/native-showcase bundle:android
pnpm -F @codon-ui/native-showcase check:dependencies
```

The current online dependency diagnostic returns nonzero because it recommends newer Expo/React-type patches and TypeScript 6 than the approved foundation pins. The SDK runtime map, native type checks and both JS exports pass; the ledger records this version-policy exception and an optional Expo/React DOM peer warning. Do not run an automatic upgrade or suppress the check while that disposition is pending.

Use ios/android scripts only in a prepared local native lab. CNG owns generated ios/android directories, which remain ignored; app.config.ts and source own configuration. Native/config-plugin changes require a rebuilt development binary. No EAS project, cloud build, signing/publication or product integration is configured.

SafeAreaProvider owns insets and the scrollable scene shell owns available layout. App-window changes update metadata without resetting fixture state. A compact/expanded fixture changes maximum content width within the current window; it cannot enlarge the real device. Blocked rectangles are synthetic gaps between content regions and do not receive hardware posture events or normalize screen coordinates. No RN Web or bare-RN support is promised.

Tests compose the actual public native theme exports with app state and core native views. They inject only safe-area context metrics and use mocked native dimensions. Native rendering, VoiceOver/TalkBack, keyboard, measured touch regions and real fold/Activity delivery require separate inspected build/device evidence.

See the [ledger](../../docs/roadmaps/react-native-library-first-pass.md) and [curated showcase guide](../docs/src/content/docs/component-library/native-showcase.md) for evidence and next gates.
