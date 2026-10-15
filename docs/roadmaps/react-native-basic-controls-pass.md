# Native Basic Controls — Contract And Execution Proposal

Status: **Owner-approved implementation and proof run recorded in ledger Section 8.17; the maintained-scene iOS rapid-entry correction is recorded in ledger Section 8.18**. Prepared 2026-10-14 against Codon `19ae608`. The owner has moved closer visual inspection to application feature integration; that review no longer blocks this contract pass. This proposal follows the [canonical native ledger](react-native-library-first-pass.md) and preserves the current palette and deferred iPhone signing.

## Bounded Run And Commit Cadence

Recommend four native counterparts in this run: Switch, Checkbox, CheckboxGroup and Input. Use the existing React Native 0.86.3/Expo host, hand-authored theme and native verification harnesses. Core Pressable/View/Text primitives support the toggles; core TextInput supports Input. No dependency changes or new behavioral framework are proposed. Keep implementation in `packages/react-native`, generic fixtures in `apps/native-showcase` and maintained explanations in Codon docs.

The owner approved these coherent implementation boundaries:

1. Add the exact existing-color theme roles below, native Switch, public types and focused state/style/color tests.
2. Add native Checkbox and CheckboxGroup, private group context, public types and selection/composition tests.
3. Add native Input, public types/size constants and text-event/focus/validation tests.
4. Add maintained interactive scenes, prove the new immutable archive in an isolated consumer, run affected installed Android/iOS checks and update the ledger/docs.

Select follows as its own collection/overlay contract pass. TextArea, NumberInput, Radio and later families remain in the full catalogue. This run does not select their APIs, move Wavemap source, alter registry/CLI contracts or start product integration, publication or deployment.

## Canonical Source Screening

All five screened component directories match pinned web revision `ddc9f066f67af4742e05e04bd870726141c44129` byte-for-byte. The tree hash below is SHA-256 of sorted repository-relative UTF-8 file paths, a NUL, file bytes and a NUL for every file, including styles, helpers, barrels and the root suite.

| Family        | Files | Tree SHA-256                                                       | Native consequence                                                                                          |
| ------------- | ----- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Switch        | 6     | `5a41c4138314939e6f6cfef17cc2d1b937d985e7d9d62a5b1918a56e361d85ba` | Boolean selection, three styled parts, on/off icon slots and left/right content.                            |
| Checkbox      | 6     | `081bbc1bdc517fde6c3bcc98c63aa5e35e9765d49b6c3adff4776f0e4fa5f97d` | Boolean and mixed state, render children and independently controlled icon visibility.                      |
| CheckboxGroup | 5     | `f08e262a91feeb957a64894c8119f8e4b3fc10d017440583592ab56cbf5585c5` | String-array selection and child context; a layout wrapper alone would lose inherited React Aria behavior.  |
| Input         | 5     | `7ec1ae00ec5fd81e2979c9d6fe96dcddd154eb0ed24b80e9ba4ee7ae89c747f6` | Text sizes, geometry, disabled state, validation border priority and final style merging.                   |
| Select        | 6     | `817a6aba7ba8e2086896f40f92a4a53a1f16c63c19ff8e9969b36150aa81f243` | React Aria collection, ListBoxItem, Popover and selected-value behavior need a coordinated native contract. |

The five targeted Vitest suites passed **68 tests / five files in 5.96 seconds** on 2026-10-14. These DOM/style assertions establish the current web baseline, not native behavior or presentation. Installed React Aria Components 1.17.0 declarations were inspected for inherited selection, render state and input contracts. Representative Codon call sites include boolean filtering, Input text filtering, pagination Select and the table selection checkbox. Table slot-derived indeterminate state must remain a later table adapter decision; the standalone native Checkbox must accept explicit mixed state now.

The current web Switch destructures but does not render `children`; labels use `leftContent`/`rightContent`. Preserve that boundary for the native counterpart rather than promising an unused inherited slot. Input's web `onChange` receives a DOM event; it cannot be copied into native TextInput. Select's wrapper omits legacy selected-key props; current pagination uses `value`/`onChange`. Do not base its eventual native API on obsolete aliases.

## Shared Native Contract

Approved public exports: `Switch`, `Checkbox`, `CheckboxGroup`, `Input`, their `...Props` aliases and named `TNative...` ref/render/style-state types where needed, plus `INPUT_SIZE__SM`, `INPUT_SIZE__MD`, `INPUT_SIZE__LG` and `AVAILABLE_INPUT_SIZES` as an `as const` array. Reuse the existing geometry/order vocabulary. Private selection/style/content helpers and group context stay private; no new subpath exports or shared cross-package runtime are proposed.

Use native props and refs: Pressable's View ref for Switch/Checkbox, View for CheckboxGroup and TextInput for Input. Consume Codon wrapper props before spreading native host props. Support `testID`/`data-testid` and `accessibilityLabel`/`aria-label` with the established native-prop precedence. CSS classes, DOM event/form props, React Aria slot/inputRef/state objects, CSS variable strings and `isFocusVisible` are not native contracts. Preserve native hints, focus/blur, press and text events where the owning core primitive supports them; do not fabricate keyboard, hover or screen-reader proof from tests.

Switch/Checkbox own their role, accessible root and checked/disabled accessibility state; callers cannot contradict these through role/ARIA/native aliases. Read-only controls remain available for accessibility discovery and suppress changes; native AccessibilityState has no read-only field, so hosts provide a localized explanatory hint when needed. Group roots keep descendants individually accessible. [React Native 0.86 accessibility](https://reactnative.dev/docs/0.86/accessibility) documents switch/checkbox roles and mixed checked state; actual VoiceOver/TalkBack review remains deferred.

Retain the established 44-unit iOS/48-unit Android automatic target minima on interactive roots. Explicit root dimensions/minima and parent clipping remain caller constraints. Visual toggle dimensions are separate from the interactive root: Switch defaults to a 15 × 30 track and Checkbox to a 20 × 20 shape. Their dimension props are finite positive numbers; CSS unit strings are excluded. Root customStyles/final style do not silently resize the visual part. [Pressable's parent/sibling hit-boundary rules](https://reactnative.dev/docs/0.86/pressable#how-it-works) still apply; automatic minima do not certify adjacent targets or overflow.

For each styled part use computed defaults → validated customStyles → final root style. Root style callbacks receive the effective native render state and the post-custom `defaultStyle`; an identity callback must preserve custom dimensions, matching the corrected Button contract. Switch additionally retains typed customTrackStyles/customIndicatorStyles. Checkbox customStyles is root-owned; visual shape dimensions/color are explicit props rather than copying arbitrary root styles into its child. Reuse the existing processColor boundary and shadow/filter validation. Primitive/array/Fragment labels and callback results must use owned Text composition without cloning authored native children.

## Exact Theme Additions Without Palette Changes

Add these twelve ColorValue fields to `NativeTheme.colors` and its existing partial override type. Each default is an existing canonical web role; no current literal/action ramp is revised. Adding named override roles is a public theme-contract change included in this approval. Existing provider merge/isolation behavior stays unchanged.

| Approved role                    | Canonical role                                 | Light     | Dark      |
| -------------------------------- | ---------------------------------------------- | --------- | --------- |
| controlPlaceholder               | `--cui-control-placeholder`                    | `#707070` | `#878787` |
| controlHoverBackground           | `--cui-control-hover-background`               | `#efefef` | `#2c2c2c` |
| controlPressedBackground         | `--cui-control-pressed-background`             | `#c6c6c6` | `#3d3d3d` |
| controlSelectedBackground        | `--cui-control-selected-background`            | `#2563eb` | `#2563eb` |
| controlSelectedHoverBackground   | `--cui-control-selected-background-hover`      | `#245bd6` | `#3b73ed` |
| controlSelectedPressedBackground | `--cui-control-selected-background-pressed`    | `#2254c1` | `#5182ef` |
| controlSelectedForeground        | `--cui-control-selected-foreground`            | `#ffffff` | `#ffffff` |
| controlTrackBackground           | `--cui-border-muted`                           | `#c6c6c6` | `#3d3d3d` |
| controlTrackInvertedBackground   | Switch's existing `--cui-neutral-900` fallback | `#2c2c2c` | `#efefef` |
| validationErrorBorder            | `--cui-validation-error-border`                | `#b73434` | `#ff6b5f` |
| validationWarningBorder          | `--cui-validation-warning-border`              | `#a66b00` | `#f0b429` |
| validationSuccessBorder          | `--cui-validation-success-border`              | `#2f7d18` | `#6ad060` |

The selected hover/pressed values use the web control role's 90/10 and 80/20 sRGB mixes with the theme foreground, rounded per channel. These differ intentionally from the existing action role's 85/15 and 75/25 mixes. Test the exact mappings and provider overrides. Existing low-contrast findings stay open for a separate palette decision; declaring a role does not certify contrast.

## Switch

Preserve `isSelected`, `defaultSelected`, `onChange(boolean)`, `isDisabled`, `isReadOnly`, `trackColor`, `indicatorColor`, `invertColorsOnToggle`, `showBorder`, `geometry`, `order`, `raised`, `enableFocusStyle`, `offsetFocusRing`, `iconOn`, `iconOff`, `showOnOffIcons`, `leftContent`, `rightContent` and the three custom-style props. Default selected false, geometry round, raised true, border/icons/inversion false and focus/offset true. Native root event props compose with internal state; selection is requested once on activation, not on press-in, and blocked controls suppress activation callbacks.

Selection is controlled when isSelected is defined; otherwise defaultSelected initializes local state once. Do not change controlled output until the owner changes its prop. Native render/style state contains selected, pressed, hovered, focused, disabled and read-only flags; style callbacks receive defaultStyle. Decorative track/thumb/icons are excluded from accessibility discovery. Use native Views/Text strokes for default check/cross glyphs, with authored icons replacing the corresponding default slot. Omitted icon differs from explicit null, matching the web slot decision.

Core [React Native Switch](https://reactnative.dev/docs/0.86/switch) is an alternative, but it cannot express Codon's three geometries, authored track/thumb styles and icon slots. Recommend a core Pressable with a decorative custom track/thumb to retain those contracts. This is a boolean activation control; OS-native drag/animation behavior is not promised. Thumb placement must follow measured track bounds, including custom-part dimensions, rather than assuming a fixed translation. No animation dependency or new public duration contract is added.

Default track colors use the new control roles; selected order colors use existing actions. Explicit trackColor overrides selected/resting track colors. Inversion changes the selected indicator to indicatorColor or controlSelectedBackground; for the no-order bordered/inverted case, the track uses controlTrackInvertedBackground unless trackColor was supplied. Indicator defaults to controlSelectedForeground. Pressed feedback uses the existing controlPressedBackground, with deterministic pressed precedence; no incidental CSS selector cascade is carried into native code.

## Checkbox And CheckboxGroup

Checkbox preserves isSelected/defaultSelected/onChange(boolean), isDisabled/isReadOnly, isIndeterminate, showIcon, geometry/order/color, raised/focus/offset and native root styling. Default selected/mixed false, showIcon true, geometry rounded, raised false and focus/offset true. Children accept ReactNode or a callback with effective selected/mixed/pressed/hovered/focused/disabled/read-only flags and defaultChildren undefined. isIndeterminate is presentation/accessibility state owned by its prop: it reports checked mixed and shows a line even with showIcon false. Activation requests the inverse of effective isSelected; it does not silently clear an authored mixed prop.

Unselected Checkbox uses controlBackground/controlBorder, or the supplied order border. Selected/mixed backgrounds and icon foregrounds use the control-selected roles or existing action pairs. Explicit color controls shape border/selected background; the foreground still comes from its selected control/order pair. Selected pressed beats hover using selected control/action ramps. Unselected no-order hover/pressed uses the control ramps; unselected ordered feedback uses existing outline hover/pressed backgrounds in both modes. This native exception uses the established semantic role consistently rather than copying the web dark-mode selector cascade. Existing palette literals stay unchanged.

CheckboxGroup preserves controlled value/defaultValue string arrays, onChange(nextValues), isDisabled/isReadOnly, horizontal/vertical orientation, children and root styles. Default is uncontrolled empty selection and vertical, with spacing.unit × 2 gap and wrapping. A private context coordinates Checkbox members with a string value, including members nested in ordinary native wrappers. Group value owns member selection; member isSelected/defaultSelected must not override it. A member's onChange is an observational callback after the group selection request; do not invoke it twice. Disabled/read-only group flags block member changes and cannot be bypassed by a child's false flag. Standalone checkboxes retain their own selection state; nested groups isolate their selection and flags.

Preserve value order, append new selections once, remove the deselected value, retain unrelated values and never mutate caller arrays. Indeterminate remains an explicit child presentation prop. The group does not implement React Aria DOM form submission/validation, table slots or collection discovery by walking/cloning children. Native host labels/hints remain explicit; do not collapse all child controls into one accessible View. Tests must exercise actual members under nested wrappers, rather than certifying selection from a layout-only snapshot.

## Input

Use core [TextInput](https://reactnative.dev/docs/0.86/textinput) with its native value/defaultValue, onChangeText, native onChange event, focus/blur/submit/selection, keyboardType/inputMode, autoComplete/textContentType, secureTextEntry, maxLength and placeholder props. Forward the TextInput ref for focus/blur. Single-line Input fixes multiline false; TextArea remains a separate counterpart. Native onChange is explicitly not a DOM event adapter. Preserve native font scaling and host-managed keyboard/IME behavior.

Preserve textSize small/medium/large mapped to existing b11/b10/b9, geometry default rounded, width/height, focus/offset, isDisabled, errorState/warningState/successState and customStyles. Add isReadOnly as the Codon name for native readOnly. Omit conflicting editable/readOnly/disabled aliases from the public type: disabled or read-only makes editing unavailable; only disabled applies disabled opacity/accessibility state. Runtime event guards must prevent synthetic change callbacks for blocked inputs. Keep selection/focus behavior native and do not advertise read-only as disabled. The host owns validation messages, schema, labels and required-state logic; the three status props set presentation only, with error → warning → success → normal border priority.

Input style callbacks receive isFocused/isDisabled/isReadOnly/isInvalid and defaultStyle; isInvalid follows errorState. No hover/focus-visible flag is promised by this TextInput wrapper. Compute native focus outline using existing focusRing and retain Android underline suppression so it does not introduce a second border. Placeholder color uses controlPlaceholder with a caller placeholderTextColor override; no independently sized/italic CSS placeholder pseudo-element is promised. Rounded/orthogonal/round map to native radius tokens; round uses the existing pill radius rather than CSS percentage radii. Explicit dimensions can constrain large text and remain a documented host responsibility.

## Verification And Remaining Decisions

For each source commit run focused native behavioral tests, public type contracts, format/lint/typecheck and package build. Add negative contract cases for DOM/CSS/conflicting state props. Meaningful runtime cases cover controlled/uncontrolled state, one activation, blocked mutation, callbacks/ref forwarding, group members/array immutability/context isolation, mixed accessibility state, primitive labels, per-part/style-callback precedence, custom dimensions/colors and Input events/validation priority.

The owning showcase adds controlled and uncontrolled toggles, mixed/group selection, disabled/read-only suppression, text entry/submit/focus, theme/order/geometry/custom/reset, long bilingual labels and large-text/keyboard reachability. Keep fixture state parent-owned across theme/layout changes and record platform app recreation separately. Run its focused integration suite, both JS exports and a new frozen isolated archive consumer with one React/provider identity. New component source requires new package/build identities; prior sealed Text/Button captures retain their provenance.

Use the prepared local native lab for affected installed Release checks on Android and iOS, sequentially to fit this Intel host. Prove activation/suppression, mixed/group labels, controlled output, text entry/keyboard reachability, reset and targeted large text. Capture changed representative scenes for later owner review. Do not repeat all prior Text/Button color/geometry captures when their source is untouched. Native inspection or accessibility failures that prevent usable controls must be fixed before advancing; routine cosmetic comparison and physical assistive-technology acceptance are deferred to application integration by the owner.

Select's next proposal must resolve the native collection/value/render-item contract with ListBoxItem, popup versus modal presentation, dismissal/back/focus restoration, virtualization, labels and keyboard navigation before adding an overlay runtime or claiming parity. The four basic controls above neither require nor preselect that architecture. Stop this run for new dependencies, unplanned public APIs/theme shape, registry/CLI, release or ownership changes; otherwise complete all approved commits without pausing after each routine edit.

## Execution Receipt

The approved source passes landed as `6c6efc6`, `a2a0d51` and `8966afd`, followed by the maintained showcase/consumer/native-evidence boundary. [Ledger Section 8.17](react-native-library-first-pass.md#817-approved-basic-controls-consumer-and-installed-checks--2026-10-14) owns the final tests, immutable archive and installed-source identities, runtime fixes, passing paced-entry checks and the unresolved iOS rapid text-entry stream. [Section 8.18](react-native-library-first-pass.md#818-ios-rapid-entry-correction-and-select-proposal--2026-10-14) subsequently records the maintained-scene unpaced Input correction and the prepared Select proposal. Physical acceptance remains deferred. Existing palette values and iPhone signing remain unchanged.
