# Codon Native Showcase

Generic Expo consumer of @codon-ui/react-native. The foundation scene exercises explicit themes, typed overrides, reset, live window metadata and simulated compact/expanded/blocked-region fixtures. Shell selectors remain app-owned core controls. The Text/Button scene renders the public library components with variant/weight/order/geometry, outline, disabled, pending, custom-style and render-child controls. Reset restores foundation defaults; theme, fixture and live-window changes preserve action count.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/native-showcase start
pnpm -F @codon-ui/native-showcase typecheck
pnpm -F @codon-ui/native-showcase test --runInBand
pnpm -F @codon-ui/native-showcase bundle:ios
pnpm -F @codon-ui/native-showcase bundle:android
pnpm -F @codon-ui/native-showcase check:dependencies
```

The current online dependency diagnostic returns nonzero because it recommends newer Expo/React-type patches and TypeScript 6 than the approved foundation pins. This lab retains its approved frozen tuple; types and inspected native JS maps pass, with no React DOM or RN Web modules in either platform map. The recommendation and optional Expo peer warning stay visible. Changing pins requires the next reviewed toolchain pass. See the native lab guide and ledger for that disposition.

Use ios/android scripts only in a prepared local native lab. CNG owns generated ios/android directories, which remain ignored; app.config.ts and source own configuration. Native/config-plugin changes require a rebuilt development binary. No EAS project, cloud build, signing/publication or product integration is configured.

SafeAreaProvider owns insets and the scrollable scene shell owns available layout. App-window changes update metadata without resetting fixture state. A compact/expanded fixture changes maximum content width within the current window; it cannot enlarge the real device. Blocked rectangles are synthetic gaps between content regions and do not receive hardware posture events or normalize screen coordinates. No RN Web or bare-RN support is promised.

The app owns keyboard avoidance and focused-field reveal. iOS uses KeyboardAvoidingView padding so flex layout follows the current window after rotation; Android retains height behavior. Installed inspection must compare the named scroll viewport and complete content against the physical app window as well as the keyboard. A scroll frame extending beyond the window cannot establish reachability.

Tests compose the public native provider, Text and Button exports with app state and core shell views. They inject only safe-area context metrics and use mocked native dimensions. Native rendering, VoiceOver/TalkBack, keyboard, measured touch regions and real fold/Activity delivery require separate inspected build/device evidence.

See the [ledger](../../docs/roadmaps/react-native-library-first-pass.md), [native lab guide](../docs/src/content/docs/foundation/native-lab.md) and [curated showcase guide](../docs/src/content/docs/component-library/native-showcase.md) for evidence and next gates.

The constrained fixture intentionally renders a 24 × 24 Button inside a 24 × 24 native parent. The parent uses `collapsable={false}` because React Native can remove layout-only views from the native hierarchy; see the [native View contract](https://reactnative.dev/docs/0.86/view#collapsable). It explicitly sets `overflow: "hidden"` to require clipping, since native hit testing can descend outside an unclipped parent. The clipped fixture remains an intentional target limitation; installed outside/inside touch evidence belongs in the native inspection ledger. Long bilingual labels and selectable/nested Text are available for larger-text and hands-on review. Automated component cases do not close physical screen-reader, pointer/keyboard or owner acceptance gates.

The Multiline/Radio scene exercises the public TextArea, Radio and RadioGroup exports. It includes controlled newline and explicit-submit editors, long bilingual uncontrolled notes in a bounded scrolling editor, controlled/uncontrolled radio choices, disabled/read-only/member guards, selected-member removal/reinsertion, orientation/order/geometry/style controls and explicit reset. It uses the existing app-owned keyboard viewport/reveal path on both platforms so bounded multiline editors remain fully visible after keyboard resize and content reflow. Native submit handling commits the event's final text. Theme/fixture/window changes preserve scene state; closer owner visual review and iPhone signing remain deferred.

The NumberInput scene uses only the public native export for controlled fractional, initially empty page-like, French locale, explicit Arabic numbering and min-anchored/off-grid examples. It displays raw edits and committed values, supports parent rejection, guard/precision/locale/geometry/style changes, and has an explicit commit/dismiss action for keyboards without Return. The Intl locale/numbering-system status and formatted native editors support the installed capability gate; Node results alone do not certify Hermes. Existing theme/layout/reset and focused-field reveal ownership remain unchanged.

The entrypoint explicitly prepares the approved number Intl capabilities before App/the native barrel loads. An adequate existing formatter is preserved; otherwise the app initializes the pinned FormatJS prerequisites and selected en/fr/fr-CA number data synchronously. This application-owned fallback changes Intl and the published Number/BigInt formatting methods only in that branch. The native library does not load it implicitly. The scene reports existing/polyfilled preparation and actual instance capabilities. Runtime evidence and the original unpolyfilled iOS stop remain in the canonical ledger.
