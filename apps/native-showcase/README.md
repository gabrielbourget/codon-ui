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

### Finding the selected scene

Scene buttons change content inline below all scene/theme/fixture controls in the same scroll view. They do not navigate to another page or automatically scroll to the component. Their selected state is exposed to accessibility; their color changes while pressed, but there is no persistent visual selected-state highlight. Repeatedly pressing a scene button is not a visibility check.

- Choose the scene once, then scroll down past the controls to the component, or use the existing Hide harness controls button to remove the selector panel without resetting the scene.
- The existing `Scene: <scene>` text above the selectors reports the current scene. For Table it reads `Scene: table`; the actual row checkboxes are below the catalogue controls, not the Table scene selector.
- For a manual Table selection check, use a fresh/known owner state, identify Person1's row checkbox, perform only the admitted action, and read the visible `selected` and `requests` output. A changed checkbox alone does not prove the callback readout.

Prepare the build/install and verify the actual Metro endpoint before a timed manual handoff. Reuse an installed development client while relevant native/configuration inputs match; JS/TS edits use the ordinary Metro/Fast Refresh loop. A native rebuild can consume most of a bounded session, so leave a realistic manual window and communicate its cutoff. Stop the owned Metro handle by the cleanup deadline, preserve an already-booted user device, and record later owner screenshots separately rather than extending a closed attempt. No additional launcher, observer or per-component harness is needed.

### Persistent Android development-client QA

Use the existing consumer app, one explicitly selected emulator and one ordinary Metro process. A native rebuild is needed only when the relevant native/configuration inputs change. Once the Debug APK is built, normal `adb install -r` preserves app data; use Expo CLI's `a` on the connected intended target to open it. Verify the actual `/status` endpoint before interpreting an unreachable launcher as an app failure. The process-local IPv4-first command below also applies to this Mac's Android connection; use port8081 consistently for that loop.

Keep the working emulator and Metro open while moving between related component checks. Existing scene links select the public components; `controls=hidden` hides only the catalogue panel and `reset=1` explicitly starts a fresh owner case. Scene selection can preserve the outer scroll offset, so inspect the current screen before interacting. Read the value/request output after an action, not just the selected decoration. A new scene and a new process are different operations: routine scene selection needs no emulator restart, reinstall or new launcher.

Standard Android SDK controls can perform routine QA directly. Use physical pixel coordinates from a current SDK screenshot, not stale coordinates or the app's logical dimensions. For example, with the already selected serial and actual visible target:

```sh
adb -s "$CODON_DEV_ANDROID_SERIAL" exec-out screencap -p > /tmp/codon-current-screen.png
adb -s "$CODON_DEV_ANDROID_SERIAL" shell input tap "$CODON_TAP_X" "$CODON_TAP_Y"
adb -s "$CODON_DEV_ANDROID_SERIAL" shell input text Codon42
adb -s "$CODON_DEV_ANDROID_SERIAL" shell input keyevent 4
```

A touch command's exit status alone is not a component pass. Capture the actual result and owner callbacks. `input text` supplies this simple ASCII example through Android's input path; it does not establish physical keyboard, arbitrary Unicode/composition or assistive-technology behavior. A software-keyboard Done action and native Back are distinct checks. Existing application controls and links never replace actual product input with a private callback.

On the November14 Intel host, the official isolated Emulator37.2.13 patch booted the existing API36 device in63/75seconds and ran the Debug app. The prior37.2.12 stock watchdog failure and later unexplained host exit remain separate infrastructure evidence. [Google's patch notes](https://developer.android.com/studio/releases/emulator) and [snapshot guidance](https://developer.android.com/studio/run/emulator-snapshots) informed that approved local tool change; it changes no repository dependency or required SDK pin. The trial used normal `-no-snapshot` without wiping data. It does not establish the unique failure cause or guarantee a stock ANR cannot recur.

The owner explicitly requested a persistent self-driven session and lifted the routine30-minute cutoff for this Android setup R&D. Do not close that session between checks or create an automatic cleanup wrapper. Ordinary completion/departure still needs owned-resource cleanup, and unrelated routine limits/approval rules retain their scope. Record unexpected process exits as unknown unless logs establish their cause; do not label them app crashes or claim that our cleanup occurred without command evidence.

Accepted working shared smoke includes real button count0→1, public Input text/keyboard/one submit, basic owner selections, Select phone-window selection/native Back and floating outside dismissal with an actionable parent. The keyboard-open popover editor/body was partly obscured, so full floating-editor reachability remains open. Toaster’s transparent close-slot correction now shows a visible white X over its ribbon and an actual close tap dismisses it; the original white-box defect and separate Confirm receipts remain preserved, without native dark/swipe/update/timeout/focus/AT claims. See [the scoped Android bases and originals](../../planning/component-library/experiments.md#21-delivery-readiness-reset).

The [active board and count definitions](../../planning/component-library/experiments.md#211-current-component-readiness) keep working Android45/iOS50 explicit bases and45 policy-ready rows separate from merged delivery while related QA accumulates. They record scoped NumberInput/Stepper, ToggleButton/Switcher, multiline/radio, TagGroup pointer ownership, Card geometry/draft retention and Modal/Alert/Panel window observations. Card’s expanded title meets the large curve; these endpoints do not establish child clipping, drag/ref identity or exact interpolation. Pagination’s public root-wrap/240-point field composition now fits the phone and has actual Go/page-size owner receipts; its original overflow and optional popup/keyboard/RTL/AT limits stay separate. Carousel has actual Next/longer horizontal-swipe native-owner agreement; the failed short sparse stream is retained and no fast timing or other-scroll recovery is claimed. CircularProgress and Counter separately have actual25→50 owner/paint endpoints, including quarter/half arcs,25/100→50/100 and retained caller child; SVG-A01 remains sealed and no timing/variant/AX/profile result is inferred. Breadcrumbs has an actual default trail/overflow caller-navigation receipt and disabled row guard; the old narrow long-label clipping remains historical, with no universal-fix or OS-handoff claim. FormField has an actual label-to-editor focus, Field42 owner draft and help action; native AX aliases and validation/guard variants are unverified. Link has an actual current-native press/visited-owner/exact-target receipt with URL handoff prevented; no external handler, browser history or native AX relationship result follows. TagGroup’s actual distinct-key selection/veto/removal does not accept keyboard/ref/virtualization/AT profiles or the unresolved standalone Tag Android defect. NumberInput uses the observed handwriting toolbar; locale rendering is passive. Stepper typed-owner/form commit and Switcher interpolation timing remain unobserved. Modal/Alert parent actionability does not prove exact AX-focus arrival, typed note or optional blur. TagComboBox has actual query, focus-stable popup, numeric0 chip/outside dismissal and removal; its static four-row screenshot is not filtering proof and the twelve-entry log is bounded. SortAndFilterPanel has exact Native42 owner/request evidence from one keyboard-visible Apply; configured blur was on, without a blur-fidelity or temporal/veto/profile claim. Both loaders now have actual named/decorative-parent, remount, motion and corrected reduced-motion first-frame evidence. The patch replaces only private visual hosts at the animated/static boundary; final public tags stay unchanged and the motion setting is restored. The original off-reference failure remains historical, with no universal RN-cause, exact timing or AT/profile claim. Tooltip has actual full controlled-description display and described-action dismissal; its right-edge background cut is retained under the non-resizing placement contract, without containment/adaptive-width or hover/AX/AT/profile proof. These limits remain attached to their actual evidence; no additional per-component runner is needed.

Typeahead’s actual component Search submits its delivered Alphas query and native row selection publishes numeric0; the intended IME touch inserted s, so no keyboard-submit or filtering pass is inferred. The h24 TimePicker correction now has scoped AND-TM01 native proof: actual hour07/minute30 publish07:30:00, and Back hides the numeric keyboard while focus stays true. This does not establish blur, seconds/timezone or calendar behavior, AT/profile results, or Temporal-ANR resolution. Compact now has an actual keyboard-visible popup fully above its input and numeric0 selection. Both open:false proposals remain recorded; this does not prove the new clamp branch or focus restoration. The distinct AND-CCP01 cohort now shows ClickPopover’s internal editor/scroll viewport and all footer actions above the full keyboard, actual Popup84 owner draft, and keyboard-visible close. Internal scroll/resize actions, exact clamp causation and focus/ref/profile behavior remain unverified. The same-signer native APK containing the Panel outline-recursion correction and receipt cache is now installed with an exact guest APK hash match. AND-PN01 accepts the actual Panel open/veto/left-right/close endpoints; precise focus restoration remains unverified. Its earlier crash and build-only checkpoint remain preserved. The cache-specific Select regression now passes on that installed APK: actual chooser open, disabled-row guard and Numeric0 selection with one owner change. It adds no readiness count or high-load/Temporal-ANR/Date qualification claim. The tested ToggleScene width100% composition fix has scoped native Switcher endpoint/guard proof, with no library-default change. Keep these candidate identities separate from the original installed cohorts; do not infer a native fix from a source pass.

### Retained Breadcrumbs long-label example

The existing Breadcrumbs scene retains its approved opt-in22-item example. `Toggle long-label diagnostic` selects a long bilingual current label ending `End of label / Fin du libellé: gypq.` at requested300points; the existing width buttons request230or300. `Reset trail` restores the ordinary six-item defaults. Controls remain below the trail; the library implementation and native code are unchanged. Its eight source tests cover composition and state, not native glyph readability.

Gabriel explicitly accepts the scoped iOS delivery basis on2026-11-14 after the later healthy observations. The original230-point clipped image and subsequent healthy images remain separate evidence; no cause or universal fix is established. The temporary callback observation was canceled before runtime and is preserved outside the delivered source. No further diagnostic is queued. See [the acceptance and original evidence](../../planning/component-library/experiments.md#21-delivery-readiness-reset).

### Prepared Mac localhost connection

On the prepared Mac, keep the full Xcode selection and Node's localhost address preference scoped to the ordinary Metro process. This is the verified development-client command for an existing installed Debug client; it does not rebuild or install an app:

```sh
env DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  NODE_OPTIONS=--dns-result-order=ipv4first \
  pnpm -F @codon-ui/native-showcase start --localhost --port 8089
```

Enter `http://127.0.0.1:8089` in the client launcher. If the full Xcode application is elsewhere, use its actual Developer directory. Use one explicit port consistently; the general examples above use8081, while this verified Mac session uses8089. These environment values do not change system Xcode selection or DNS settings. Node documents the [DNS result-order option](https://nodejs.org/api/cli.html#--dns-result-orderorder).

When the client reports an unreachable server, check the actual endpoint before repeating a launch or interaction:

```sh
curl --noproxy '*' --max-time 5 http://127.0.0.1:8089/status
```

The expected body is `packager-status:running`. A displayed Metro URL alone is not a listener check. In the November13 session, localhost resolved to IPv6 only while the CLI advertised IPv4. Using the IPv6 address reached Metro but the pinned client's network-inspector URL construction crashed. The process-local IPv4-first command above yielded a working IPv4 status response, iOS manifest and complete bundle before manual use. Retain those failures separately from component results; changing dependencies, global networking or security settings is not part of this correction.

After connection, use the existing scene controls. For a manual check, keep Simulator foreground through the action, record the visible query/value/open state and public callback readout, and distinguish an open-popup image from a later selected/closed endpoint. An owner-supplied later screenshot keeps its own timestamp and scope. A manual observation does not repair a failed automation method or prove physical assistive-technology behavior.

Stop the owned Metro terminal with Ctrl+C at the end of the bounded session and verify its port is closed. Preserve an already-open user device; shut down a simulator only when the session owns its boot. No custom launcher, process-group wrapper or per-component observer is needed for this workflow.

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
