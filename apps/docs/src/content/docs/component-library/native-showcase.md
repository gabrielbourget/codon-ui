---
title: Native Showcase
description: Generic Expo laboratory, fixture boundaries and next acceptance gates.
---

apps/native-showcase is the Expo consumer for Codon's native library. It imports the canonical package and synthetic display-ready fixtures. Its foundation scene includes themes, customization, a counter, reset, long English/French copy and live app-window/font-scale metadata. App-owned core controls select scenes. The maintained Text/Button scene imports public library components and exposes variant/weight/order/geometry, outline, disabled, pending, custom-style and render-child controls. It also includes long bilingual labels, nested/selectable Text and an intentionally constrained 24 × 24 target.

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

Live dimensions come from the current app window. Compact and expanded fixtures constrain content inside that window; expanded does not fabricate a larger physical display. Vertical/horizontal blocked regions place gaps between synthetic content regions. Theme, customization and scene action state survive fixture/window changes; reset returns to light/live/foundation/count zero and restores library defaults when reselected.

Safe-area metrics and scroll layout are app-owned. These fixtures do not sense physical hinges, infer posture from aspect ratio, normalize Android display coordinates or observe Activity recreation. Real foldable delivery belongs to Wavemap's separately approved application adapter/probe. Physical accessibility, touch bounds, keyboard/IME reachability and native rendering still require inspected evidence.

## Suggested Next Steps

1. Review the Text/Button source, maintained scenes, isolated archive consumer and ledger's recovery receipt. The constrained fixture now retains its native parent, and corrected Release installs have verified identities; outside/inside touch, complete matrices, larger-text/footer and iOS audit checks remain open. Save open work and restart this Mac before resuming one virtual device at a time; startup and stock-service failures still block runtime acceptance.
2. Complete owner visual review and physical VoiceOver/TalkBack/touch checks. The owner has an iPhone 16 and can borrow an Android phone; Apple account/signing preparation is deferred until the owner is ready. Agent captures and automated audits do not close this gate.
3. Resolve any acceptance findings before opening the next Input/Switch/Select/Checkbox family contract pass. Review overlays, tables and dates before choosing a broad behavioral foundation; continue audited families until all 53 counterparts satisfy the library gate.
4. Open native registry/CLI lifecycle and maintenance as separate contract passes. Wavemap production app work follows library acceptance; product navigation/auth/maps/server workflows stay consumer-owned.

Use [React Native Package](/packages/react-native/) for provider/runtime ownership. The canonical execution ledger remains docs/roadmaps/react-native-library-first-pass.md; this page describes the implemented foundation and future gates rather than duplicating per-component status.
