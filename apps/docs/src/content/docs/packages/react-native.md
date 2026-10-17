---
title: "@codon-ui/react-native"
description: Private native foundation and explicit platform support limits.
---

@codon-ui/react-native owns canonical native source independently of the web React package. Its public entry exports native Text, PlaceholderText, Button, ToggleButton, ToggleSwitcher, Switch, Checkbox, CheckboxGroup, Input, TextArea, Radio, RadioGroup, NumberInput, Select, ListBoxItem, ComboBox, Modal, AlertDialog, LinearProgress, Meter, Indicator, LineSegment, CircleLoader and LaggingLinesLoader with their public props/ref/state types, plus NativeThemeProvider, NativeOverlayProvider, useNativeTheme and the public theme types. Source availability and installed-platform acceptance are recorded separately in the component-library roadmap.

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

## ToggleButton

ToggleButton composes the existing native Button target and interaction lifecycle. isSelected/onChange(boolean) owns controlled selection and defaultSelected initializes uncontrolled selection once. False remains authoritative while an owner repeatedly declines requests. A native activation requests selection before invoking onPress; same-value requests are suppressed. Disabled blocks native activation and cancels an active press with balanced callbacks. A parent can still change its prop, and explicit render-state methods remain programmatic requests.

```tsx
import { useState } from "react"
import { ToggleButton } from "@codon-ui/react-native"

export const Flag = () => {
  const [selected, setSelected] = useState(false)
  return (
    <ToggleButton accessibilityLabel="Mark item" isSelected={selected} onChange={setSelected}>
      Mark item
    </ToggleButton>
  )
}
```

Render children and final style callbacks receive current selected/pressed/hovered/focused/disabled state and foregroundColor, plus state with isSelected/defaultSelected/setSelected/toggle. Final style additionally receives post-custom defaultStyle. Primitive/Fragment content receives native Text; authored content remains intact. Root color reaches owned content. No-order semantic selection, all five action orders, three geometries, focus outline/offset and raised true/false use existing tokens; raised defaults false. Explicit color remains authored through hover/press/selection. Computed styles precede customStyles and final style, with native colors, registered styles and arrays. Numeric/percentage/auto dimensions include explicit zero and retain the existing target/clipping exceptions.

The actual View ref, native names/IDs and event/layout payloads remain public. Native semantics use one Button with owned checked selection state, corresponding to web button/aria-pressed. Initial autoFocus schedules a cancellable native View focus request; unmount or disabling before the frame prevents stale focus. This requests platform focus without a claim about physical keyboard or spoken output. Native focus replaces web focus-visible modality; DOM forms/classes/events and upstream slot context have no direct core-native host mapping. ToggleButtonGroup membership and SelectionIndicator context remain open inherited composition capabilities in roadmap 3.5.3. Standalone source delivery does not close those cells or installed rendering/autofocus/semantic acceptance.

## ToggleSwitcher

ToggleSwitcher renders a readonly explicit-items list with string id, ReactNode label, optional disabled and optional native accessibilityLabel for complex visual content. selectedKey/onSelectionChange controls selection; otherwise defaultSelectedKey, the initial first enabled item or an empty fallback initializes it once. An empty string is a real key. Same-key requests, group disabled/read-only and item-disabled actions do not change selection. A controlled parent may repeatedly decline; removal/reorder/relabel/reinsertion retains the key without synthetic callbacks. Unavailable keys render no selected option until reinserted.

```tsx
import { useState } from "react"
import { ToggleSwitcher } from "@codon-ui/react-native"

const modes = [
  { id: "and", label: "Match all" },
  { id: "or", label: "Match any" },
]

export const MatchMode = () => {
  const [mode, setMode] = useState("and")
  return <ToggleSwitcher accessibilityLabel="Match mode" items={modes} selectedKey={mode} onSelectionChange={setMode} />
}
```

The actual root ref is a View. Native identity/name aliases and layout events retain their payloads; the root is nonaccessible, leaving separate button/checked targets for options. Authored labels must be decorative content. Read-only remains inspectable; group disabled/read-only opacity applies once and does not announce busy. Unconstrained options use the existing 44-point/48-dp target policy, with authored dimensions/parent constraints retaining their normal exceptions.

Root size, three geometries, five orders, selected foreground color, fontSize12, uppercase and the nine canonical font-weight aliases remain configurable. Named dimensions are static logical numbers, percentages or auto and preserve zero; standard native style slots retain their broader native types. Root computed styles precede customStyles and final style. customOptionStyles applies to every option and customSelectedOptionStyles wins on the selected option; native typography fields reach owned Text. Labels render once, retain authored state and wrap within measured equal columns. Root layout fields configure the private row, while padding/border/background/external sizing remain root-owned. Root style callbacks receive current selectedKey/guards and post-custom defaultStyle.

One decorative selected surface follows accepted selection and measured layout positions with a 250 ms ease-in-out translation, opacity and scale0.92→1 entrance. Replaced transitions resume from stopped native values; late callbacks cannot restart a retired transition. Pending/unavailable Reduce Motion is static, live changes cancel current motion and unmount cancels both motion and measurement work. Source checks do not certify actual native frame timing, intrinsic geometry or spoken output.

Muted root defaults copy the unchanged canonical light/dark surface #f7f7f7/#202020 and border #c6c6c6/#3d3d3d. Root custom/final styles override them independently. Adding independent surfaceMuted/borderMuted provider roles remains a public-theme decision, so full theme acceptance stays open. This explicit-items component does not provide upstream ToggleButtonGroup or SelectionIndicator interop. Installed equal-cell/large-text/layout/motion/semantic cells remain separate acceptance work.

## Indicators And Segments

Indicator is a passive, caller-owned visual state. isActive defaults true; explicit false chooses inactiveColor, whose default is transparent. Its border still uses the active color unless borderColor is supplied. color defaults to the current owned Text/Button foreground or the theme foreground. size defaults to 10 native logical units, borderWidth to zero and shape to circle; rounded and square use the existing radius tokens. Constants, available-shape array and public props/ref/state aliases are exported.

```tsx
import { Indicator, LineSegment } from "@codon-ui/react-native"

export const Availability = ({ active }: { active: boolean }) => (
  <>
    <Indicator isActive={active} size={14} color="green" inactiveColor="gray" borderWidth={2} />
    <LineSegment direction="horizontal" height={80} size={4} />
  </>
)
```

LineSegment preserves the canonical direction tokens: horizontal uses height × size, and vertical uses size × width. With defaults this produces height50/width2.5 or height2.5/width50 respectively. color defaults to the native semantic control border. Native logical dimensions, percentages and auto replace CSS length strings; finite nonnegative numbers include explicit zero. Border thickness is numeric. CSS variables/units and unsupported dimensions reject rather than being ignored.

Both components expose an actual View ref, forward native identity/layout/accessibility props and consume their wrapper props. Native name/testID spellings take precedence over aliases, including explicit empty strings. They are decorative by default; set accessible and an appropriate native role/name when the surrounding composition needs a distinct semantic target. Neither component owns children, editing, selection requests or default-value state.

Root customization follows computed → customStyles → final style, with native color validation, registered styles and style arrays. A style callback receives post-custom defaultStyle plus current isActive for Indicator or direction for LineSegment. Provider changes update current colors/radii without local value mirrors. The maintained Indicator/Segment scene exercises state, all shapes, dimensions, explicit colors, style precedence, owned foreground, reset and live host changes. Source/consumer evidence and installed Android/iOS acceptance are separate cells in the roadmap matrix.

## Loading Indicators

CircleLoader retains size25, a 3-unit track, current owned/theme foreground, translucent gray remaining sides and an 850 ms linear rotation. Supply spinnerColor, spinnerTrackColor, spinnerTrackWidth and size independently. spinnerTrackIsTransparent=true overrides the supplied track color. customStyles belongs to the outer container; its color supplies the default ring foreground, and final style takes precedence. Container dimensions do not replace the ring's size prop.

LaggingLinesLoader retains a 150-by-50 container with three 20%-width/5-unit lines, opacity0.4/0.6/0.9, scaleX1.2/1.1/1, one-time 200/100/0 ms delays and a 3000 ms round trip eased separately on each half. width and color supply defaults. Its customStyles belongs to every visual line and may override animationDuration; standard final style belongs to the root. Native measured track width controls travel distance without restarting an active loop. Motion wrappers preserve authored visual transforms and the canonical far-end overhang.

```tsx
import { CircleLoader, LaggingLinesLoader } from "@codon-ui/react-native"

export const Loading = ({ stopped }: { stopped: boolean }) => (
  <>
    <CircleLoader accessibilityLabel="Saving changes" size={30} duration={stopped ? 0 : "0.85s"} />
    <LaggingLinesLoader
      accessibilityLabel="Fetching results"
      width="100%"
      customStyles={{ borderRadius: 5, animationDuration: stopped ? 0 : "1.5s" }}
    />
  </>
)
```

Both accept finite nonnegative numeric milliseconds and portable s/ms strings. Explicit zero stops motion without removing busy status. Reduce Motion changes stop/restart eligible motion; the first frame stays static while the preference query is pending or unavailable. Replaced/unmounted animations and preference subscriptions are cancelled. Layout and accessible-name aliases retain native precedence; refs expose the root View. Root style callbacks receive resolved duration, motion eligibility and post-custom defaultStyle. Native colors, arrays and registered styles remain supported without CSS variables/length units.

Exposed loaders own an indeterminate progressbar role, busy state and polite live region with default name Loading; accessibilityLabel, aria-label or legacy ariaLabel may provide a localized name. The graphic is decorative and there is no numeric value. Inside owned Button content the loader is decorative by default; explicit accessible opt-in remains available. Native frame timing, Reduce Motion rendering, measured custom geometry and screen-reader output require their separate installed/physical matrix cells.

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

Use this provider once at the application boundary, rather than nesting the example under another overlay provider. The existing application-owned Intl setup still precedes importing the native barrel. The roadmap records current source availability and separate installed/consumer acceptance; remaining searchable/date/table checkpoints and physical/closer owner visual review remain distinct. iPhone signing stays deferred.
