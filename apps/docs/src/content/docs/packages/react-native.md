---
title: "@codon-ui/react-native"
description: Private native foundation and explicit platform support limits.
---

@codon-ui/react-native owns canonical native source independently of the web React package. Its public entry exports native Text, PlaceholderText, Avatar, Tag, Link, Breadcrumbs, Toaster, ThumbnailImage, ThumbnailShowcase, Button, ToggleButton, ToggleSwitcher, Switch, Checkbox, CheckboxGroup, Input, TextArea, Radio, RadioGroup, NumberInput, TimePicker, DateTimePicker, DateTimeRangePicker, CompactTypeaheadSearch, TagComboBox, Pagination, Select, ListBoxItem, ComboBox, Modal, AlertDialog, ClickPopover, Tooltip, HoverPopover, LinearProgress, Meter, Indicator, LineSegment, CircleLoader and LaggingLinesLoader with their public props/ref/state types, plus NativeThemeProvider, NativeOverlayProvider, NativeBackdropHost, NativeFloatingLayerHost, useNativeTheme and the public theme types. Source availability and installed-platform acceptance are recorded separately in the component-library roadmap.

## Host And Package Ownership

The laboratory pins Expo SDK 57, React Native 0.86.3 and React 19.2.3 for iOS/Android. React, React Native, react-native-safe-area-context5.7.0, react-native-svg15.15.4 and react-native-teleport1.2.2 are exact package peers. Hosts install/link the native peers and rebuild their native binaries after adding SVG or Teleport. Expo, outer safe-area layout, app configuration and routing/fixtures belong to the showcase or consuming app; Select, Modal and AlertDialog own safe-area handling inside their separate native windows. Web CSS, React DOM and React Aria are absent from the library runtime graph. Public native registry/CLI distribution and publication remain separate gates.

The root export has a react-native condition for canonical TypeScript source; declarations and compiled imports use dist. Build before consumer typechecks. The Text/Button pass includes a hashed local package archive and isolated Expo consumer; the ledger owns its exact proof receipt. Bare React Native, RN Web, other operating systems and earlier SDK combinations are unverified.

```sh
pnpm -F @codon-ui/react-native build
pnpm -F @codon-ui/react-native typecheck
pnpm -F @codon-ui/react-native typecheck:contracts
pnpm -F @codon-ui/react-native test --runInBand
```

## Native Keyboard Focus

NativeFocusView provides a source-owned native View root with ordinary native props/styles and the actual View ref. It adds no layout wrapper. focusable defaults to true; focusable=false or tabIndex=-1 blocks keyboard focus requests. Use focusNativeTarget(target) and blurNativeTarget(target) for this host or a live registered core TextInput. A true return means request admission; onFocus/onBlur acknowledge actual native focus and include native origin metadata. Plain core Views retain upstream focus behavior. The helpers preserve editor values and do not move screen-reader focus.

The owned host now resolves inherited labelled-by IDs against live targets in its actual native window, retaining ID order and explicit empty resolved text. Private Breadcrumbs and tooltip construction additionally use owned supplementary description/details bindings. Android keeps descriptions in tooltip metadata and details in supplemental-description metadata; when binding a description, the pinned SDK's tooltip-based accessibilityHint is retained in the native hint field. Existing native value/state content stays intact when deriving a label. iOS exposes supplementary AXCustomContent with configurable captions and preserves caller custom content. Closing/replacing the measured tooltip retires its tag relationship without changing the trigger label, hint, ref or controlled values. Tooltip/HoverPopover also bind raw core View/TextInput accessibility elements through a scoped native adapter, retaining actual refs and editor values. Native runtime interoperability, installed metadata, native role/current-item and complete pointer acceptance remain open.

onKeyDown/onKeyUp receive original native synthetic keyboard events with logical key, platform code/characters, phase/repeat/cancellation, separate Shift/Alt/Control/Meta/Caps, raw modifiers and timestamp. TNativeInteractionEvent is the touch-or-keyboard union. TNativePressEvent additionally admits native activation; narrow kind="keyboard" versus kind="activation", then read touch-only coordinates only in the remaining touch arm. Activation contains actual target/source and observedAt (native callback-observation time), without fictitious touch coordinates or a hardware timestamp. Native default capture uses private declarative policy before JS delivery; later JS preventDefault cannot retroactively cancel a platform default.

This package now includes native codegen/autolinking inputs and needs a consumer native rebuild. Raw source/type and compiler checks do not prove installed behavior. The private per-window key scope now occupies the floating host’s existing native root and acknowledges actual window epochs and policy revisions before JS action admission. Native target/modifier/editable/composition policies, Escape child/shield routing and physical-window deactivation guards are implemented at source tier. NativeFocusView focus events include observed isFocusVisible metadata; a generic focus event alone does not establish keyboard-visible focus. The updated scope still requires matching consumer/native products and installed proof. Further owned-control migration and installed native hover/description/viewport acceptance remain open. Public Tooltip/HoverPopover ignore touch entry, with no automatic tap or long-press trigger. An explicit tap-triggered popover is a separate ClickPopover contract, also still under construction.

## Pagination

Pagination requires currentPage, itemsPerPage, numberOfItems and both request callbacks. Owner values remain authoritative when requests are declined. Numeric counts use finite safe integers; page and size are positive, total may be zero. A temporarily out-of-range owner page stays unchanged. Size selection requests size before a page calculated from the caller’s current first-item index. The page-entry draft initializes separately to1, can be empty, and submits only through Go.

```tsx
import { Pagination } from "@codon-ui/react-native"

export const Pager = () => (
  <Pagination
    currentPage={1}
    itemsPerPage={10}
    numberOfItems={200}
    setCurrentPage={(page) => console.log(page)}
    setItemsPerPage={(size) => console.log(size)}
    chosenPaginationSubcomponents={["primary-controls", "page-counter", "page-input", "items-per-page"]}
  />
)
```

Mount NativeFloatingLayerHost around overflow presentations. Chosen groups retain caller order with duplicates removed; an empty group list selects the canonical primary default. RTL, both consolidation sides, geometry, independent native style/prop slots, grouped/legacy labels, custom icons and the actual root/editor/popup refs remain supported. The overflow shell defaults unraised and uses physical bottom-right placement. Explicit initial-focus ownership and slot=null popup control retain the ClickPopover contracts. Native keyboard/pointer/focus completion, measured rendering and accessibility profiles remain acceptance work.

## Breadcrumbs

Breadcrumbs accepts caller-owned string IDs, hrefs, content and disabled flags. It preserves first/current entries and consolidates the middle of long trails; maxVisibleItems ranges from3 through8, with left/right placement. Mount NativeFloatingLayerHost around trails that can overflow. The root exposes its actual native View ref; names, ordered label/description IDs, navigation and current-page metadata use the owned native adapters.

```tsx
import { Breadcrumbs, NativeFloatingLayerHost } from "@codon-ui/react-native"

export const Trail = () => (
  <NativeFloatingLayerHost>
    <Breadcrumbs
      items={[
        { id: "home", href: "https://example.com", content: "Home", disabled: false },
        { id: "current", href: "", content: "Current", disabled: false },
      ]}
      maxVisibleItems={4}
      consolidationPlacement="right"
    />
  </NativeFloatingLayerHost>
)
```

Visible entries retain Link's native URL behavior. Overflow closes before one onNavigate request with the original item, href and target; omitted handling uses Linking. The browser target string is callback metadata for the native host to interpret. Popup ownership and native popup style/ref/event props remain available through customClickPopoverProps. Root, breadcrumb/link, overflow button, popup and options-list styles retain independent owners. Linked rows ignore Space selection; empty-href rows keep the canonical selection/action distinction. Native focus/keyboard/pointer completion, spoken relationships and exact rendering remain required acceptance work.

## ClickPopover

Mount NativeFloatingLayerHost at the native window root. NativeDialogTrigger exposes an explicit trigger render function; attach its original triggerProps/ref to a Button or supported native target. ClickPopover also accepts a real triggerRef for independent controlled ownership. Controlled isOpen/onOpenChange waits for owner echo, including declined close requests. Root, dialog and arrow each retain separate native style slots; childIsDialog=false keeps authored content directly under the root.

```tsx
import { Button, ClickPopover, NativeDialogTrigger } from "@codon-ui/react-native"
;<NativeDialogTrigger trigger={(state) => <Button {...state.triggerProps}>Edit</Button>}>
  <ClickPopover showOverlayArrow accessibilityLabel="Edit details">
    Editable content
  </ClickPopover>
</NativeDialogTrigger>
```

Use scrollRef with the actual core ScrollView and initialFocusRef/restoreFocusRef with live NativeFocusView or core TextInput targets. Default entry preserves an already focused descendant. Native repositioning retains the focused descendant’s selected viewport edge while genuine input/focus/scroll/ref/window changes retire stale restoration. These operations preserve caller refs, scroll events and controlled values. Ordinary nonmodal outside touch remains interactive; outside focus requests closure and keeps the new focus. SubmenuTrigger retains its distinct outside-press, ancestor-scroll and pointer-entry policy. slot=null opts out of the nearest trigger context. Installed portal ordering, focus, keyboard resizing, accessibility and exact native rendering remain acceptance gates.

## Tooltip And HoverPopover

Mount NativeFloatingLayerHost once at the native window root, outside clipping/scrolled app content. NativeTooltipTrigger uses an explicit trigger render function so the caller attaches the original trigger props/ref without cloning children. Button or NativeFocusView supplies portable keyboard focus; plain core Views retain upstream focus behavior. A standalone controlled surface can instead receive an actual triggerRef, including a core TextInput ref. The ref exposed by each description remains its actual nonfocusable native root.

```tsx
import { Button, NativeFloatingLayerHost, NativeTooltipTrigger, Tooltip } from "@codon-ui/react-native"

export const DescribedAction = () => (
  <NativeFloatingLayerHost>
    <NativeTooltipTrigger trigger={(state) => <Button {...state.triggerProps}>Save</Button>}>
      <Tooltip descriptionLabel="Action details">Save the current draft.</Tooltip>
    </NativeTooltipTrigger>
  </NativeFloatingLayerHost>
)
```

The default trigger opens after1500ms of non-touch hover or immediately on observed keyboard-visible focus, with500ms close grace. delay/closeDelay preserve zero. Controlled isOpen/onOpenChange waits for owner echo; defaultOpen initializes uncontrolled ownership once. triggerMode="focus", isDisabled and shouldCloseOnPress=false configure the description independently from the underlying action. Tooltip defaults to an arrow, inverse surface and5-unit padding; HoverPopover defaults to no arrow, ordinary surface, column flow/gap15 and10-unit padding. Both retain22 placements, live LTR/RTL, boundary/flip/maxHeight/offset constraints, rounded/orthogonal geometry, five orders and independent customStyles/final style/customOverlayArrowStyles.

The approved backend reads actual window/keyboard/host bounds and observes only the anchor's native scroll ancestors. An ancestor scroll requests closure even with shouldUpdatePosition=false; internal description scrolling is independent. Descriptions never acquire/restore keyboard focus or make the parent modal. Live supplementary metadata preserves caller label/hint/value and follows current native description text; close, target replacement, window deactivation and unmount retire the lease. descriptionLabel/detailsLabel localize supplementary captions, including empty strings. Source/compiler checks establish implementation only; matching consumer/Release and installed/profile/accessibility evidence remain separate acceptance gates.

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

Text uses 31 variants, six weights, system fonts and uncapped native scaling. A final undefined font field clears an authored override and restores the current variant/weight/style/theme default. Defined zero, empty strings and other native styles remain authoritative. This also restores owned Link/Tag phrases when their root typography is cleared. Explicit native role/accessibility-role wins, followed by link intent and heading intent. Element names express semantics, without DOM associations or heading-level guarantees. Ordinary Text defaults selectable; labels and Button-owned content default unselectable. Explicit selection wins. Native labels/IDs take precedence over the supported aliases.

Display fonts fall back through the heading and body families; nested text inherits an unoverridden italic style while retaining its own variant and weight defaults. Text and PlaceholderText transition numeric colors for 250 ms with ease-in-out timing, resuming an interrupted transition at the current color. Inherited text follows its parent's current paint without another animation clock. Pending, unavailable or enabled Reduce Motion and opaque native colors use current static colors. Actual native timing, trait-color rendering and appearance profiles remain acceptance work.

Button retains the pinned native Pressability touch behavior on its source-owned focusable View root, with the actual View ref. Its semantic activation/start/up/end callbacks receive TNativePressEvent; raw press-in/out receive TNativeInteractionEvent. Native activation runs start/change(true), up, end/change(false), action without synthetic raw in/out. Actual admitted touch/key release supplies onPressUp; cancelled cycles do not. Narrow nativeEvent before reading modality-specific fields. Its render state contains pressed, hovered, focused, disabled, pending and final foreground; a dedicated focus-visible render flag remains absent. Default rings use the actual native focus-visible metadata and subsequent observed key/pointer input, preserving isFocused and original focus callback counts. Strings/numbers/bigints receive an owned Text wrapper, nested Text inherits foreground and render children can use it for icons. Root customStyles/final style support native text typography and decoration: fontSize, fontFamily, fontWeight, lineHeight, letterSpacing, textTransform and other native TextStyle fields apply to owned primitive/array/Fragment/render-function phrases. Text fields stay off the native layout style. Authored Text/elements retain their own typography and identity; they are not cloned. Final styles win, zero remains meaningful and undefined clears an authored text field back to the owned Text default. Pending suppresses activation/presentation, announces busy and retains focus eligibility. Disabled also disables focus. Mid-gesture blocking balances started end/change transitions.

Button accepts render(props, state) for an authored native root. Forward the supplied props, ref and children to NativeFocusView so its original native focus, input and activation ownership remains intact. Color transitions use250ms ease-in-out; shadow color/scalars use450ms. They interrupt from current paint, respect live Reduce Motion and retire on unmount. Callback foreground remains the final authored target; inherited text follows the parent paint and explicit authored Text retains its own clock. These are source contracts, with installed timing/rendering still required.

An admitted Enter/Space down starts the Button press; its matching native up ends it and activates once, including modified keys. Repeats do not create another action. Blur, pending/disabled takeover and observed window deactivation cancel held activation; re-enabling does not revive it. Native onKeyDown/onKeyUp retain original modifier/consumption data and can veto the library action with preventDefault, without undoing the already reported native default handling. Real pointer enter/leave preserves the original event and supports delayHoverIn/delayHoverOut; touch entry does not create hover. Timers retire on guard/window loss and unmount, and callback replacement uses the current owner. Native hover production and installed keyboard/default/lifetime acceptance remain open; source-injected events do not prove transport.

Explicit focusable=false or tabIndex=-1 excludes Button from keyboard focus and portable focus requests while retaining touch and native click handling. Removing focus eligibility cancels a held key; restoring eligibility does not revive it. ToggleButton initial autoFocus requests focusNativeTarget on the actual Button root and cancels on disablement/unmount. A request does not synthesize a focus acknowledgment or move screen-reader focus. Android reconciles owned keyboard eligibility after inherited accessibility props and retains the SDK native click listener independently; installed focus/accessibility acceptance remains required.

Computed theme/state styles precede custom and final native styles. Explicit hoverColor wins in the computed layer, pressed state wins over hover and final authored styles always win. This approved native rule differs from the web cascade. Default unconstrained Buttons have 44-point iOS / 48-dp Android minima and grow with text; authored dimensions remain meaningful. Hit testing follows native parent geometry and overflow policy, and an unclipped parent can allow activation outside its bounds. Hosts requiring a strict parent boundary must explicitly clip overflow. Automatic hit slop does not prove an adjacent or constrained target passes.

DOM classes, browser click events, HTML forms, CSS dimensions and browser refs are rejected by public type cases. Native styles and callbacks retain native payloads; arbitrary children are not cloned to inject styles.

## Basic Controls

Switch and Checkbox retain controlled/uncontrolled boolean selection, disabled/read-only guards, native refs/events, geometry/order and validated native styling. Their small visual track/shape is separate from the 44-point iOS / 48-dp Android root target. Switch retains left/right labels, icon slots and track/thumb styles; native OS drag/animation is not promised. Checkbox mixed state remains caller-owned, announces checked mixed and retains its line with showIcon false. CheckboxGroup coordinates string-valued members through private context; member discovery does not depend on walking or cloning children, and group state/guards own members, nested groups isolate state and descendants remain separate accessibility targets. Native read-only state has no AccessibilityState field; supply localized hints when needed. CheckboxGroup supports root render(props, state) and function children with current readonly value/disabled/read-only data; forward the supplied View props/ref/children. Style → children → root callbacks preserve order, primitive/Fragment output uses owned Text and authored members retain identity. The default cross axis is centered and the existing per-member dimming policy remains.

Input is a single-line core TextInput wrapper with native refs, text/submit/focus/selection events, keyboard options and text scaling. Use isDisabled/isReadOnly; editable/readOnly aliases, DOM events and multiline are excluded. Small/medium/large map to b11/b10/b9. Error → warning → success is border presentation, with validation messages/schema owned by the host. Style callbacks receive focused/disabled/read-only/invalid state and the post-custom defaultStyle. Placeholder color and three validation borders use named theme roles; all twelve added roles copy existing web colors, preserving existing native defaults/action ramps. When submitting, a host can take the final value from event.nativeEvent.text before dismissing the keyboard rather than assuming its last rendered value has caught up.

## TextArea And Radio Groups

TextArea owns core multiline editing with a real TextInput ref and requires a nonempty accessibilityLabel/aria-label. Its default 96-unit height is caller-overridable; native content scrolls without automatic growth. numberOfLines is a platform hint and Android text aligns at the top. Return defaults to newline; explicit submitBehavior is supported. Deprecated blurOnSubmit, single-line clearButtonMode/secureTextEntry and CSS resize are excluded. Native change/selection/content-size/submit events retain their payloads. Disabled/read-only block mutation, while only disabled changes opacity and focus eligibility. Size, geometry, validation priority, color validation and post-custom style callbacks follow Input without changing Input or the palette.

Radio requires a nearest RadioGroup, a string value and an explicit nonempty accessible name. RadioGroup also requires a name and owns controlled value or initial defaultValue plus onChange(string). undefined is uncontrolled; null clears controlled selection, and the empty string is a valid member value. Controlled members wait for parent echo. Reselection and removal do not emit changes; reinsertion restores the retained value. Hosts supply unique stable member values. Private context reaches ordinary wrappers and isolates nested groups without child discovery or cloning. Its inherited render(props,state) receives the actual View props/ref/children and current readonly value/isDisabled/isReadOnly after style resolution. The private provider still owns members, original native events retain identity, and custom/final styles override centered cross-axis alignment. Group children remain ordinary ReactNode under the original approved native contract; no React Aria state/slots or function-children contract is introduced.

Group disabled/read-only guards own descendants; a member can add isDisabled. Read-only permits focus/inspection without mutation or disabled opacity. Disabled opacity applies once per member. Each member owns radio/checked/disabled traits; the nonaccessible radiogroup wrapper keeps members separate. Hosts supply localized read-only/validation explanations and verify physical announcements later. Radio's 20-unit native mark uses existing geometry/order/color/focus roles, with stable selected fill during hover/press. Root width/height/customStyles/final style constrain the target; customShapeStyles owns the mark. Primitive/array/Fragment labels use owned Text with uncapped scaling. Targets retain the existing 44-point/48-dp minima and explicit/clipped-parent exceptions. Group flow defaults vertical with two spacing units; horizontal flow wraps. DOM forms, web keyboard coordination and independent member selection props are excluded.

## NumberInput

NumberInput composes the existing Input and two Buttons into independently named editor/decrement/increment targets. Supply accessibilityLabel (or aria-label), incrementLabel and decrementLabel. Its ref is the core TextInput. value/defaultValue are number or null; undefined selects uncontrolled initialization. Raw text remains a draft until a final native edit/submit or step commits one numeric change. Empty text commits null; invalid or incomplete text restores the stored value. Controlled values wait for parent echo, and configuration/guard changes cancel an outstanding edit.

The private decimal model limits precision to six fractional digits and representable safe integer units. Bounds, optional min-anchored step, nearest rounding and single-press stepping have explicit semantics; hold-repeat, exponent/hex syntax, currency/percent/unit formatting and general web NumberField behavior are excluded. The exact @internationalized/number 3.6.6 utility owns locale symbols and parsing. Hosts own localized names, read-only explanations and validation messages. Per-part native styling, guard behavior and target minima follow the existing controls without adding palette roles.

Consumers must prepare required Intl.NumberFormat operations, selected locales and numbering systems before importing the native barrel. Missing formatToParts raises a contextual TypeError. The showcase explicitly prepares English/French regional data with its approved exact FormatJS dependencies when native support is inadequate; an adequate formatter is preserved. That app bootstrap also accepts the published Number/BigInt toLocaleString effects. The library does not install a global polyfill. Consumer applications choose and verify their own runtime setup and locale data.

## CompactTypeaheadSearch

CompactTypeaheadSearch is a public generic compound with an original native TextInput, search button, suggestions and independent minimum-query/loading status panels. Supply caller-curated items with getItemKey/getItemTextValue; the wrapper does not add a query filter. String and number keys remain distinct, including numeric zero and an empty string. renderItem receives the original item plus query, textValue and itemKey.

```tsx
import { useState } from "react"
import { CompactTypeaheadSearch } from "@codon-ui/react-native"

const choices = [
  { id: 0, name: "Alpha" },
  { id: "0", name: "Beta" },
]

export const SearchExample = () => {
  const [query, setQuery] = useState("")
  const [value, setValue] = useState<string | number | null>(null)
  return (
    <CompactTypeaheadSearch
      accessibilityLabel="Search choices"
      items={choices.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.name}
      inputValue={query}
      onInputChange={setQuery}
      value={value}
      onChange={setValue}
      minimumInputLength={0}
    />
  )
}
```

value, inputValue and isOpen have independent ownership. Omit each controlled prop to use its default/uncontrolled behavior; retain it to decline requests. A selection requests onChange before deferred close/focus, and isLoading can coexist with minimumInputLength guidance. labels, DEFAULT_COMPACT_TYPEAHEAD_SEARCH_LABELS and resolveCompactTypeaheadSearchLabels cover group/button/list/status naming. The exported size constants describe small, medium and large text.

The root ref is its original View and inputRef is the original TextInput. onKeyDown/onKeyUp receive that input's original event with target/currentTarget and composition state; preventDefault participates in the existing native editor-default acknowledgement. NativeComboBoxContext and the input/group/button/popover/list contexts retain named/default/null slot precedence. The root render/style callbacks and independent input/button/group/options style slots retain their native owners, explicit zero values, validation precedence and border transitions.

## TagComboBox

TagComboBox composes removable tags with the same collection-backed editor. selectedItems is always caller-owned. onSelectedItemsChange requests a copied array and change details containing action, changedItems and changedKeys; retaining selectedItems declines the request. Only owner-echoed selections disappear from the available suggestions. Selection requests precede the empty-query request, and selected tags remain independent of the draft query.

```tsx
import { useState } from "react"
import { TagComboBox, TagComboBoxItem } from "@codon-ui/react-native"

type TChoice = { id: string; name: string }
const choices: TChoice[] = [
  { id: "alpha", name: "Alpha" },
  { id: "beta", name: "Beta" },
]

export const TagsExample = () => {
  const [selected, setSelected] = useState<TChoice[]>([])
  return (
    <TagComboBox
      accessibilityLabel="Choose tags"
      items={choices}
      selectedItems={selected}
      onSelectedItemsChange={setSelected}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.name}
    >
      {(item) => (
        <TagComboBoxItem id={item.id} textValue={item.name}>
          {item.name}
        </TagComboBoxItem>
      )}
    </TagComboBox>
  )
}
```

Omit children for default options. TagComboBoxItem is the native compound's committed collection item receiver; it supports native refs, item render state, text/description slots, links and item actions. renderTagContent and customTagGroupProps/customTagProps/customComboBoxProps customize their respective owners. Independent root/tag-group/tag/ComboBox style slots preserve precedence. labels names each group, query, trigger, empty list and close action. Native descendant focus drives the root outline, including custom children, and existing native motion honors reduced motion and interrupted border transitions.

Both compounds support name, form, formValue="key"/"text", required/custom/server validation and reset through NativeForm. NativeFormAction supplies native submit/reset controls; submitNativeForm/resetNativeForm operate on the original form View. onSubmit/onReset receive the original form request and can prevent its default. The form serializes the field's selected key or query according to formValue; TagComboBox's selectedItems array remains caller-owned. NativeComboBoxLabel, NativeComboBoxText, NativeComboBoxFieldError and NativeComboBoxValue expose the corresponding field slots/state where a custom scaffold supplies them.

useNativeContextProps merges an authored receiver's selected context props and original host ref, preserving default/named/null slots, callback order and React19 ref cleanup. NativeCollectionRendererContext, DefaultNativeCollectionRenderer and NativeCollectionCellFocusContext support an authored VirtualizedList renderer while CUI retains committed item identities and native bindings. The maintained TagComboBox example uses these public exports for its popup, form and virtualized options.

These two source integrations follow the approved remaining-component priority. Focused source, public types and maintained examples are distinct from the open installed keyboard/default, accessibility, virtualization and profile gates in the canonical roadmap. They do not close TimePicker milestone44 or promote native acceptance.

## TimePicker

TimePicker exposes the complete segmented-field source through the public native entry. Its source-first integration leaves milestone44 and complete original native input/ref/default qualification open; the canonical roadmap owns the current acceptance verdict. Public availability and source examples do not establish installed keyboard, IME, focus timing, accessibility or profile acceptance.

Values are Time, CalendarDateTime or ZonedDateTime objects from the pinned @internationalized/date3.12.1 runtime. value={null} explicitly controls an empty field; omit value to initialize uncontrolled state with defaultValue. onChange requests a value of the owner's class or null, preserving calendar/date/time-zone fields. A controlled owner can decline a request by retaining its value. The exported component accepts the complete TimeValue union; `TimePickerProps<T>` additionally describes a specific supported value class.

```tsx
import { Time } from "@internationalized/date"
import { useState } from "react"
import { NativeLocaleProvider, TimePicker, type TNativeTimePickerValue } from "@codon-ui/react-native"

export const StartTime = () => {
  const [value, setValue] = useState<TNativeTimePickerValue | null>(new Time(13, 45, 7))
  return (
    <NativeLocaleProvider locale="en-GB">
      <TimePicker accessibilityLabel="Start time" value={value} onChange={setValue} granularity="second" />
    </NativeLocaleProvider>
  )
}
```

The wrapper defaults to24-hour display and leading zeros; hourCycle={12}, granularity, hideTimeZone, placeholderValue and minValue/maxValue retain the typed date-field semantics. NativeLocaleProvider supplies locale and derived direction. The host owns required Intl support and locale data. The source contract keeps readonly segments focusable while rejecting edits; disabled blocks focus and editing. Native keyboard/focus callbacks retain their original events. TNativeTimePickerRef is the actual outer native View, while the component owns its original editable segment hosts.

NativeTimeFieldContext supplies inherited field props, refs and named slots; explicit caller props and slot={null} preserve their context precedence and opt-out rules. NativeTimeFieldStateContext exposes the field state to descendants. TimePicker owns the segmented-input/clock scaffold. ComponentIcon replaces the clock; render receives the root props and current render state, and a custom root must preserve the supplied ref and generated children. NativeTimeFieldLabel, NativeTimeFieldText and NativeTimeFieldError consume the label, description/errorMessage and validation slots when rendered inside those field providers.

height, width, textSize, geometry, enableFocusStyle and offsetFocusRing control presentation. customStyles, customInputIconGroupStyles and customInputStyles keep the root, input/icon group and input independently owned. Final root style follows computed dimensions and customStyles; its callback receives state and defaultStyle. errorState takes border precedence over warningState and successState. Native style arrays, registered styles, platform colors, live theme updates and Reduce Motion retain the source contract. name/form metadata uses timeValue.toString() serialization, including time-only serialization for date-bearing values; it adds no browser submission or navigation.

## FormField

FormField arranges a caller-owned control with a label/required marker, top/bottom right content, ordered error/warning/success messages and an italic description. It owns no control value, validation state, submission or child ref. An explicit empty message array still renders the bottom row. Zero/false bottom-right content alone does not create that row; zero is preserved when a message array creates it.

```tsx
import { useRef, useState } from "react"
import type { TextInput } from "react-native"
import { FormField, Input } from "@codon-ui/react-native"

export const EmailField = () => {
  const editor = useRef<TextInput>(null)
  const [value, setValue] = useState("")
  return (
    <FormField
      label="Email"
      labelID="email-label"
      labelFor={editor}
      required
      description="Where to send the requested information"
      errorMessages={[]}
    >
      <Input ref={editor} accessibilityLabel="Email" value={value} onChangeText={setValue} />
    </FormField>
  )
}
```

labelFor accepts a native focus ref; label activation requests only the current target's focus method. Replacing/removing a label or ref and unmounting retire old handlers. labelID maps to nativeID, while callers explicitly name their actual controls. The owned root accepts ordered native-ID references through accessibilityLabelledBy/aria-labelledby/ariaLabelledBy, aria-describedby/ariaDescribedBy and aria-details/ariaDetails. Native names/labelled-by props precede native aria forms and aliases, including explicit empty strings. Description/details strings split on whitespace; empty strings clear the relationship instead of falling back. The existing native backend resolves current same-window targets; descriptions/details preserve caller-authored label, hint and value. labels.descriptionLabel and labels.detailsLabel localize the supplementary iOS captions, including explicit empty captions. These root relationships do not automatically associate the child editor or prove installed metadata or spoken output; those acceptance cells remain OPEN.

Eight independent native style owners cover root, top row, label, top right, bottom row, bottom right, validation and description. Computed → customStyles → final root style preserves zero dimensions, native arrays/registered styles and platform colors. Validation styles apply to the cradle and each message, with custom text color overriding the existing severity role. Root foreground reaches ordinary content without replacing an explicitly colored child. raised uses the canonical light/dark shadow values. Browser text transitions, independent validation-foreground theme aliases, exact inline marker spacing and full installed layout/accessibility/profile acceptance remain OPEN. Existing physical/device deferrals remain unchanged.

## TypeaheadSearch

TypeaheadSearch is an inline search surface with a controlled query, caller-curated Iterable results and six caller-driven statuses. It adds no fetching, filtering, debouncing, minimum-length gate or automatic empty status. The search button and native submit action call onSubmitQuery with the trimmed current controlled query, including empty/repeated submissions. Native observer text never replaces the owner query.

```tsx
import { useRef, useState } from "react"
import type { TextInput } from "react-native"
import { TypeaheadSearch } from "@codon-ui/react-native"

const suggestions = [
  { id: 0, name: "Alpha" },
  { id: "", name: "Empty-key result" },
]

export const SearchExample = () => {
  const editor = useRef<TextInput>(null)
  const [query, setQuery] = useState("")
  return (
    <TypeaheadSearch
      accessibilityLabel="Search suggestions"
      inputRef={editor}
      inputValue={query}
      onInputChange={setQuery}
      items={suggestions}
      getItemKey={(item) => item.id}
      getItemTextValue={(item) => item.name}
      status="results"
    />
  )
}
```

The root ref is a native View; inputRef exposes the actual TextInput. A filtered inputProps keyboard/observer allowlist keeps native payloads while preventing value/change/style/ref/name/identity replacement. Native onSubmitEditing submits once after the observer, using the owner query rather than event.nativeEvent.text. onKeyPress is observational and does not add a second Enter submission. Root children and DOM class/ref/event surfaces are excluded.

Status defaults to results. idle/minimum-query/loading/error/empty display resolved copy; results with zero items stays an empty collection until the caller changes status. Default labels merge defined legacy aliases, then grouped labels and nested status overrides; explicit empty strings survive. SearchIcon/LoadingIndicator retain falsy-to-default behavior. Defaults are a decorative native magnifier and an 18-unit/2.5-track/850ms transparent-track loader with live Reduce Motion. Native primitive content also supports bigint through the existing Text wrapper, with keyed authored children retained.

Results own internal single selection: a repeated key toggles to null; query/relabel/reorder/removal/reinsertion retains selection without a fabricated callback. Leaving results unmounts that collection and resets its selection while preserving the Input and viewport. Explicit getItemKey keeps typed string/number identities; default keys stringify id/ID before falling back to index. Keys must be unique. Empty text metadata is allowed and row names derive from authored native content. The canonical disabled scope is preserved: query/search are blocked and dimmed, while existing result rows stay selectable.

Six independent native style owners cover root, input row, input, search button, result viewport and result list. Root precedence is computed → customStyles → final style; three row geometries, current theme roles, array/registered styles, platform colors and authored zeros remain supported. The viewport defaults to minHeight160 and half the actual window height, with native nested scrolling. Native row focus actions honor shouldFocusWrap and use guarded measured scrolling without selecting. Equivalent data/styles and callback-only updates retain pending focus; layout/query/render/data or editor/button focus takeover retires it. Complete browser keyboard/typeahead/modifier/virtual-focus semantics, inherited transitions, exact native icon/rendering/viewport behavior and installed Android/iOS/profile proof remain required OPEN. Physical/device/closer-owner/signing deferrals retain their existing scope.

## Stepper

Stepper uses the same approved decimal state, contextual incrementLabel/decrementLabel, native TextInput ref and inputProps observer/keyboard allowlist as NumberInput. It places decrement, editor and increment in a horizontal row or column-reverse group. Segmented/cohesive type, fill/outline mode, three geometries/sizes, all five action orders and independent root/group/input/button styles follow the audited web contract. Root final style callbacks receive numeric/focus/guard state and post-custom defaultStyle. Canonical default-type margin/button-mode quirks and falsy-to-default PlusIcon/MinusIcon behavior are retained; native dimensions preserve zero.

```tsx
import { useState } from "react"
import { Stepper } from "@codon-ui/react-native"

export const Quantity = () => {
  const [value, setValue] = useState<number | null>(0)
  return (
    <Stepper
      accessibilityLabel="Quantity"
      incrementLabel="Increase quantity"
      decrementLabel="Decrease quantity"
      value={value}
      onChange={setValue}
      minValue={0}
      maxValue={10}
      step={0.1}
      type="cohesive"
      order="primary"
    />
  )
}
```

A short native release requests one step. Holding starts repeat after600ms and continues every60ms, with no extra release request; cancellation, guard/configuration takeover, bounds and unmount retire it. Repeated controlled veto requests always derive from the authoritative value. Raw editing text commits from native end/submit events, with duplicate final delivery suppressed; a cancelled press cannot leave that commit pending. The group stays nonaggregating so its editor/buttons remain separate targets; labels.inputButtonGroupAriaLabel preserves the authored group name. Actual installed focus/gesture/geometry/accessibility acceptance remains open. Currency/percent/unit/significant-digit formatting, non-snap validation, browser forms/reset, automatic label-ID/description relationships, full wheel/modifier/composition-aware keyboard and pointer-specific/localized speech behavior are still required inherited mappings, not approved capability removals. No dependency or palette change is introduced.

## Slider

Slider keeps scalar and multi-thumb range values caller-owned. Omitted value/defaultValue creates one minimum thumb and array callbacks; a numeric value/defaultValue infers numeric onChange/onChangeEnd. Empty arrays remain empty. Bounds/step/adjacent-thumb projection never mutates supplied arrays. Track presses choose the nearest thumb with end-side tie preference; individual thumb drags keep their grab offset. onChangeEnd reports the final actual request once, including owner veto. Multiple pointers finish after the last active thumb; disabled/member/configuration/count/geometry takeover and unmount retire obsolete work.

```tsx
import { useState } from "react"
import { Slider } from "@codon-ui/react-native"

export const PriceRange = () => {
  const [values, setValues] = useState([0.25, 0.75])
  return (
    <Slider
      accessibilityLabel="Price range"
      label="Price range"
      thumbAriaLabels={["Minimum price", "Maximum price"]}
      value={values}
      onChange={setValues}
      minValue={0}
      maxValue={1}
      step={0.05}
      formatOptions={{ style: "percent" }}
      width="100%"
    />
  )
}
```

Horizontal LTR/RTL and vertical use root-relative native measure/touch coordinates. Native thumb targets are44 points on iOS/48dp on Android around18-unit visual bodies, with endpoint insets. Explicit thumb axes retain their authored sizes. The default horizontal root is300 units with maxWidth300; a vertical track uses150 units unless resolved root height constrains it. A fixed minValue=maxValue domain stays at one finite position without fabricated numeric changes. The five root/label/output/track/thumb style owners accept native registered/array styles and colors, with post-custom defaultStyle in the root style callback. Its state supplies the audited SliderState queries/setters, thumb formatting, focus/editability/dragging and page helpers. customOutputFormatter receives a disposable value copy. Native adjustable fields/actions use the same numeric path, contextual thumb names stay separate and label activation requests the first surviving thumb ref.

All three geometries, five existing action orders, both modes and theme updates remain available. Explicit thumb paint wins over dragging colors; local neutral700 values mirror the canonical theme without adding a role. Root native refs/IDs/layout/observers are preserved. Source typing rejects DOM classes, unsupported CSS dimensions, form thumbNames, child replacement, role takeover and null values. Browser form/reset/description-ID association, upstream locale context, complete modifier/pointer-button/keyboard handling, arbitrary root rendering, CSS transitions and unrestricted transformed style/hit coupling remain required open mappings. Actual installed gestures, target/layout/font/window/semantic profiles and full Android/iOS acceptance remain separate.

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

## Link

Link renders one native link on the owned input host with an actual View ref and owned Text for primitive/array/Fragment content. Enter/Space and native activation preserve the original TNativePressEvent record; raw press-in/out retain touch-or-keyboard events. Key/focus callbacks use the native input contracts and focusNativeTarget makes portable requests on the real root. Explicit focusable=false/tabIndex=-1 excludes keyboard admission while retaining independent native activation. href is required and remains verbatim, including empty strings. onPress receives the original native event before one Linking.openURL call; call event.preventDefault() to handle application routing, fragments, relative URLs or any owner veto. isDisabled blocks activation and cancels held gestures. onNavigationError(error, href) reports synchronous and asynchronous failures against their original target/callback; a link without that handler warns, and unmount retires error reporting.

```tsx
import { useState } from "react"
import { Link } from "@codon-ui/react-native"

const Example = () => {
  const [visited, setVisited] = useState(false)
  return (
    <Link
      href="https://example.com"
      order="primary"
      isVisited={visited}
      onPress={() => setVisited(true)}
      onNavigationError={(error, href) => console.warn(href, error)}
      customStyles={{ fontSize: 18 }}
      style={(state) => ({ opacity: state.isDisabled ? 0.4 : 1 })}
    >
      Open destination
    </Link>
  )
}
```

isVisited is caller-owned; URL success never changes it internally. Existing action colors supply 500/600/700 rest/hover/press roles. The default visited400 is the canonical 85% action /15% background mix for native numeric colors; visitedColor can supply an opaque or independent value. Explicit color and custom/final styles override computed state colors. Without an order, foreground inherits the native content context. RGB foreground transitions use 125ms ease-out from the current frame; opaque native colors and pending/unavailable/live Reduce Motion use static colors. Native typography and textDecoration style fields reach owned Text, while authored elements keep their own style ownership.

Computed defaults precede customStyles and final native registered/array/callback style. Style callbacks receive current interaction/visited flags, foregroundColor and post-custom defaultStyle. Native focus uses a 1.5-unit outline with default offset2; enableFocusStyle/offsetFocusRing accept explicit false. The default visible decoration is none, matching the canonical :link rule overriding its underline class; unvisited hover underlines, and explicit native textDecoration or final textDecorationLine controls the line. Native names/labelled-by IDs take precedence over ARIA/camel aliases, retaining empty strings. The owned host accepts ordered native-ID strings through aria-describedby/ariaDescribedBy and aria-details/ariaDetails; native ARIA attributes win over aliases, and an empty attribute clears the relationship. labels.descriptionLabel and labels.detailsLabel localize the existing supplementary iOS captions, including explicit empty captions. An owned tooltip binding may coexist with explicit description IDs; an explicit caption takes precedence over its caption. Native target resolution preserves authored labels, hints and values and follows current same-window targets rather than copying their text into JavaScript. Actual platform metadata and speech require installed evidence.

Core Linking hands the URL to the OS. Browser window/referrer/download behavior, relative/fragment resolution and automatic visited-history lookup are open host mapping decisions; they are not silently implemented by a router. Browser-only props remain rejected at the public boundary. The independent global visited theme role and browser host mappings remain explicit in roadmap 3.5.8. Source/scene/consumer proof does not close installed URL handoff, glyph, motion or accessibility acceptance.

## ThumbnailShowcase

ThumbnailShowcase arranges caller-owned primary and secondary React content. It has all/primary/secondary rendering modes, a required primaryPlaceholder, optional primaryContent, readonly secondaryItems with React id/content, a default four-slot count and delegated placeholder/overflow renderers. Nullish primary content falls back; false,0 and empty string remain authoritative and still count as available media. The secondary row is omitted when no media exists or its normalized count is0. Finite slot counts floor/clamp at0; nonfinite values use4.

```tsx
import { Text, ThumbnailImage, ThumbnailShowcase } from "@codon-ui/react-native"

const Example = () => (
  <ThumbnailShowcase
    width={300}
    primaryContent={
      <ThumbnailImage
        src="file:///cache/primary.png"
        alt="Primary photo"
        style={{ width: "100%", height: "100%" }}
        fallback={<Text>No photo</Text>}
      />
    }
    primaryPlaceholder={<Text>No primary media</Text>}
    secondaryItems={[{ id: 0, content: <Text>First item</Text> }]}
    renderSecondaryPlaceholder={({ index }) => <Text>Empty slot {index}</Text>}
    renderOverflow={({ hiddenItemCount }) => <Text>+{hiddenItemCount}</Text>}
  />
)
```

Overflow replaces the last visible slot when there are more items and a renderer exists. It deliberately retains the canonical hiddenItemCount=items.length-slotCount contract: five items/four slots renders three ordinary items and +1. Returned actions remain caller-owned; the layout adds no button or navigation behavior. Item keys, including0/empty/bigint, retain authored state through reorder, column and ordinary style/theme changes. Mode removal and explicit remount start new content lifetimes. Primitive/array/Fragment content gets native Text wrapping without replacing authored elements.

The root defaults to width100%, column layout and10-unit gap. Primary and secondary owned slots default to full track width, square aspect, minWidth0, clipping and relative positioning. Root style, primarySlotStyle, secondaryRowStyle and secondarySlotStyle are separate native registered/array style owners. Final root style overrides named width; numeric zero stays zero, while padding/borders/gaps still contribute their own box sizes. There is no universal root ref in the canonical/native wrapper; authored content can own native refs, and root native layout/events/identity remain available.

secondaryColumnCount is a positive integer that independently maps the web CSS column-count override; omission follows normalized rendered slot count. A local content-box measurement calculates equal tracks after numeric/percentage column gaps, preserving a flat keyed parent across wrapping changes. Private fractional/cache precision does not rewrite caller values. Measurement updates do not invoke content render callbacks; equivalent parent renders retain valid in-flight measurements, while changed layout contexts retire obsolete callbacks. Native row flow/gap fields apply to the private surface and row box/padding/border/background styles remain on the styled row. Authored slot width changes its visual slot without replacing track allocation.

Arbitrary named/nonuniform/spanning CSS grid, over-constrained/absolute positioning and complete browser/native layout equivalence remain explicit open mappings in roadmap3.5.10. Source styles and renderer tests do not certify actual native grid geometry, clipping, adaptive profiles or accessibility. The maintained Gallery scene composes ThumbnailImage and keyed caller controls with mode/count/column/availability/reorder/width/style/disabled/lifetime controls and native frame readouts. This family adds no media DTO, image loader, hydration behavior, dependency or theme role.

## ThumbnailImage

ThumbnailImage resolves ordered string URI candidates and renders authored fallback content after exhaustion. A nonempty srcCandidates array takes precedence over src; an empty array uses src. Null/undefined/empty entries are removed, exact duplicates collapse and whitespace/order remain meaningful. A nonempty list containing only unusable entries renders fallback even if src exists. Equivalent normalized contents retain private fallback progress through unrelated native/theme/layout updates; changed contents start at index0 immediately. Loading a valid candidate does not display fallback prematurely.

```tsx
import { Text, ThumbnailImage } from "@codon-ui/react-native"

const Example = () => (
  <ThumbnailImage
    srcCandidates={["file:///cache/thumbnail.png", "file:///cache/original.png"]}
    alt="Preview"
    width={120}
    height={80}
    style={{ borderRadius: 5 }}
    fallback={<Text>No thumbnail</Text>}
    onError={(event) => console.warn(event.nativeEvent.error)}
  />
)
```

An active genuine ImageErrorEvent reaches onError before one advancement; a synchronous owner throw prevents that advancement. Retired/duplicate decode attempts cannot skip the current source after replacement or unmount. The renderImage adapter receives alt, src, imageProps and the same onError handler. Its optional-event onError() advances without inventing a caller error payload. Adapters own their actual native refs, geometry and host semantics; there is no universal root ref for arbitrary renderer/fallback content. Native source objects belong inside an adapter, with the owned src removed before using a source override. Primitive/array/Fragment fallback or renderer output receives native Text wrapping while authored keyed elements keep their state.

The default core Image uses real onLoad source metadata for intrinsic geometry. Missing/auto axes follow the decoded ratio, final native style arrays/registered styles and explicit aspect/constraint overrides; authored numeric zero remains zero. Named width/height use standard native numbers, while percentages/auto belong to style. The default resizeMode is stretch (browser fill equivalent), resizeMethod is scale so ordinary URI decoding can precede layout, and Android fadeDuration defaults0. Explicit native controls retain their values. Load/layout callbacks receive their original native payloads; private geometry copies decoded scalars before a caller can mutate an event.

Native srcSet retains pinned core behavior. When responsive sources need a frame before decoding, a component-local getSize preflight seeds implicit geometry using the same crossOrigin/referrerPolicy headers. Metadata failures never advance fallback or fabricate a native error; a minimal private1×1 seed permits the view to deliver its genuine load/error event. Source replacement/unmount retires pending metadata work. Explicit zero axes are never replaced; native zero-size multi-source decoding and browser w/sizes/responsive-density, lazy/decoding/fetch-priority/image-map equivalence remain explicit open capabilities in roadmap3.5.9.

The default alt is Thumbnail image. Empty alt is decorative unless explicit native accessibility/name/label-association props opt in; accessibilityLabel precedes aria-label and alt, retaining empty values and accessible=false. The built-in renderer avoids core alt forcing accessibility back on. An injected renderer owns that decision for its host. The maintained scene uses local valid/invalid PNGs, an explicit renderer, candidate/lifetime resets, zero/final-style/alt controls and actual load/layout receipts. Source checks do not certify installed decoding, responsive choice, geometry or accessibility.

## Avatar

Avatar displays an imageURL after native image loading succeeds and uses name1/name2 initials while loading, on failure or without an image. Anonymous labels default to Name/Unknown; labels can localize those words, including explicit empty strings. Initials preserve the canonical first-character uppercase rule. Image replacement starts a fresh load lifecycle and ignores retired callbacks. The default image mode is contain. Source tests inject native image events; actual decode and rendering remain installed acceptance work.

```tsx
import { Avatar } from "@codon-ui/react-native"

export const Profile = ({ openProfile }: { openProfile: () => void }) => (
  <Avatar name1="Alice" name2="Smith" size={48} clickable onPress={openProfile} />
)
```

Size defaults to 30 and accepts finite nonnegative logical numbers, numeric strings, percentages or auto; zero remains explicit. Three geometries, raised styling, foreground/color alias and background retain their controls with existing theme roles. Foreground defaults to the theme background and the avatar background to the theme foreground. Root computed → customStyles → final style/callback and post-custom defaultStyle apply before color is passed to owned text. customImageStyles, customFallbackStyles and customTextStyles have separate owners. Text customStyles from customTextProps precede customTextStyles, and customTextProps.style remains final. Text scaling stays enabled unless the caller explicitly constrains it.

Only clickable plus onPress enables activation; native disabled guards it and cancels an in-flight press. Passive mode uses a native View so the image remains enabled without acquiring a touch responder; changing mode preserves image/fallback lifetime, and URI changes preserve the actual root ref. One named image/button root owns semantics and the actual View ref, native identity/layout and press payloads. Name precedence is accessibilityLabel → aria-label → resolved full name; accessible=false supports decorative composition. Image/fallback/text remain decorative children. Measured hitSlop follows the existing 44pt/48dp target policy without changing authored geometry; explicit hitSlop and clipped-parent limits remain in effect. DOM classes, asChild and browser click events use the native host/style/onPress boundary.

fallbackDelay controls eligibility once per mounted Avatar lifetime, matching the inherited Radix behavior: omitted delay is immediate; a defined delay, including zero, schedules eligibility. URI/name/theme changes preserve that lifetime. A changed pending delay cancels its old timer; removing it before eligibility leaves the fallback pending until another defined delay or a remount. Eligibility stays true once reached. Unmount cancels work. The maintained Avatar scene provides local valid/invalid PNG data, a deliberate lifetime restart and live controls for these behaviors.

## Tag

Tag is the standalone status/pressable component, distinct from TagGroup's collection item. Static mode renders a native text container with live-region off by default. pressable=true requires caller-owned isPressed and onPress(id); the callback retains numeric 0, string "0", empty string and undefined without creating a selection mirror. A caller may repeatedly decline. Programmatic owner changes still render while disabled, while isDisabled blocks/cancels user activation. aria-pressed can explicitly override the exposed checked state, including false and mixed, without changing the visual owner value.

```tsx
import { useState } from "react"
import { Tag } from "@codon-ui/react-native"

export const Choice = () => {
  const [pressed, setPressed] = useState(false)
  return (
    <Tag pressable id={0} isPressed={pressed} onPress={() => setPressed((value) => !value)}>
      Choice
    </Tag>
  )
}
```

Static color and interactive activeColor/inactiveColor control background. border/activeBorder/inactiveBorder accept none or native borderWidth/borderColor/borderStyle objects. Three geometries, raised/raisedOnHover, native dimensions including zero/percent/auto, focusOutline/outlineOffset and auto/pointer hoverCursor retain their controls. Root computed → customStyles → final style/callback preserves post-custom defaults; native text typography/color fields reach owned content. Authored children retain identity and their own styles. Authored zero dimensions retain native/CSS padding-box minima: default 5-unit padding yields an approximately 10-unit box; use authored zero padding/border for a physical zero box. Native IDs/names/layout/ref payloads remain available; nativeID precedes String(id), and callbacks keep the original typed id. Static mode exposes View events, while press controls/ripple belong to interactive mode. Both modes can observe native pointer hover; static tags create no press responder.

Native backgroundColorTransition accepts milliseconds, an s/ms duration or an object with duration, delay and linear/ease/ease-in/ease-out/ease-in-out. Defaults mirror the canonical bridge: 250ms background/foreground/border colors and 450ms raised shadows. Component-local core Animated transitions stop at current values when interrupted and cancel on removal or Reduce Motion. Unknown/unavailable motion preference stays static. Opaque native colors remain supported and snap rather than inventing unavailable RGB channels. Private compatibility bindings reconcile the pinned RN runtime/declaration differences without changing dependencies.

The curated Tag scene demonstrates exact typed requests, repeated veto, disabled/programmatic updates, exposed-state overrides, static status, geometry/border/palette/native text/final style controls, zero and constrained dimensions, long bilingual labels, timing and reset. Independent global muted-border/transition theme controls, opaque-color interpolation, complex authored shadow transitions and installed intrinsic/nowrap/layout/semantic acceptance remain open; source timing assertions do not certify native frames. Physical pointer/spoken acceptance retains its existing application/device authority.

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

## CircularProgress And Counter

CircularProgress uses the approved native SVG peer with a100×100 viewBox and a native View ref. Required caller value and optional minValue/maxValue drive its clamped arc; circleRatio, counterClockwise, strokeWidth, butt/round/square strokeLineCap, optional background/padding and centered text retain separate controls. The default native root is100×100 logical units; explicit zero/percentage/auto dimensions remain authored. Rendered stroke defaults6 while the canonical radius helper defaults8. Root computed dimensions precede customStyles and final style/state callback; the callback receives percentage/valueText/isIndeterminate and post-custom defaultStyle. Six independent native style owners cover root, SVG, track, path, text and background, with computed dashes taking final precedence.

```tsx
import { CircularProgress, Counter } from "@codon-ui/react-native"

export const Completion = ({ completed }: { completed: number }) => (
  <>
    <CircularProgress
      value={completed}
      aria-label="Completion"
      text={`${completed}%`}
      width={100}
      height={100}
      strokeLineCap="round"
      customPathStyles={{ stroke: "#2f7d18" }}
      customTrackStyles={{ stroke: "#efefef" }}
      customTextStyles={{ fill: "#171717", fontSize: 18 }}
    />
    <Counter
      value={completed}
      maxValue={100}
      showMaxValue
      showProgressIndicator
      warningPercentageThreshold={80}
      errorOrDangerPercentageThreshold={90}
      aria-label="Completed count"
    />
  </>
)
```

Named pathColor/trackColor set SVG color; backgroundColor enables its circle and sets its background color. Canonical explicit stroke/fill defaults still own paint. Use customPathStyles.stroke/customTrackStyles.stroke/customBackgroundStyles.fill or SVG currentColor to choose actual paint. A truthy pathColor suppresses numbered order, preserving the source quirk. Slot paint accepts native colors and SVG none/currentColor, while CSS variables reject. No palette or public theme role changes; the track copies canonical neutral100 defaults privately and remains slot-overridable.

Counter displays its raw string/number value and optional raw max suffix. Optional ring/suffix require a truthy max: numeric0 hides them, string0 retains them. Status converts finite numbers, excludes zero denominators and rounds percentage before danger-first thresholds. customStyles/final style own the root, customTextStyles override status/color text and customProgressIndicatorStyles own the12-unit ring root. Children follow the count and inherit final root foreground. Invalid numeric conversion never rewrites valid display text; only an invalid derived path is omitted at the native drawing boundary. Infinite values retain canonical clamped drawing where defined. Native progress semantics omit invalid numeric fields; isIndeterminate omits current value while keeping canonical value-driven drawing.

valueLabel accepts ReactNode semantic data and never mounts it as visual content. Falsy undefined/null/false/empty/numeric0/bigint0 inputs use locale/formatOptions formatting. A truthy resolved label retains its original identity in JavaScript style-state valueText; its type is ReactNode, so narrow it before calling string methods. Only the native accessibility boundary serializes it: arrays retain canonical comma-separated strings, element/fragment labels become [object Object] and promises become [object Promise]. Those labels are neither rendered nor awaited; visible string text remains a separate SVG owner. Indeterminate state omits both callback valueText and native semantic text. Root native names/labelledBy aliases and actual layout events/refs remain available.350ms dash and125ms inherited color transitions use existing core animation patterns, honor live Reduce Motion and clean up replacement/unmount. Browser description/details/context, CSS empty-child behavior, global muted-role customization and vector text scaling remain required open capabilities. Source/scene/type/consumer checks do not certify installed rendering, baseline, timing or announcements; the roadmap retains those Android/iOS/profile gates.

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

NativeFloatingLayerHost provides an explicit full-size floating-layer container per native window. Mount it around the application surface; its ref is the actual core View, its onLayout receives the original native event and its style supports native View styles. It uses box-none hit handling and unique named native portal hosts. Modal/AlertDialog/Select windows own private local hosts automatically. NativeOverlayProvider still coordinates the existing window chain independently. ClickPopover and NativeDialogTrigger are public source exports; their native rendering, focus, timing and accessibility acceptance remain open.

Host style owns the outer full-size container; put content layout in the child surface's own View. A private background surface lets modal floating layers isolate touches/accessibility without hiding their reparented portal content, while nonmodal layers retain background interaction. System Back and accessibility escape request dismissal of the eligible floating child first and keep window onShow/onDismiss barriers intact. Geometry readiness waits for the actual native window to become active. Source tests verify these policies; actual native routing, reparenting, clipping, accessibility and focus still require installed acceptance with matching identities.

The approved portal peer is exact react-native-teleport1.2.2, which requires fresh linked Android/iOS builds. Its upstream React DOM peer is satisfied by a development-only19.2.3 fixture; Codon's native runtime/peer contract does not include React DOM and native bundles must exclude it. Context/state retention has source-level coverage; clipping escape, native press delivery, renderer lifetimes and focus need actual installed acceptance. Native focus/key feature flags remain unchanged.

Place one NativeOverlayProvider at the application root when using Modal or AlertDialog. Its optional backdropAdapter configures the approved per-window backdrop API. It retains React locations/context while coordinating a single nested window chain; nested providers and simultaneously requested sibling/unrelated branches are rejected. Child windows wait for native parent readiness. Only the active leaf dismisses or runs alert actions. Close the old root before replacement; admitted presentations that close before onShow drain readiness while inactive, then retire before the next root. iOS uses onDismiss and Android a committed hidden-frame barrier, without a portal, global singleton, BackHandler or public registration API. Select optionally joins this scope as an unchanged full-screen leaf and still works standalone.

Modal accepts controlled isOpen/onOpenChange or initial defaultOpen, with ownership fixed for the instance. Supply a nonempty accessibilityLabel/aria-label. Backdrop isDismissable and system/escape isKeyboardDismissDisabled are independent; explicit actions still work with both blocked. A controlled parent may decline requests. Custom children replace the named starter title/body/Close composition; primitive phrases use native Text and authored elements are preserved. A complex starter close label needs closeLabel. View refs, static native dimensions, five orders, rounded/orthogonal geometry and computed → customStyles → style precedence are retained; backdrop/dialog styles are separate owners. Default sizing is bounded to the padded safe window, with internal scrolling; isScrollable=false delegates a bounded custom scroller to the caller.

NativeBackdropHost encloses a complete native window, including its floating host. With an adapter configured, Modal/AlertDialog automatically create separate targets for their own native windows and floating portals; effects receive the retained parent target and exclude their own subtree. Target forwards a real native View ref and all supplied View props. Effect receives targetRef, radius10 in logical units, absolute native style, isPaused and an owner/generation lease. Check lease.isCurrent() before capture and immediately before publishing asynchronous output. Paused effects stop capture and retain their last complete frame. Coverage, native window loss/epoch changes, backgrounding, replacement and unmount retire old work; an attached covered source remains available to descendants. Effects cannot intercept input or expose accessibility descendants. The library supplies no renderer or tint/fallback implicitly. Real palette-neutral blur output, performance and installed Android/iOS acceptance remain required OPEN. Panel remains private while its complete inherited focus/style/motion/blur acceptance is unfinished.

Active-window registry changes now refresh the application floating host directly, so actual dismissal re-enables its scope without an unrelated owner render. Fresh native policy acknowledgement remains required after reactivation. Private Panel construction uses an actual NativeFocusView ref, explicit initialFocusRef/restoreFocusRef and scoped Escape with deepest floating-child priority. Entry requires shown/active presentation, measured layout and native readiness; return requires the native dismissal barrier and a surviving parent/window/target lifetime. Replacement, native epochs, backgrounding, reopen and unmount retire queued requests. Requests do not acknowledge focus. The maintained nonshipping scene retains its held empty editor and refs through live theme/physical-side changes and repeated close vetoes. Complete inherited descendant traversal, focus containment/teardown,350ms style transitions, real blur and installed/profile acceptance remain required OPEN; this construction does not add a public Panel export.

Covered content keeps its instance, local state and native controls. Ordinary closed content unmounts; keep longer-lived drafts outside it. Ancestor closure retires descendants deepest first without invoking business actions. Controlled descendant open values remain caller-owned and may resume after an ancestor returns. Native initial/restore focus refs belong to the expected active owner; pending work cancels with closure, replacement or unmount, and removed targets stay quiet. Accessibility-focus restoration does not deliberately reopen a TextInput keyboard. Each window owns native safe areas and measured keyboard reachability; physical screen-reader/touch/IME behavior still needs device review.

AlertDialog shares that frame with six exported canonical types, required string title/body and optional custom content. Its decorative core-native marks replace SVG. Undefined/null AlertIcon retain the default; custom nodes remain decorative. Ribbon, circle, important heading/body and wrapping nonshrinking actions stay within bounded scrolling rather than a fixed footer. Four grouped label keys keep visible text and accessible names independent; the two legacy visible-text aliases override only visible labels. showCancelAction=false removes cancellation. Active cancel/confirm invokes its callback before requesting closure; synchronous throws prevent that request and promises are not awaited. Backdrop, Back/escape and external closure invoke neither business callback. Product async state and duplicate-mutation prevention remain caller-owned.

The native blur contract accepts omission/false without an adapter. True requires a configured backdropAdapter and a parent-window NativeBackdropHost; an admitted effect with a missing adapter/source throws explicitly. DOM dialogRole, classes/refs/forms, ID associations, portal containers, web trigger/slot/animation props and a screen-reader speech guarantee are excluded. Explicit authored clipping/dimensions retain their ordinary constraints. Four new roles copy unchanged canonical colors: overlayBackdrop rgba(0, 0, 0, 0.3), statusDanger #b73434/#ff6b5f, statusWarning #a66b00/#f0b429 and statusSuccess #2f7d18/#6ad060 (light/dark). Info reuses controlSelectedBackground; status and validation overrides are independent. No dependency is added and all pre-existing defaults remain unchanged.

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

## Carousel

Carousel provides the generic item renderer, initial-index synchronization, both axes and all alignments, looping with short-track fallback, selection callbacks, independent root/viewport/container/item/chrome styles and all five chrome components. Mount the family under the existing NativeFloatingLayerHost. A functional chromeSlot receives the current context and slot="custom"; context includes the original native engine, selection, availability, item IDs and resolved grouped labels. autoPlayEnabled retains the canonical reserved, unused behavior.

```tsx
import { View } from "react-native"
import {
  Carousel,
  CarouselCounter,
  CarouselDots,
  CarouselPrevButton,
  CarouselNextButton,
  Text,
} from "@codon-ui/react-native"

const items = [
  { ID: "first", title: "First" },
  { ID: "second", title: "Second" },
]
const ItemCarousel = () => (
  <Carousel
    items={items}
    style={{ height: 240 }}
    renderCarouselItem={({ item, isSelected }) => (
      <Text>
        {item.title}
        {isSelected ? " (selected)" : ""}
      </Text>
    )}
    chromeSlot={() => (
      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <CarouselPrevButton />
        <CarouselCounter />
        <CarouselDots />
        <CarouselNextButton />
      </View>
    )}
  />
)
```

onViewportRefChange receives the actual native viewport and null on detachment. The component-owned engine ports the pinned Embla8.6.0 scroll math with its MIT notice; it adds no Embla runtime dependency. The complete21-method API,13 events, internal engine, native reInit options and plugins remain available through context.emblaApi. Original native hosts replace DOM nodes. Custom container/slide selections use original-node/style/event/current bindings, and named breakpoints use predicates over the native window state. DOM selectors, browser objects and CSS media-query records are excluded by the native types. Engine cleanup retires observers, plugins, input leases and frames without replacing caller refs.

Viewport keyboard navigation is the default; root targeting, axis arrows and optional Home/End retain the canonical modifier and editable-target rules. Dots provide manual/automatic roving focus, original native keys, checked radio targets, full window/reversal/wrap behavior and optional overflow sentinels. The native item-control association uses the caller's item ID in a named accessibility action which navigates to that item; it does not claim a browser aria-controls property. Passive dots hide their graphics from accessibility. Actual native keyboard/default, focus, gesture arbitration, accessibility relationships/actions, motion, clipping and profile equivalence remain acceptance obligations.

CarouselCounter retains the independent wrapper, Counter and Text style/prop owners and late customCounterProps/customTextProps precedence. Its explicitly approved native paint is a root-local theme surface at75% opacity between the wrapper background and content; browser ancestor-dependent negative-z-index occlusion is not reproduced. Counter description/details ID strings use the existing native relationship binding, and dynamic native colors remain native color values.

### Standalone Close Control

CarouselCloseButton is independently usable. It composes the native Button with round geometry, raised=false, raisedOnHover=true, translucent black background, padding5 and a20-unit current-foreground SVG icon. The grouped labels.closeButtonAriaLabel defaults nullishly to Close Carousel; explicit empty names remain authored.

```tsx
import { CarouselCloseButton } from "@codon-ui/react-native"

const CloseControl = ({ onClose }: { onClose: () => void }) => (
  <CarouselCloseButton
    labels={{ closeButtonAriaLabel: "Close image viewer" }}
    isDisabled={false}
    onPress={onClose}
    customStyles={{ padding: 10 }}
    customButtonProps={{ style: (state) => [state.defaultStyle, { opacity: state.isPressed ? 0.8 : 1 }] }}
  />
)
```

Default props precede outer Button props, then customButtonProps; that inner layer can replace the callback, disabled state, name and final style. customStyles merges default→outer→inner. Explicit children have final ownership: false/0/empty render as authored, null/undefined select the icon and nested customButtonProps.children cannot replace them. Native View refs/events, registered styles, render children, live provider foreground and disabled/pending guards retain the Button contract. DOM classes/styles/refs/events are excluded.

The Text/Button showcase scene retains its independently owned close preview. The separate Carousel scene exercises the whole public family, caller-controlled visibility, collection insertion/removal/reordering, both axes, loop and requested-index changes, manual/passive dots, overlay/direct chrome, an editable child and raw engine commands. Source integration and compiled products do not close the component's native or profile gates.

## Toaster

Toaster and toast expose the native notification family with original typed IDs, payload fields, six positions, labels/constants and separate root/stack/bridge/toast/action styles. Mount it under NativeFloatingLayerHost; publish with toast({ id:0, titleText:"Saved", duration:"persistent" }), and update the same typed ID to replace its payload. Empty IDs, false flags, zero dimensions/durations/gaps and persistent duration remain explicit. Actions receive the current original payload, while keyboard/programmatic retirement adds no invented user-dismiss callback.

The default expansion predicate observes Alt plus physical KeyE, including repeat. Unrestricted string-array predicates retain empty/modifier-only arrays and mapped Event/UIEvent/KeyboardEvent property truthiness. A private per-window observation protocol is independent of consuming key policies and leaves the existing public keyboard/press/focus event shapes unchanged. Standard modifier, repeat, composition, physical code and location data come from native records; logical characters remain separate. Unknown platform mappings stay Unidentified with their acceptance cases open. Private target/view predicates mean actual native target/window presence; defaultPrevented/returnValue predicates mean the existing synchronous native capture disposition. These are native host equivalents, with no fabricated DOM event or editor ref.

Rebuild the consumer native binaries for this owned schema change. Source oracles, compiled mapping tables and both adapter compiler checks do not establish actual passive/default delivery, native focus completion, held editor values, motion, accessibility or profile/rendering acceptance. The ledger tracks those obligations separately.

## DateTimePicker and DateTimeRangePicker

The date pickers expose native segmented inputs and a locale-ordered calendar through the public package entry. Their source integration keeps installed input, focus timing, pointer/scroll behavior, accessibility and device-profile acceptance open in the component-library roadmap.

Values use the pinned @internationalized/date3.12.1 date classes. Calendar selection retains CalendarDate, CalendarDateTime or ZonedDateTime values, original calendars and time zones, and independent range endpoint times. Controlled owners may retain a value to decline a request; null controls an empty picker. Incomplete endpoint drafts remain separate from a complete range request.

```tsx
import { CalendarDateTime } from "@internationalized/date"
import { useState } from "react"
import {
  DateTimePicker,
  DateTimeRangePicker,
  NativeFloatingLayerHost,
  NativeLocaleProvider,
} from "@codon-ui/react-native"

const Dates = () => {
  const [value, setValue] = useState<CalendarDateTime | null>(new CalendarDateTime(2024, 11, 1, 13, 45))
  return (
    <NativeFloatingLayerHost>
      <NativeLocaleProvider locale="en-US">
        <DateTimePicker accessibilityLabel="Appointment" value={value} onChange={setValue} name="appointment" />
        <DateTimeRangePicker accessibilityLabel="Interval" startName="date" endName="date" />
      </NativeLocaleProvider>
    </NativeFloatingLayerHost>
  )
}
```

Single pickers show two months by default; range pickers show one. Both default to narrow weekdays, a24-hour cycle and leading zeros. multiMonth, dayLength, firstDayOfWeek, pageBehavior, minValue/maxValue and isDateUnavailable retain their distinct calendar behavior. allowsNonContiguousRanges controls whether a range can span unavailable days. NativeLocaleProvider drives locale/calendar formatting and direction; the host owns Intl support.

The calendar supports day/week arrows, Home/End, month/year paging and Enter/Space selection. Alt+Arrow opens from the original field group. Range interactions include anchor/highlight/commit, reverse selection, existing-boundary dragging and the source200ms touch-versus-scroll delay. Original native window/day registrations admit physical pointer work; a requested focus remains separate from native focus observation. Platform acceptance of those paths is still required.

NativeDatePickerContext and NativeDateRangePickerContext provide base picker props, refs and named/default/null slots. NativeDatePickerStateContext and NativeDateRangePickerStateContext expose the corresponding complete logical state. Wrapper appearance is calibrated before those base contexts, matching the source precedence. Root render callbacks must preserve the supplied original ref, host props and generated children; NativeFocusView is the corresponding native root.

Every input/button/group/popover/dialog/calendar/header/navigation/grid/header-cell/body/day style owner is independent. Root style callbacks receive focus/visibility, open/disabled/readonly/required/invalid flags and state. NativeForm submits exact DateValue.toString entries: one named date, or ordered startName/endName entries with duplicates retained. Disabled fields are excluded, readonly values remain included, and reset/custom/server/required validation shares the existing original segmented-field receiver.

The maintained DatePickerFixture under packages/react-native/src/date/picker/**tests**/fixtures exercises the public components with owner vetoes, three value classes, DST/zone values, RTL/non-Gregorian locales, a large-text fixture, form actions, range rules, original refs and a held-empty caller editor. These source examples do not replace native qualification.
