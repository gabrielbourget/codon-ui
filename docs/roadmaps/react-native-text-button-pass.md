# Native Text/Button — M1-B Contract And Execution Proposal

Status: **Four implementation/source/archive/build passes prepared on 2026-10-13; named final-source runtime checks, independent review and owner/physical acceptance remain open; physical signing/account preparation deferred by the owner**. Prepared 2026-10-13 against Codon `8a9d4db`. This pass follows the [foundation ledger](react-native-library-first-pass.md), including its inspected Android/iOS artifacts. Gabriel's instruction to continue authorizes review, evidence preparation and this concrete proposal; Gabriel subsequently approved the entire recommended packet, including its native exceptions and ten-value theme correction.

## Scope And Commit Cadence

Use four logical implementation commits after approval:

1. Correct the native dark outline hover/pressed calibration and prove all five orders against the canonical sRGB mixing rule. Keep hand-authored values and the approved theme shape.
2. Implement native Text, its public types/exports, runtime color validation and focused tests.
3. Implement native Button, foreground composition, event/state contracts, maintained showcase scenes and focused tests.
4. Build and inspect the component matrix, pack a hashed local archive, prove an isolated consumer, update curated docs and record remaining acceptance evidence.

The source owners are `packages/react-native` and `apps/native-showcase`. Both components use core React Native. No new runtime dependencies, dependency upgrades, Wavemap source transfer, registry/CLI change, release workflow, publication, push, cloud build or product application work is included. Generated platform projects stay CNG-owned. Earlier foundation build proof remains tied to its original binaries; new component builds receive new identities.

## Evidence Ready For This Decision

All 293 iOS and 74 current Android indexed evidence files passed integrity checks on 2026-10-13. The canonical Text/Button source hashes still match the original audit. Existing captures establish the generic foundation's themes, action/reset, synthetic layouts, rotation and scrolling reachability at recorded text scales. They contain app-owned core controls, so they do not prove the proposed Codon Text/Button implementations.

A new iOS XCTest audit passed three visible-screen cases: light, dark and customized dark. Each requested contrast, hit-region, sufficient-description and trait audits; all returned zero issues, with no ignored issues. The first attempt failed before test initialization while waiting for the Simulator AX-loaded notification; a single retry after opening the task Simulator passed. This audit supplements the original installed-release proof and does not establish VoiceOver order, physical touch, offscreen content or unrendered library states. [Apple describes the audit's scope and the need for assistive-app testing](https://developer.apple.com/documentation/accessibility/performing-accessibility-audits-for-your-app).

The owner has an iPhone and can borrow an Android phone at work. No physical iPhone was connected to the Mac during inventory, and the Mac reported zero valid code-signing identities. Physical iPhone installation therefore needs owner device/account preparation. Android hardware review can follow the first maintained Text/Button scenes. Owner visual acceptance and both physical screen-reader/touch gates remain open.

## Native Dark Outline Calibration Correction

The canonical [action-color source](../../packages/react/src/theme/action-colors.css) defines outline hover as 15% order color plus 85% theme background, and outline pressed as 30% order color plus 70% theme background, mixed in sRGB. The current native dark outline literals use brighter ramps and do not match that rule. Browser-rendered token swatches verified the discrepancy for all five orders. The current foundation controls render primary fill, so its prior runtime captures did not exercise these outline roles.

Propose these hand-authored nearest-byte values, using `Math.round` per channel; browser floating-point serialization may differ by one byte at rounding boundaries:

| Order      | Current dark hover / pressed | Proposed dark hover / pressed |
| ---------- | ---------------------------- | ----------------------------- |
| primary    | `#5c8af0` / `#467aee`        | `#192237` / `#1b2e57`         |
| secondary  | `#6e6e6e` / `#5a5a5a`        | `#1d1d1d` / `#222222`         |
| tertiary   | `#8fdc88` / `#80d778`        | `#233322` / `#304f2d`         |
| quaternary | `#f4c75f` / `#f2bf49`        | `#382f1a` / `#58461c`         |
| quintenary | `#ff9087` / `#ff8177`        | `#3a2422` / `#5d302d`         |

Change only these ten default values. Existing light outlines, fill colors, foregrounds, override precedence and theme types remain unchanged. Add formula-derived assertions for both modes and all five orders, rather than another test that repeats the implementation literals. No generated token writer is proposed. This public-default correction is included in the owner’s explicit approval.

## Text Contract

Export named `Text` and `TNativeTextProps` from the native package. Reuse its 31 font variants, six weights, geometry-independent typography and provider. Keep `variant="b10"`, regular weight and `elementType="p"` defaults. `fontStyle` supports the existing italic intent. `elementType="strong"` does not force bold. System fonts remain the default; host-owned font loading is unchanged.

Preserve the existing element-type strings as semantic intent. `h1`–`h6` request heading semantics, without a heading-level guarantee. Explicit native role/accessibility-role props win first, then `composedInLink` requests link semantics, then a heading element requests heading semantics. Other element types remain native Text; `label`, `legend` and link intent do not create associations or navigation.

Recommend ordinary Text selectable by default, labels unselectable, and Button-owned text unselectable by default. Explicit `selectable` always wins. Button context adds this one native selection exception to avoid making its content a separate copy target. Test nested content and explicit overrides; physical selection/activation interaction remains an inspected gate.

Keep native `TextProps`, an RN Text ref and native press/layout event payloads. `accessibilityLabel` and `testID` take precedence over `aria-label` and `data-testid` aliases, including explicitly supplied empty values. Reject DOM-only class/form/event/ref props in public type cases. Do not manufacture browser targets or `htmlFor` associations.

Style precedence is provider typography and foreground → inherited Button foreground → own `color` → `customStyles` → final `style`. Own typography defaults remain variant-driven; explicitly authored native style values can override them. Accept native style objects, arrays, registered styles and empty entries. Preserve scaling without an arbitrary cap, native line metrics and natural wrapping; do not fix Text height or hide truncation by shrinking fonts.

## Runtime Color Boundary

Keep RN `ColorValue`, including platform/dynamic colors supported by the active RN platform. Validate colors consumed by Text/Button and their resolved owned style color fields through RN's color processor. Accept valid named/hex/rgb/rgba and supported native colors; reject unresolved CSS variables, `currentColor` and other invalid values with a descriptive `TypeError` naming the component and field. Validate callback styles when resolved.

The validator is private and shared inside the native package. It does not change provider override merging, scan unused theme branches, translate CSS strings or add a public color API. Color strings remain type-valid under RN's declarations; tests assert runtime rejection and must not pretend TypeScript rejects `var(...)`. Animated color/style support is not newly promised in this first pass.

## Button Contract

Export named `Button`, `TNativeButtonProps` and honest native render-state types. Keep `colorMode="fill"`, `geometry="rounded"`, no default order, raised/focus styling enabled, offset focus enabled, `raisedOnHover=false`, `transparent=false`, and the `button` test-ID fallback. Preserve the five order names and existing geometry/padding roles. Use a View-backed Pressable ref.

The root style is native View style plus a portable foreground `color` member. `customStyles` accepts native style composition; final `style` also accepts a state callback. Root foreground is passed to owned text through a private content context. Explicit nested Text color/custom/final styles win. Strings/numbers get an owned Text wrapper. Render children receive the final foreground for icons or arbitrary native content; do not clone unknown children to inject colors.

Render state exposes `isPressed`, `isHovered`, `isFocused`, `isDisabled`, `isPending` and `foregroundColor`. Style callbacks receive the computed/custom baseline as `defaultStyle` and its foreground; children receive the final resolved foreground. `defaultChildren` is undefined because Button supplies no default child. Do not expose `isFocusVisible` until a real modality contract exists.

Preserve `onPress`, `onPressStart`, `onPressEnd`, `onPressChange`, focus/blur/change and hover/start/end/change names through native adapters. Start/end alias RN press-in/out; activation aliases RN press. Keep RN `onPressIn`, `onPressOut` and `onLongPress` escape hatches with native payloads. Test counts, cancellation, balanced transitions and RN timing behavior; do not impose a browser event order or payload. `onPressUp`, `onClick`, DOM modifiers/propagation, HTML form/slot APIs and unsupported browser focus APIs are rejected/documented exceptions.

`isDisabled` disables activation and focus as supported by the native host. `isPending` suppresses activation, hover and pressed presentation, announces busy and retains focus eligibility. Pending does not become disabled. If blocking begins during an active gesture, clear active presentation and deliver any already-started end/change-false pair while suppressing activation. Apply computed button role and disabled/busy semantics after host props so aliases or a spread cannot contradict them; callers retain other native accessibility states.

Default unconstrained Buttons get a 44-point iOS / 48-dp Android minimum target without a fixed height; larger text can grow the control. Authored dimensions remain meaningful and are inspected separately. Use documented RN hit slop where it can enlarge an explicitly small target within its parent; measure parent clipping and adjacent overlap. A constrained target that cannot meet the minimum remains a visible finding, not an inferred pass from hit slop alone. Explicitly constrained text may require scrolling or wrapping; do not shrink it silently.

## Hover And Style Decision

A source-based browser probe rendered the actual Codon Button and CSS with React Aria Components 1.17.0 in both themes. It verified actual `data-hovered` state after pointer interaction. Only fixture font/timing/layout were controlled; repository component/CSS source was unchanged. This is local source-rendering evidence, not Wavemap deployment or owner visual acceptance.

| Current web case with explicit `hoverColor`      | Observed effective hover background     |
| ------------------------------------------------ | --------------------------------------- |
| unthemed fill or outline                         | requested hover color                   |
| custom fill                                      | inline custom base color wins           |
| custom outline                                   | requested hover color                   |
| primary fill or outline                          | later theme-specific hover rule wins    |
| final explicit background style                  | final background wins                   |
| transparent, including explicit background style | transparent rule with `!important` wins |
| disabled or pending                              | no hovered state                        |

Recommend a deliberate native exception: computed theme/custom base → computed pressed/hover state → `customStyles` → final `style`. An explicit `hoverColor` wins within the computed hover layer for enabled, non-pending, non-transparent Buttons. Pressed state takes precedence over hover; custom colors retain their base pressed appearance unless authored styles override it. Transparent Buttons compute a transparent hover background, while explicit custom/final background styles still win. Preserve the web resting nuance that an explicit custom color can supply a background even with `transparent`; document it in the fixture. Native transparency uses provider foreground rather than browser UA button text color.

This gives final native styles consistent precedence and makes `hoverColor` useful without copying the browser cascade's accidental mode differences. It does not fix or alter web Button. If strict current-web behavior is preferred, take a new contract decision before changing this approved native rule; the observed table is sufficient to specify it.

## Maintained Scenes And Verification

Keep generic foundation controls separate from library demonstration controls. Add Text/Button scenes under the existing provider/safe-area/layout shell, with app-owned scene selection, variant/order/mode choices, disabled/pending/custom-style toggles and action state. Reset restores declared scene defaults; theme, fixture and live-window changes preserve action state. Cover nested Text, render children/styles, long English/French copy, color rejection, explicit constraints and real focus/hover paths when available.

For the theme/Text/Button commits, run focused native format/lint/types, public positive/negative type cases, component/provider composition tests and package build; run showcase checks for its owning edits. Tests must exercise observable outcomes, including invalid colors and blocked/cancelled activation. Use the established installed-app lab for fresh development/local-release identities, normal/larger-text scrolling, portrait/landscape, reset and all component modes/orders. Automated accessibility audits are a supplementary tier; actual keyboard/pointer, VoiceOver/TalkBack and physical touch need named inspected evidence.

The external-consumer pass packs the built package into a local archive, records its SHA-256/source revision, installs it into an isolated temporary Expo consumer with the same approved SDK/React/RN pins, and proves types plus both native Metro exports. Check that the consumer has no workspace/sibling source link and that React/provider identity is singular. This is a local archive exercise; no native registry artifact, CLI installation lifecycle or public package is introduced. Keep pnpm's release-age policy and record a frozen consumer lockfile.

Update curated package/showcase guides after implemented outcomes exist. The roadmap commit retains the existing full root hook; CI/publication do not expand. Record independent source review when authorized, source/build hashes, precise runtime inspection limits and the next family gate. Physical accessibility and owner acceptance remain open until actually completed.

## iPhone Preparation And Owner Review

The Mac's current Xcode 26.5 lane is suitable for preparing a device build; Simulator success does not sign an iPhone app. Before a physical install, the owner must choose an Apple development team/account and complete any Xcode account, phone trust or Developer Mode prompts locally. Do not share account passwords in this chat. No valid signing identity or connected phone was observed during this preparation, and no pairing, account registration, device build, signing or installation was performed.

For personal-device testing, [Apple documents signing in to an Apple Account in Xcode and using a free Personal Team](https://developer.apple.com/help/account/basics/about-your-developer-account); its device provisioning profiles expire after seven days. A paid membership is not required for this personal testing lane. [Apple's device-run guide](https://developer.apple.com/documentation/Xcode/running-your-app-on-simulated-or-physical-devices) covers team selection, automatic signing and device preparation. The owner completes account and [Developer Mode prompts](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device) on their own devices.

Once the owner supplies that readiness and authorizes the exact local signing/device scope, prepare the same app source for the selected iPhone, retain the generated-project boundary and record device model/OS/team/artifact provenance. Paid membership, store/TestFlight distribution and account changes are separate decisions. Preserve the current simulator binaries and receipts.

Hands-on review should cover light/dark labels and selected traits, activation/count/reset, scroll reachability with larger text, portrait/landscape state retention, and VoiceOver reading/activation order. For library scenes add disabled versus pending announcements, no duplicate child actions, long labels and constrained/adjacent target reach. Record actual results and remaining issues before owner acceptance; an available phone alone does not close those gates.
