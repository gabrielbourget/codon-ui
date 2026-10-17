---
title: "@codon-ui/react-native"
description: Private native foundation and explicit platform support limits.
---

@codon-ui/react-native owns canonical native source independently of the web React package. Its public entry exports native Text, PlaceholderText, Button, Switch, Checkbox, CheckboxGroup, Input, TextArea, Radio, RadioGroup, NumberInput, Select, ListBoxItem, ComboBox, Modal, AlertDialog, LinearProgress and Meter with their public props/ref/state types, plus NativeThemeProvider, NativeOverlayProvider, useNativeTheme and the public theme types. Source availability and installed-platform acceptance are recorded separately in the component-library roadmap.

## Host And Package Ownership

The laboratory pins Expo SDK 57, React Native 0.86.3 and React 19.2.3 for iOS/Android. React, React Native and react-native-safe-area-context 5.7.0 are exact package peers. Expo, outer safe-area layout, app configuration and routing/fixtures belong to the showcase or consuming app; Select, Modal and AlertDialog own safe-area handling inside their separate native windows. Web CSS, React DOM and React Aria are absent from the library runtime graph. Public native registry/CLI distribution and publication remain separate gates.

The root export has a react-native condition for canonical TypeScript source; declarations and compiled imports use dist. Build before consumer typechecks. The Text/Button pass includes a hashed local package archive and isolated Expo consumer; the ledger owns its exact proof receipt. Bare React Native, RN Web, other operating systems and earlier SDK combinations are unverified.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
```

## Theme Contract

```tsx
import { NativeThemeProvider, type NativeThemeOverrides } from "@codon-ui/react-native"

const overrides: NativeThemeOverrides = {
  colors: { foreground: "#123456" },
  actions: { primary: { background: "#2563eb" } },
  typography: { fontSizes: { b10: 18 } },
}

const Example = () => (
  <NativeThemeProvider mode="dark" overrides={overrides}>
    {/* Native app content */}
  </NativeThemeProvider>
)
```

Mode is explicit light/dark and defaults to light. The app may map OS or account preferences to it. Overrides merge defined named branch/entry values with that mode's defaults; explicitly undefined entries preserve defaults. They do not derive a new action palette from a changed root color. Nested providers resolve independent defaults and overrides. useNativeTheme outside a provider returns light defaults. Removing overrides restores defaults without mutating the caller.

The small theme owns colors, five action orders, spacing unit, radius, disabled opacity, native font-family overrides, 31 font sizes and six weights. Typography uses the inspected mobile-web ten-unit rem calibration (b10 is 14 logical units), system fonts and native default line metrics. Font assets/loading stay host-owned. Native ColorValue includes arbitrary strings; CSS variables and CSS color-mix expressions remain unsupported native inputs. Text/Button validate consumed colors and resolved native style fields at runtime, rejecting CSS variables and currentColor with a descriptive TypeError. RN platform colors are retained.

## Text And Button

Text uses 31 variants, six weights, system fonts and uncapped native scaling. Explicit native role/accessibility-role wins, followed by link intent and heading intent. Element names express semantics, without DOM associations or heading-level guarantees. Ordinary Text defaults selectable; labels and Button-owned content default unselectable. Explicit selection wins. Native labels/IDs take precedence over the supported aliases.

Button exposes native Pressable events and a View ref. Its render state contains pressed, hovered, focused, disabled, pending and final foreground; focus-visible is intentionally absent. Strings/numbers receive an owned Text wrapper, nested Text inherits foreground and render children can use it for icons. Pending suppresses activation/presentation, announces busy and retains focus eligibility. Disabled also disables focus. Mid-gesture blocking balances started end/change transitions.

Computed theme/state styles precede custom and final native styles. Explicit hoverColor wins in the computed layer, pressed state wins over hover and final authored styles always win. This approved native rule differs from the web cascade. Default unconstrained Buttons have 44-point iOS / 48-dp Android minima and grow with text; authored dimensions remain meaningful. Hit testing follows native parent geometry and overflow policy, and an unclipped parent can allow activation outside its bounds. Hosts requiring a strict parent boundary must explicitly clip overflow. Automatic hit slop does not prove an adjacent or constrained target passes.

DOM classes, click/press-up events, HTML forms, CSS dimensions and browser refs are rejected by public type cases. Native styles and callbacks retain native payloads; arbitrary children are not cloned to inject styles.

## Basic Controls

Switch and Checkbox retain controlled/uncontrolled boolean selection, disabled/read-only guards, native refs/events, geometry/order and validated native styling. Their small visual track/shape is separate from the 44-point iOS / 48-dp Android root target. Switch retains left/right labels, icon slots and track/thumb styles; native OS drag/animation is not promised. Checkbox mixed state remains caller-owned, announces checked mixed and retains its line with showIcon false. CheckboxGroup coordinates string-valued members through private context without walking/cloning children; group state/guards own members, nested groups isolate state and descendants remain separate accessibility targets. Native read-only state has no AccessibilityState field; supply localized hints when needed.

Input is a single-line core TextInput wrapper with native refs, text/submit/focus/selection events, keyboard options and text scaling. Use isDisabled/isReadOnly; editable/readOnly aliases, DOM events and multiline are excluded. Small/medium/large map to b11/b10/b9. Error → warning → success is border presentation, with validation messages/schema owned by the host. Style callbacks receive focused/disabled/read-only/invalid state and the post-custom defaultStyle. Placeholder color and three validation borders use named theme roles; all twelve added roles copy existing web colors, preserving existing native defaults/action ramps. When submitting, a host can take the final value from event.nativeEvent.text before dismissing the keyboard rather than assuming its last rendered value has caught up.

## TextArea And Radio Groups

TextArea owns core multiline editing with a real TextInput ref and requires a nonempty accessibilityLabel/aria-label. Its default 96-unit height is caller-overridable; native content scrolls without automatic growth. numberOfLines is a platform hint and Android text aligns at the top. Return defaults to newline; explicit submitBehavior is supported. Deprecated blurOnSubmit, single-line clearButtonMode/secureTextEntry and CSS resize are excluded. Native change/selection/content-size/submit events retain their payloads. Disabled/read-only block mutation, while only disabled changes opacity and focus eligibility. Size, geometry, validation priority, color validation and post-custom style callbacks follow Input without changing Input or the palette.

Radio requires a nearest RadioGroup, a string value and an explicit nonempty accessible name. RadioGroup also requires a name and owns controlled value or initial defaultValue plus onChange(string). undefined is uncontrolled; null clears controlled selection, and the empty string is a valid member value. Controlled members wait for parent echo. Reselection and removal do not emit changes; reinsertion restores the retained value. Hosts supply unique stable member values. Private context reaches ordinary wrappers and isolates nested groups without child discovery or cloning.

Group disabled/read-only guards own descendants; a member can add isDisabled. Read-only permits focus/inspection without mutation or disabled opacity. Disabled opacity applies once per member. Each member owns radio/checked/disabled traits; the nonaccessible radiogroup wrapper keeps members separate. Hosts supply localized read-only/validation explanations and verify physical announcements later. Radio's 20-unit native mark uses existing geometry/order/color/focus roles, with stable selected fill during hover/press. Root width/height/customStyles/final style constrain the target; customShapeStyles owns the mark. Primitive/array/Fragment labels use owned Text with uncapped scaling. Targets retain the existing 44-point/48-dp minima and explicit/clipped-parent exceptions. Group flow defaults vertical with two spacing units; horizontal flow wraps. DOM forms, web keyboard coordination and independent member selection props are excluded.

## NumberInput

NumberInput composes the existing Input and two Buttons into independently named editor/decrement/increment targets. Supply accessibilityLabel (or aria-label), incrementLabel and decrementLabel. Its ref is the core TextInput. value/defaultValue are number or null; undefined selects uncontrolled initialization. Raw text remains a draft until a final native edit/submit or step commits one numeric change. Empty text commits null; invalid or incomplete text restores the stored value. Controlled values wait for parent echo, and configuration/guard changes cancel an outstanding edit.

The private decimal model limits precision to six fractional digits and representable safe integer units. Bounds, optional min-anchored step, nearest rounding and single-press stepping have explicit semantics; hold-repeat, exponent/hex syntax, currency/percent/unit formatting and general web NumberField behavior are excluded. The exact @internationalized/number 3.6.6 utility owns locale symbols and parsing. Hosts own localized names, read-only explanations and validation messages. Per-part native styling, guard behavior and target minima follow the existing controls without adding palette roles.

Consumers must prepare required Intl.NumberFormat operations, selected locales and numbering systems before importing the native barrel. Missing formatToParts raises a contextual TypeError. The showcase explicitly prepares English/French regional data with its approved exact FormatJS dependencies when native support is inadequate; an adequate formatter is preserved. That app bootstrap also accepts the published Number/BigInt toLocaleString effects. The library does not install a global polyfill. Consumer applications choose and verify their own runtime setup and locale data.

## Select And ListBoxItem

Select accepts readonly items with stable typed getKey and nonempty getTextValue metadata; numeric 0 and string "0" remain different keys. It supports controlled value or initial defaultValue, controlled isOpen or initial defaultOpen, disabledKeys, disabled/read-only guards and decorative renderItem content. Missing selected keys retain their value and display the placeholder until reinserted. Choosing the current key closes quietly; cancellation leaves selection unchanged. Required accessibilityLabel (or aria-label) and localized closeLabel name the trigger and dismissal action.

The native presentation is an opaque full-screen core Modal with its own safe-area provider, heading, Close action and dynamic-height FlatList. Android Back requests closure. Initial selected-row positioning uses bounded measurement-driven attempts; pending focus/scroll work stops after closure or unmount. Public ListBoxItem is a controlled radio row with explicit id/textValue and one owned interactive root. Custom row content must remain decorative. Native minimum targets are 44 points on iOS and 48 dp on Android unless explicitly constrained by the host.

Consumers must install react-native-safe-area-context exactly 5.7.0 alongside the existing React/RN peers and rebuild their native binary. No new palette roles are introduced. Root, trigger, selected text and options list have separate native style owners. DOM/forms, anchored placement, arbitrary child registration, multi-selection, search and hardware typeahead are outside this contract. Physical screen-reader focus and keyboard acceptance remain in the application/device lane.

## Progress And Measurement

LinearProgress represents a task's progress; Meter represents a measurement within a range. Both require a caller-owned numeric value and a nonempty accessibilityLabel (or aria-label). minValue/maxValue default to 0/100, must be finite and strictly increasing, and clamp the displayed value to their range. Zero and negative values remain meaningful. These are display components with no default value or change callback; the forwarded ref is the actual root native View.

```tsx
import { LinearProgress, Meter } from "@codon-ui/react-native"

export const Capacity = ({ completed }: { completed: number }) => (
  <>
    <LinearProgress accessibilityLabel="Tasks completed" value={completed} maxValue={20} width="100%" order="primary" />
    <Meter
      accessibilityLabel="Storage used"
      value={12}
      maxValue={64}
      valueLabel="12 of 64 gigabytes"
      barGeometry="rounded"
      trackGeometry="rounded"
    />
  </>
)
```

LinearProgress alone accepts isIndeterminate. Unknown progress presents a decorative native activity indicator and omits the numeric accessibility value, without creating a second accessible target. Meter always presents a measurement. Root roles and range/value semantics are owned by the components; Meter uses the native meter role on iOS and progressbar compatibility on Android, whose pinned RN delegate has no meter-role mapping. Physical platform announcements still require device acceptance.

Value text defaults to a formatted percentage. An explicit formatOptions object follows Intl.NumberFormat; percent formatting uses the range fraction, while other formats use the clamped number. Supply locale for an explicit locale or valueLabel for a localized string, including an intentionally empty string. An authored valueLabel bypasses Intl formatting. Hosts retain responsibility for adequate Intl support and their existing bootstrap; these components install no polyfills.

Default dimensions are 150 × 10 logical units horizontally or 10 × 150 vertically. Native height/width, including percentages and zero, override them. Horizontal direction defaults right; vertical defaults up. left reverses horizontal fill, and down reverses vertical fill; directions from the other axis have no effect. The accessible root is not rotated. Determinate updates use 250 ms visual transitions while accessibility and style callback values reflect current props immediately. Reduce Motion disables transitions and stops the unknown-progress spinner; pending preference queries or query failures retain static presentation. Replaced transitions and unmounted listeners are cleaned up.

barColor/trackColor accept native ColorValue values. The semantic selected color is the default fill; order chooses an existing action background, and an explicit barColor wins. Independent barGeometry/trackGeometry accept orthogonal, rounded and round; raised applies the existing native track elevation. No palette values or theme roles are added.

customStyles, customTrackStyles and customBarStyles own the root, track and fill separately. Root precedence is computed → customStyles → final style. A style callback receives percentage, valueText and the post-custom defaultStyle; LinearProgress additionally supplies isIndeterminate. Track/bar overrides remain independent, including authored dimensions. Native IDs/layout events forward to the root. DOM classes, browser refs, React Aria slot context and ReactNode value labels have native style/ref/name/string equivalents; the wrappers own their track/bar children.

The maintained Progress/Meter scene exercises controlled zero, negative measurement, unknown progress, orientation/direction, geometry/order, style overrides and value labels under the showcase's theme and layout controls. Component/consumer tests and compiled declarations verify the source contract; measured Android/iOS rendering, motion and physical accessibility remain pending. The unrelated RN-TEXT-01 and original ComboBox installed acceptance stay open.

## Evidence Limits

Public provider/type tests and platform JS bundle checks exercise the source and host graph. Mocked view assertions do not establish measured layout, screen-reader behavior, shadows, native press regions or rendered parity. Post-restart inspection reached development, color/state/layout, larger-text/footer and rotation results on both platforms. The owner-approved follow-up explicitly clips the intentional 24-point fixture and renames its control to “Toggle constrained target.” Fresh hash-verified Release builds passed outside/inside touch checks on both emulators; strict iOS light-fill and dark-outline audits reported zero issues with none ignored. Those audits cover two visible states, without the intentionally constrained target enabled. The ledger preserves the earlier failed baseline and the new artifacts separately. Physical VoiceOver/TalkBack, touch and owner visual acceptance remain open; no support claim substitutes for those results.

The repository's planning/component-library/roadmap.md owns exact baseline hashes, per-component compatibility, current proof receipts, independent review and owner checkpoints. Use [Native Showcase](/component-library/native-showcase/) for the generic host and staged next steps.

The owner-approved follow-up fixes the three independent-review findings. Button groups adjacent primitive children through arrays/fragments into owned Text phrases, including callback results; its callback baseline respects custom dimensions; string/structured box-shadow and drop-shadow colors receive contextual validation through RN processColor. Authored child elements, style precedence, explicit minima and supported native input forms retain their contracts. Fresh verification passed 66 native cases, public contracts, five showcase cases and a new isolated archive consumer; follow-up independent source review found the original P2 issues resolved. The ledger owns refreshed installed proof. Low resting contrast in several inherited palette states remains an explicit owner/theme gate; theme values are unchanged, and passing primary-state audits do not certify the other orders.

On 2026-10-14 the owner directed continuing the component roadmap and moved closer visual inspection to application feature integration. Text/Button source/consumer/installed proof is complete for its recorded scope; visual and physical acceptance remain deferred. The owner approved the Switch, Checkbox, CheckboxGroup and Input proposal, and those core React Native counterparts are implemented. Select and ListBoxItem now implement the approved explicit collection and full-screen modal contract. The canonical ledger owns the exact API/theme proposal and logical commit boundaries. Palette values and iPhone signing remain unchanged.

The maintained-scene iOS rapid-entry finding is resolved for the recorded installed artifacts through showcase-owned keyboard viewport correction. Corrected XCTest inspection targets the app's named scroll wrapper and sends complete strings without character pacing; the ledger records the full controls flow, native input guards, combined text/Return and three fresh-launch strings. Earlier failed/paced/zero-test inspector attempts retain their diagnostic status. That keyboard correction left native package source and its then-current immutable consumer archive unchanged. Physical typing, IME and screen-reader checks remain in the deferred application/device lane. Select uses the approved explicit collection/modal contract and exact safe-area peer. Its installed verification receipt is recorded separately in the canonical ledger.

## Modal, AlertDialog And Window Ownership

Place one children-only NativeOverlayProvider at the application root when using Modal or AlertDialog. It retains React locations/context while coordinating a single nested window chain; nested providers and simultaneously requested sibling/unrelated branches are rejected. Child windows wait for native parent readiness. Only the active leaf dismisses or runs alert actions. Close the old root before replacement; admitted presentations that close before onShow drain readiness while inactive, then retire before the next root. iOS uses onDismiss and Android a committed hidden-frame barrier, without a portal, global singleton, BackHandler or public registration API. Select optionally joins this scope as an unchanged full-screen leaf and still works standalone.

Modal accepts controlled isOpen/onOpenChange or initial defaultOpen, with ownership fixed for the instance. Supply a nonempty accessibilityLabel/aria-label. Backdrop isDismissable and system/escape isKeyboardDismissDisabled are independent; explicit actions still work with both blocked. A controlled parent may decline requests. Custom children replace the named starter title/body/Close composition; primitive phrases use native Text and authored elements are preserved. A complex starter close label needs closeLabel. View refs, static native dimensions, five orders, rounded/orthogonal geometry and computed → customStyles → style precedence are retained; backdrop/dialog styles are separate owners. Default sizing is bounded to the padded safe window, with internal scrolling; isScrollable=false delegates a bounded custom scroller to the caller.

Covered content keeps its instance, local state and native controls. Ordinary closed content unmounts; keep longer-lived drafts outside it. Ancestor closure retires descendants deepest first without invoking business actions. Controlled descendant open values remain caller-owned and may resume after an ancestor returns. Native initial/restore focus refs belong to the expected active owner; pending work cancels with closure, replacement or unmount, and removed targets stay quiet. Accessibility-focus restoration does not deliberately reopen a TextInput keyboard. Each window owns native safe areas and measured keyboard reachability; physical screen-reader/touch/IME behavior still needs device review.

AlertDialog shares that frame with six exported canonical types, required string title/body and optional custom content. Its decorative core-native marks replace SVG. Undefined/null AlertIcon retain the default; custom nodes remain decorative. Ribbon, circle, important heading/body and wrapping nonshrinking actions stay within bounded scrolling rather than a fixed footer. Four grouped label keys keep visible text and accessible names independent; the two legacy visible-text aliases override only visible labels. showCancelAction=false removes cancellation. Active cancel/confirm invokes its callback before requesting closure; synchronous throws prevent that request and promises are not awaited. Backdrop, Back/escape and external closure invoke neither business callback. Product async state and duplicate-mutation prevention remain caller-owned.

The native blur contract accepts omission/false and rejects true. DOM dialogRole, classes/refs/forms, ID associations, portal containers, web trigger/slot/animation props and a screen-reader speech guarantee are excluded. Explicit authored clipping/dimensions retain their ordinary constraints. Four new roles copy unchanged canonical colors: overlayBackdrop rgba(0, 0, 0, 0.3), statusDanger #b73434/#ff6b5f, statusWarning #a66b00/#f0b429 and statusSuccess #2f7d18/#6ad060 (light/dark). Info reuses controlSelectedBackground; status and validation overrides are independent. No dependency is added and all pre-existing defaults remain unchanged.

```tsx
import { useState } from "react"
import { AlertDialog, Button, NativeOverlayProvider } from "@codon-ui/react-native"

const Example = () => {
  const [open, setOpen] = useState(false)
  return (
    <NativeOverlayProvider>
      <Button onPress={() => setOpen(true)}>Review changes</Button>
      <AlertDialog
        accessibilityLabel="Review changes"
        titleText="Confirm changes"
        bodyText="Review the current configuration."
        isOpen={open}
        onOpenChange={setOpen}
        confirmAction={() => console.log("Confirmed")}
      />
    </NativeOverlayProvider>
  )
}
```

Use this provider once at the application boundary, rather than nesting the example under another overlay provider. The existing application-owned Intl setup still precedes importing the native barrel. Fourteen native counterparts now have source implementations; final installed/consumer receipts, remaining searchable/date/table checkpoints and physical/closer owner visual review remain distinct. iPhone signing stays deferred.
