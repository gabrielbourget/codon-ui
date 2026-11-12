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

## Reusable scenario selection

The existing application is the reusable component harness. Its normal scene buttons stay available, and `codon-showcase://scenario/<scene-id>` selects the same public-component scenes through React Native Linking on initial launch or while the app is running. Stable scene IDs are in `src/harness/scenarioLink.ts`. Optional parameters are `theme=light|dark`, `fixture=live|compact|expanded|vertical-block|horizontal-block`, `controls=shown|hidden` and `reset=0|1`. Unknown scenes, parameters, duplicate parameters and invalid values reject the entire request; a harness error appears without changing the current scene. Unrelated Expo development-client links are ignored.

An omitted option preserves the current harness setting. Reopening the same scene preserves its component state. `reset=1` explicitly remounts the selected scene and restores light theme, live fixture, visible controls, default customization and the shared action counter before applying supplied options. `controls=hidden` removes the harness selector/theme/fixture panel from layout so the actual component is reachable without scrolling through the catalogue; Show harness controls restores it without resetting the component. `showcase-scenario` reports the actual selected scene, theme and fixture. Native tests must also wait for their real component target; this text is not product, input or qualification evidence.

The custom scheme is configured in `app.config.ts` and requires one rebuilt native binary before these links work. After installing that binary on an explicitly selected existing development target, standard platform commands can select a scenario:

```sh
xcrun simctl openurl "$CODON_DEV_SIMULATOR_UDID" 'codon-showcase://scenario/avatar?theme=dark&fixture=compact&controls=hidden&reset=1'
adb -s "$CODON_DEV_ANDROID_SERIAL" shell "am start -W -a android.intent.action.VIEW -d 'codon-showcase://scenario/avatar?theme=dark&fixture=compact&controls=hidden&reset=1' dev.codonui.showcase"
```

Add new application-owned scenarios under `src/scenes`, add their stable ID to `AVAILABLE_SHOWCASE_SCENES`, and register their existing-style selector/render branch in `NativeShowcase.tsx`. Keep scenario modules focused on React components so Fast Refresh can preserve compatible local state. The shared theme, layout fixtures, routing and explicit reset then apply without a component-specific runner. Component actions still run through the original public controls; links do not invoke private handlers or manufacture test outcomes.

## Persistent development session

The approved app already includes `expo-dev-client`, uses Expo's standard Metro configuration and starts with `expo start --dev-client`. Keep one Metro terminal and the chosen development Simulator/emulator running while iterating. The Debug and Release app share `dev.codonui.showcase`; use a development target separate from the guest holding an admitted Release qualification product so installing Debug does not replace that product.

```sh
# Terminal 1: keep Metro running for the session.
pnpm -F @codon-ui/native-showcase start --localhost --port 8081

# Prepared Mac lab: build/install the Debug development client when needed.
# Select an existing development Simulator by its actual UDID.
pnpm -F @codon-ui/native-showcase ios --device "$CODON_DEV_SIMULATOR_UDID" --no-bundler

# Prepared Android lab: select the existing development target explicitly.
pnpm -F @codon-ui/native-showcase android --device "$CODON_DEV_ANDROID_SERIAL" --no-bundler
adb -s "$CODON_DEV_ANDROID_SERIAL" reverse tcp:8081 tcp:8081
```

Connect the development client to the Metro URL shown by Expo CLI using its standard launcher. Once connected, open a scenario link and save JS/TS/component/style changes. Fast Refresh is enabled by default in development and can be toggled in the normal development menu. Compatible function-component edits can retain local state; changing Hook order, module exports or a full reload can remount it. Effects also restart during refresh. The link listener retains its consumed initial URL across compatible effect restarts so a launch link containing `reset=1` is not replayed on each edit; an explicitly received reset link still resets the scene.

If the development client shows stale labels or JS, restart the same ordinary Expo command with `--clear`, wait for Metro to report ready, then connect the client to its displayed localhost URL. Hide harness controls makes the current scene accessible without resetting its owner; Show harness controls restores the selectors.

For optional iOS Simulator interaction, use the published AXe CLI directly (`axe --help`) alongside the ordinary Expo session. Read the current accessibility tree before selecting a visible action; use its documented scroll and coordinate options when needed. AXe is a local development tool, not an app dependency or component harness. Its accessibility output does not establish physical assistive-technology behavior.

JS/TS-only scenario, library-source and style changes normally use the running Metro session. Native library/dependency changes, codegen/spec changes, native sources, Expo plugins and native app configuration (including the new scheme) require rebuilding the development binary. This preserves the existing distinction between JS bundling and native product identity. See [Expo development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/), [custom schemes](https://docs.expo.dev/linking/into-your-app/) and [the pinned React Native Fast Refresh behavior](https://reactnative.dev/docs/0.86/fast-refresh).

Verify the live development path on the selected target before relying on it: open the foundation scene, increment its action count, make and save a temporary visible heading/style edit, confirm it appears while the compatible scene state remains, then revert that edit. The cloud source checks exercise routing and effect-restart behavior; they do not establish that a particular installed development client connects or refreshes successfully.

## Repeatable verification

Use the standard package checks and select relevant Jest files. The harness tests mock only the native Linking boundary; the integration cases mount the actual showcase and public library components. Existing component tests and their acceptance criteria remain in place.

```sh
pnpm -F @codon-ui/native-showcase test --runInBand --runTestsByPath src/harness/__tests__/scenarioLink.test.ts src/harness/__tests__/useShowcaseLink.test.tsx src/scenes/__tests__/ShowcaseHarness.test.tsx
pnpm -F @codon-ui/native-showcase typecheck
pnpm -F @codon-ui/native-showcase lint
pnpm -F @codon-ui/native-showcase format:check
```

Run reproducible native acceptance against the exact frozen Release source/binary and the existing Xcode/Gradle test workflow in the [native lab guide](../docs/src/content/docs/foundation/native-lab.md). Preserve its source/product hashes, original failures, required profiles and genuine input witnesses. A persistent Debug/Fast Refresh session is for development; its warm state and mutable JS do not qualify a clean Release or first-input criterion. This harness adds no process monitor, native runner, publication path or replacement simulator lifecycle.

SafeAreaProvider owns insets and the scrollable scene shell owns available layout. App-window changes update metadata without resetting fixture state. A compact/expanded fixture changes maximum content width within the current window; it cannot enlarge the real device. Blocked rectangles are synthetic gaps between content regions and do not receive hardware posture events or normalize screen coordinates. No RN Web or bare-RN support is promised.

The app owns keyboard avoidance and focused-field reveal. iOS uses KeyboardAvoidingView padding so flex layout follows the current window after rotation; Android retains height behavior. Installed inspection must compare the named scroll viewport and complete content against the physical app window as well as the keyboard. A scroll frame extending beyond the window cannot establish reachability.

Tests compose the public native provider, Text and Button exports with app state and core shell views. They inject only safe-area context metrics and use mocked native dimensions. Native rendering, VoiceOver/TalkBack, keyboard, measured touch regions and real fold/Activity delivery require separate inspected build/device evidence.

See the [ledger](../../planning/component-library/roadmap.md), [native lab guide](../docs/src/content/docs/foundation/native-lab.md) and [curated showcase guide](../docs/src/content/docs/component-library/native-showcase.md) for evidence and next gates.

The constrained fixture intentionally renders a 24 × 24 Button inside a 24 × 24 native parent. The parent uses `collapsable={false}` because React Native can remove layout-only views from the native hierarchy; see the [native View contract](https://reactnative.dev/docs/0.86/view#collapsable). It explicitly sets `overflow: "hidden"` to require clipping, since native hit testing can descend outside an unclipped parent. The clipped fixture remains an intentional target limitation; installed outside/inside touch evidence belongs in the native inspection ledger. Long bilingual labels and selectable/nested Text are available for larger-text and hands-on review. Automated component cases do not close physical screen-reader, pointer/keyboard or owner acceptance gates.

The Multiline/Radio scene exercises the public TextArea, Radio and RadioGroup exports. It includes controlled newline and explicit-submit editors, long bilingual uncontrolled notes in a bounded scrolling editor, controlled/uncontrolled radio choices, disabled/read-only/member guards, selected-member removal/reinsertion, orientation/order/geometry/style controls and explicit reset. It uses the existing app-owned keyboard viewport/reveal path on both platforms so bounded multiline editors remain fully visible after keyboard resize and content reflow. Native submit handling commits the event's final text. Theme/fixture/window changes preserve scene state; closer owner visual review and iPhone signing remain deferred.

The NumberInput scene uses only the public native export for controlled fractional, initially empty page-like, French locale, explicit Arabic numbering and min-anchored/off-grid examples. It displays raw edits and committed values, supports parent rejection, guard/precision/locale/geometry/style changes, and has an explicit commit/dismiss action for keyboards without Return. The Intl locale/numbering-system status and formatted native editors support the installed capability gate; Node results alone do not certify Hermes. Existing theme/layout/reset and focused-field reveal ownership remain unchanged.

The entrypoint explicitly prepares the approved number Intl capabilities before App/the native barrel loads. An adequate existing formatter is preserved; otherwise the app initializes the pinned FormatJS prerequisites and selected en/fr/fr-CA number data synchronously. This application-owned fallback changes Intl and the published Number/BigInt formatting methods only in that branch. The native library does not load it implicitly. The scene reports existing/polyfilled preparation and actual instance capabilities. Runtime evidence and the original unpolyfilled iOS stop remain in the canonical ledger.

The Overlay scene exercises the public Modal, AlertDialog and NativeOverlayProvider exports. It retains a parent-local counter/uncontrolled editor across nested windows and deliberately resets that local state after complete closure, separately from owner-held drafts. Controls cover default/custom content, independent gesture guards, controlled decline, live themes/orders/geometry/styles, six alert tones and default/null/custom icons, hidden cancellation, long French labels/content, keyboard notes, focus-target removal, reset and owner teardown. A contained invalid-branch diagnostic recovers without replacing the provider. The pending-presentation fixture requests closure/replacement from body layout before native readiness; its two-platform installed host gate passes. Final expanded captures, hashes/consumer and normal/large/orientation/keyboard receipts remain owned by the execution ledger; closer owner visual/physical review and iPhone signing remain deferred.
