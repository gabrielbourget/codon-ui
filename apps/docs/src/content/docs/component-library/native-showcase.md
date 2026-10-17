---
title: Native Showcase
description: Generic Expo laboratory, fixture boundaries and next acceptance gates.
---

apps/native-showcase is the Expo consumer for Codon's native library. It imports the canonical package and synthetic display-ready fixtures. Its foundation scene includes themes, customization, a counter, reset, long English/French copy and live app-window/font-scale metadata. App-owned core controls select foundation, Text/Button, basic-control, Multiline/Radio, NumberInput and Select scenes. The maintained Text/Button scene imports public library components and exposes variant/weight/order/geometry, outline, disabled, pending, custom-style and render-child controls. It also includes long bilingual labels, nested/selectable Text and an intentionally constrained 24 × 24 target. The basic-control scene composes Switch, Checkbox, CheckboxGroup and Input with controlled/uncontrolled selection, mixed state, disabled/read-only guards, text entry/submit/ref focus, theme/order/geometry/customization and a long bilingual label. Scene reset is explicit; layout/theme/window changes preserve the active scene state. Its submit handler takes the native event’s final text before dismissing the keyboard. The Select scene adds typed numeric/string keys, unavailable/read-only/disabled choices, controlled and uncontrolled values, empty and 200-item collections, near-end selection, custom rows, item removal/reinsertion and full-screen modal dismissal.

The Multiline/Radio scene composes bounded newline and explicit-submit TextArea editors, long bilingual uncontrolled notes with internal scrolling, controlled/uncontrolled RadioGroups, disabled/read-only/member guards, selected-member removal/reinsertion, orientation/order/geometry/style controls and explicit reset. It uses the existing showcase-owned keyboard viewport and focused-field reveal path.

The NumberInput scene adds controlled fractional and initially empty page-like values, French regional formatting, explicit Arabic numbering and a min-anchored/off-grid example. It exposes raw drafts and committed values, parent rejection, guard/locale/precision/style changes, explicit commit/dismiss and reset. The app explicitly prepares number Intl support before loading the native package, preserving an adequate native formatter and conditionally initializing the approved FormatJS prerequisites/data otherwise. The diagnostic reports actual instance capabilities. iOS keyboard avoidance uses padding to keep the flex viewport inside the current window after rotation; Android retains height behavior. Native inspection compares content against the physical app window and keyboard as well as the named scroll frame.

## Local Use

The Progress/Meter scene presents caller-owned task progress and a negative-to-positive measurement range, with unknown progress, geometry/order/direction, authored labels and independent native style slots. The Indicator/Segment scene adds passive status shapes, active/inactive colors, explicit zero dimensions, canonical segment direction tokens, theme-owned foreground and final style overrides. Both scenes preserve their state through live theme/window/fixture changes and reset explicitly. Their source composition tests do not close measured installed-platform or physical acceptance cells.

The Loading scene composes CircleLoader and LaggingLinesLoader with numeric/time-string duration controls, explicit stopped zero, transparent tracks, numeric/percentage/zero dimensions and native colors. Circle container styles and line visual styles retain separate owners, including the line animationDuration override and root final styles. A loader inside a Button inherits its foreground and stays decorative. Theme/window/fixture changes preserve scene state; reset remounts defaults. Live Reduce Motion and installed frame/geometry/semantic outcomes remain separate native acceptance cases.

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

## Implementation Planning

The repository's planning/component-library/roadmap.md owns the full component catalogue, current work, accepted native contracts and remaining verification gates. Its experiments.md companion retains failures, source/binary identities and bounded diagnostic results. Extend those two planning files for new work; this curated page describes the generic host rather than duplicating per-component progress.

Closer owner visual inspection, physical VoiceOver/TalkBack/touch/keyboard proof, real fold evidence and ARM acceptance remain in the application/device lane. Preserve the current palette and keep iPhone signing deferred.
