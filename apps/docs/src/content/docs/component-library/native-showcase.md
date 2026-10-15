---
title: Native Showcase
description: Generic Expo laboratory, fixture boundaries and next acceptance gates.
---

apps/native-showcase is the Expo consumer for Codon's native library. It imports the canonical package and synthetic display-ready fixtures. Its foundation scene includes themes, customization, a counter, reset, long English/French copy and live app-window/font-scale metadata. App-owned core controls select foundation, Text/Button, basic-control and Select scenes. The maintained Text/Button scene imports public library components and exposes variant/weight/order/geometry, outline, disabled, pending, custom-style and render-child controls. It also includes long bilingual labels, nested/selectable Text and an intentionally constrained 24 × 24 target. The basic-control scene composes Switch, Checkbox, CheckboxGroup and Input with controlled/uncontrolled selection, mixed state, disabled/read-only guards, text entry/submit/ref focus, theme/order/geometry/customization and a long bilingual label. Scene reset is explicit; layout/theme/window changes preserve the active scene state. Its submit handler takes the native event’s final text before dismissing the keyboard. The Select scene adds typed numeric/string keys, unavailable/read-only/disabled choices, controlled and uncontrolled values, empty and 200-item collections, near-end selection, custom rows, item removal/reinsertion and full-screen modal dismissal.

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

Outer safe-area metrics and scroll layout are app-owned; Select owns the separate modal window’s safe-area provider. These fixtures do not sense physical hinges, infer posture from aspect ratio, normalize Android display coordinates or observe Activity recreation. Real foldable delivery belongs to Wavemap's separately approved application adapter/probe. Physical accessibility, touch bounds, keyboard/IME reachability and native rendering still require inspected evidence.

## Suggested Next Steps

1. Switch, Checkbox, CheckboxGroup and Input now have maintained interactive scenes. The showcase uses a resized keyboard viewport on both platforms, reveals focused iOS fields after layout changes and reads final native submitted text. The corrected iOS inspector targets the named app viewport and verifies complete strings without character pacing; the canonical ledger retains final results and earlier diagnostics separately. Closer owner visual inspection and physical typing/IME remain deferred to application feature integration.
2. Select and ListBoxItem implement the approved collection/modal contract and exact safe-area peer. Retain their focused source, consumer and installed verification receipt in the canonical ledger. Screen the next component family and prepare its public API/dependency exceptions before implementation, continuing toward all 53 counterparts. General overlays, tables and dates still receive separate bounded architecture decisions.
3. Retain the refreshed capture packet for later owner review and complete physical VoiceOver/TalkBack/touch checks in the application/device lane. The owner has an iPhone 16 and can borrow an Android phone; iPhone signing remains deferred. Inherited low-contrast palette states remain unchanged for a separate theme decision. Agent captures and primary-only automated audits do not certify those remaining acceptance items.
4. Open native registry/CLI lifecycle and maintenance as separate contract passes. Wavemap production application work follows the component-library delivery sequence; deferred visual/device review accompanies application integration rather than holding up the next component source pass. Product navigation/auth/maps/server workflows stay consumer-owned.

Use [React Native Package](/packages/react-native/) for provider/runtime ownership. The canonical execution ledger remains docs/roadmaps/react-native-library-first-pass.md; this page describes the implemented foundation and future gates rather than duplicating per-component status.
