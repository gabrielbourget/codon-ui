---
title: Native Showcase
description: Generic Expo laboratory, fixture boundaries and next acceptance gates.
---

apps/native-showcase is the Expo consumer for Codon's native library. It imports the canonical package and synthetic display-ready fixtures. Its foundation scene includes themes, customization, a counter, reset, long English/French copy and live app-window/font-scale metadata. The app-owned core controls are fixture plumbing; Codon Text/Button enter in the next slice.

## Local Use

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/native-showcase start
pnpm -F @codon-ui/native-showcase test --runInBand
pnpm -F @codon-ui/native-showcase bundle:ios
pnpm -F @codon-ui/native-showcase bundle:android
pnpm -F @codon-ui/native-showcase check:dependencies
```

The current online dependency diagnostic returns nonzero because it recommends newer Expo/React-type patches and TypeScript 6 than the approved foundation pins. This lab retains its approved frozen tuple; types and inspected native JS maps pass, with no React DOM or RN Web modules in either platform map. The recommendation and optional Expo peer warning stay visible. Changing pins requires the next reviewed toolchain pass. See the native lab guide and ledger for that disposition.

The native library has a native Jest preset; showcase integration has jest-expo. Web Vitest remains web-owned. Both native suites use RNTL 14 async rendering/actions and the React-19.2-compatible test-renderer 1.2.0. Metro uses Expo's standard workspace configuration with pnpm isolated installs and the existing seven-day release buffer.

CNG regenerates ignored native directories from app.config.ts and declared dependencies/plugins. Native module/config changes require a fresh development binary. Local ios/android scripts require suitable Xcode/CocoaPods or Android SDK/JDK tooling. Expo Go exploration cannot close the development/release acceptance gates. No paid/cloud build, release service, signing or store pipeline is enabled.

## Adaptive Fixtures

Use [Native Lab](/foundation/native-lab/) for host/tool requirements and actual build/reference capture. Source generation and JS export proof do not establish an installed app.

Live dimensions come from the current app window. Compact and expanded fixtures constrain content inside that window; expanded does not fabricate a larger physical display. Vertical/horizontal blocked regions place gaps between synthetic content regions. Theme, customization and scene action state survive fixture/window changes; reset is explicit.

Safe-area metrics and scroll layout are app-owned. These fixtures do not sense physical hinges, infer posture from aspect ratio, normalize Android display coordinates or observe Activity recreation. Real foldable delivery belongs to Wavemap's separately approved application adapter/probe. Physical accessibility, touch bounds, keyboard/IME reachability and native rendering still require inspected evidence.

## Suggested Next Steps

1. Review the foundation diff and test/bundle/dependency receipts; resolve any exception, then request its narrow commit. Changes remain uncommitted until the owner authorizes that commit.
2. Arrange an iOS/Android development lab and owner-reviewed current mobile-web references. Capture source/build/device/window/font-scale provenance with required states; do not replace unavailable evidence with snapshots.
3. Resolve Text/Button's native event/ref/style contracts, CSS-color validation and actual web hover precedence. Implement them with public type/contract tests, maintained scenes and reset/theme composition proof.
4. Prove a clean consumer outside the monorepo from a hashed immutable artifact, then inspect actual native output and run a small installed-app smoke plus VoiceOver/TalkBack/touch checks.
5. Review the difficult Input/Switch/Select/Checkbox and overlay/table/date cases before choosing a broad behavioral foundation. Continue audited families until all 53 counterparts satisfy the library acceptance gate.
6. Open complete native registry/CLI lifecycle and maintenance as their own contract pass. Wavemap production app work follows full library acceptance; product navigation/auth/maps/server workflows stay consumer-owned.

Use [React Native Package](/packages/react-native/) for provider/runtime ownership. The canonical execution ledger remains docs/roadmaps/react-native-library-first-pass.md; this page describes the implemented foundation and future gates rather than duplicating per-component status.
