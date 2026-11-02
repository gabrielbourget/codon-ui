import { createRef } from "react"
import { Animated, PlatformColor, type View, type PointerEvent, type NativeSyntheticEvent } from "react-native"

import { NativeThemeProvider, ToggleSwitcher, type ToggleSwitcherItem, type ToggleSwitcherProps } from "../src"

const items: readonly ToggleSwitcherItem[] = [
  { id: "", label: "Empty key" },
  { id: "next", label: "Next", disabled: false, accessibilityLabel: "Next option" },
]
export const props: ToggleSwitcherProps = {
  items,
  selectedKey: "",
  defaultSelectedKey: "next",
  onSelectionChange: (key: string) => key,
  isDisabled: false,
  isReadOnly: false,
  width: "100%",
  height: 0,
  fontSize: 0,
  color: PlatformColor("systemBlueColor"),
  optionFontWeight: "lighter",
  selectedOptionFontWeight: "bolder",
  customOptionStyles: [{ minHeight: 32, color: "teal", fontSize: 14, textTransform: "uppercase" }],
  customSelectedOptionStyles: { fontWeight: "800", borderRadius: 5, width: new Animated.Value(80) },
  style: ({ defaultStyle, selectedKey }) => [defaultStyle, { opacity: selectedKey === "" ? 1 : 0.5 }],
}
export const Valid = <ToggleSwitcher {...props} ref={createRef<View>()} />
// @ts-expect-error The selection key retains its string identity.
export const InvalidKey = <ToggleSwitcher items={items} selectedKey={0} />
// @ts-expect-error null is not a string-key selection state.
export const InvalidNull = <ToggleSwitcher items={items} selectedKey={null} />
// @ts-expect-error Items have string IDs, not numeric keys.
export const InvalidItem = <ToggleSwitcher items={[{ id: 0, label: "Zero" }]} />
// @ts-expect-error Static shorthand dimensions exclude animated nodes.
export const InvalidAnimatedWidth = <ToggleSwitcher items={items} width={new Animated.Value(80)} />
// @ts-expect-error Static shorthand dimensions exclude null.
export const InvalidNullHeight = <ToggleSwitcher items={items} height={null} />
// @ts-expect-error CSS dimensions use native logical units or percentages.
export const InvalidWidth = <ToggleSwitcher items={items} width="12rem" />
// @ts-expect-error Font size is a native number.
export const InvalidFontSize = <ToggleSwitcher items={items} fontSize="14px" />
// @ts-expect-error Arbitrary weight aliases are unsupported.
export const InvalidWeight = <ToggleSwitcher items={items} optionFontWeight="heavy" />
// @ts-expect-error Native root semantics are owned.
export const InvalidRole = <ToggleSwitcher items={items} role="radio" />
// @ts-expect-error DOM classes are represented by native style slots.
export const InvalidClass = <ToggleSwitcher items={items} customOptionClassName="web" />
// @ts-expect-error The collection owns its visual children.
export const InvalidChildren = <ToggleSwitcher items={items}>Child</ToggleSwitcher>
// @ts-expect-error The root ref is a native View.
export const InvalidRef = <ToggleSwitcher items={items} ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Selection callbacks publish the exact string key.
export const InvalidCallback = <ToggleSwitcher items={items} onSelectionChange={(key: number) => key} />

export const StockSwitcherCallbacks = (
  pointer: PointerEvent,
  activation: NativeSyntheticEvent<Record<never, never>>,
) => {
  const click: NonNullable<ToggleSwitcherProps["onClick"]> = (event) => {
    event.persist()
    // @ts-expect-error Native Android focusable-host click does not guarantee pointer coordinates.
    const guaranteedPointer: PointerEvent = event
    void guaranteedPointer
    // @ts-expect-error Stock click carries no guaranteed touch identifier.
    void event.nativeEvent.identifier
  }
  click(pointer)
  click(activation)
  const props: ToggleSwitcherProps = {
    items,
    onFocusCapture: (event) => event.persist(),
    onBlurCapture: (event) => event.persist(),
    onClick: click,
    onClickCapture: click,
    onPointerOver: (event) => event.persist(),
    onPointerOverCapture: (event) => event.persist(),
    onPointerOut: (event) => event.persist(),
    onPointerOutCapture: (event) => event.persist(),
    onGotPointerCapture: (event) => event.persist(),
    onGotPointerCaptureCapture: (event) => event.persist(),
    onLostPointerCapture: (event) => event.persist(),
    onLostPointerCaptureCapture: (event) => event.persist(),
    onTouchStartCapture: (event) => event.persist(),
    onTouchMoveCapture: (event) => event.persist(),
    onTouchCancelCapture: (event) => event.persist(),
  }
  return <ToggleSwitcher {...props} />
}

export const ApprovedMutedSwitcherSurface = (
  <NativeThemeProvider overrides={{ colors: { surfaceMuted: PlatformColor("systemGray6") } }}>
    <ToggleSwitcher items={items} />
  </NativeThemeProvider>
)
// @ts-expect-error The approved muted surface accepts native ColorValue, not a boolean.
export const InvalidMutedSwitcherSurface = <NativeThemeProvider overrides={{ colors: { surfaceMuted: false } }} />

export const OriginalSwitcherRootKeys = (
  <ToggleSwitcher
    items={items}
    onKeyDownCapture={(event) => {
      event.persist()
      const composing: boolean = event.nativeEvent.isComposing
      const original: View = event.target
      const root: View = event.currentTarget
      void [composing, original, root]
    }}
    onKeyDown={(event) => event.preventDefault()}
    onKeyUpCapture={(event) => event.persist()}
    onKeyUp={(event) => event.persist()}
  />
)

// Shared native View-root boundary approved for this verification batch.
type TApprovedGenericRootKey =
  | "translate"
  | "inert"
  | "onAuxClick"
  | "onAuxClickCapture"
  | "onContextMenu"
  | "onContextMenuCapture"
  | "onDoubleClick"
  | "onDoubleClickCapture"
  | "onWheel"
  | "onWheelCapture"
  | "onScroll"
  | "onScrollCapture"
  | "onScrollEnd"
  | "onScrollEndCapture"
  | "defaultChecked"
  | "defaultValue"
  | "autoCapitalize"
  | "contentEditable"
  | "enterKeyHint"
  | "spellCheck"
  | "autoCorrect"
  | "unselectable"
  | "inputMode"
  | "onCopy"
  | "onCopyCapture"
  | "onCut"
  | "onCutCapture"
  | "onPaste"
  | "onPasteCapture"
  | "onCompositionEnd"
  | "onCompositionEndCapture"
  | "onCompositionStart"
  | "onCompositionStartCapture"
  | "onCompositionUpdate"
  | "onCompositionUpdateCapture"
  | "onChange"
  | "onChangeCapture"
  | "onBeforeInput"
  | "onBeforeInputCapture"
  | "onInput"
  | "onInputCapture"
  | "onReset"
  | "onResetCapture"
  | "onSubmit"
  | "onSubmitCapture"
  | "onInvalid"
  | "onInvalidCapture"
  | "onLoad"
  | "onLoadCapture"
  | "onError"
  | "onErrorCapture"
  | "onAbort"
  | "onAbortCapture"
  | "onCanPlay"
  | "onCanPlayCapture"
  | "onCanPlayThrough"
  | "onCanPlayThroughCapture"
  | "onDurationChange"
  | "onDurationChangeCapture"
  | "onEmptied"
  | "onEmptiedCapture"
  | "onEncrypted"
  | "onEncryptedCapture"
  | "onEnded"
  | "onEndedCapture"
  | "onLoadedData"
  | "onLoadedDataCapture"
  | "onLoadedMetadata"
  | "onLoadedMetadataCapture"
  | "onLoadStart"
  | "onLoadStartCapture"
  | "onPause"
  | "onPauseCapture"
  | "onPlay"
  | "onPlayCapture"
  | "onPlaying"
  | "onPlayingCapture"
  | "onProgress"
  | "onProgressCapture"
  | "onRateChange"
  | "onRateChangeCapture"
  | "onSeeked"
  | "onSeekedCapture"
  | "onSeeking"
  | "onSeekingCapture"
  | "onStalled"
  | "onStalledCapture"
  | "onSuspend"
  | "onSuspendCapture"
  | "onTimeUpdate"
  | "onTimeUpdateCapture"
  | "onVolumeChange"
  | "onVolumeChangeCapture"
  | "onWaiting"
  | "onWaitingCapture"
  | "onSelect"
  | "onSelectCapture"
  | "aria-activedescendant"
  | "aria-atomic"
  | "aria-autocomplete"
  | "aria-braillelabel"
  | "aria-brailleroledescription"
  | "aria-colcount"
  | "aria-colindex"
  | "aria-colindextext"
  | "aria-colspan"
  | "aria-controls"
  | "aria-current"
  | "aria-description"
  | "aria-errormessage"
  | "aria-flowto"
  | "aria-haspopup"
  | "aria-invalid"
  | "aria-keyshortcuts"
  | "aria-level"
  | "aria-multiline"
  | "aria-multiselectable"
  | "aria-orientation"
  | "aria-owns"
  | "aria-placeholder"
  | "aria-posinset"
  | "aria-pressed"
  | "aria-readonly"
  | "aria-relevant"
  | "aria-required"
  | "aria-roledescription"
  | "aria-rowcount"
  | "aria-rowindex"
  | "aria-rowindextext"
  | "aria-rowspan"
  | "aria-setsize"
  | "aria-sort"
  | "contextMenu"
  | "popover"
  | "popoverTargetAction"
  | "popoverTarget"
  | "onAnimationStart"
  | "onAnimationStartCapture"
  | "onAnimationEnd"
  | "onAnimationEndCapture"
  | "onAnimationIteration"
  | "onAnimationIterationCapture"
  | "onToggle"
  | "onBeforeToggle"
  | "onTransitionCancel"
  | "onTransitionCancelCapture"
  | "onTransitionEnd"
  | "onTransitionEndCapture"
  | "onTransitionRun"
  | "onTransitionRunCapture"
  | "onTransitionStart"
  | "onTransitionStartCapture"
  | "suppressContentEditableWarning"
  | "suppressHydrationWarning"
  | "nonce"
  | "slot"
  | "radioGroup"
  | "about"
  | "content"
  | "datatype"
  | "inlist"
  | "prefix"
  | "property"
  | "rel"
  | "resource"
  | "rev"
  | "typeof"
  | "vocab"
  | "autoSave"
  | "itemProp"
  | "itemScope"
  | "itemType"
  | "itemID"
  | "itemRef"
  | "results"
  | "security"
  | "is"
  | "exportparts"
  | "part"
  | "dir"
  | "hidden"
  | "lang"
  | "title"
  | "accessKey"
  | "autoFocus"
  | "onKeyPress"
  | "onKeyPressCapture"
  | "dangerouslySetInnerHTML"
  | "draggable"
  | "aria-grabbed"
  | "aria-dropeffect"
  | "onDrag"
  | "onDragCapture"
  | "onDragStart"
  | "onDragStartCapture"
  | "onDragEnd"
  | "onDragEndCapture"
  | "onDragEnter"
  | "onDragEnterCapture"
  | "onDragExit"
  | "onDragExitCapture"
  | "onDragLeave"
  | "onDragLeaveCapture"
  | "onDragOver"
  | "onDragOverCapture"
  | "onDrop"
  | "onDropCapture"
type TExistingProtectedRootKey =
  | "children"
  | "accessible"
  | "role"
  | "accessibilityRole"
  | "accessibilityState"
  | "aria-disabled"
  | "aria-checked"
  | "aria-selected"
  | "className"
  | "customClassName"
  | "customOptionClassName"
  | "customSelectedOptionClassName"
type TAssertNativeRootContract<T extends true> = T
type TRejectedRootResult<K extends PropertyKey> = K extends keyof ToggleSwitcherProps
  ? [Exclude<ToggleSwitcherProps[K], undefined>] extends [never]
    ? true
    : false
  : false
export type ApprovedGenericRootFieldsRejected = TAssertNativeRootContract<
  Exclude<TRejectedRootResult<TApprovedGenericRootKey>, true> extends never ? true : false
>
export type ExistingProtectedRootFieldsRejected = TAssertNativeRootContract<
  Exclude<TRejectedRootResult<TExistingProtectedRootKey>, true> extends never ? true : false
>
const rejectedInert = { items, inert: true }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedInertSpread = <ToggleSwitcher {...rejectedInert} />
const rejectedMenu = { items, onContextMenu: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedMenuSpread = <ToggleSwitcher {...rejectedMenu} />
const rejectedEditing = { items, contentEditable: true }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedEditingSpread = <ToggleSwitcher {...rejectedEditing} />
const rejectedComposition = { items, onCompositionEnd: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedCompositionSpread = <ToggleSwitcher {...rejectedComposition} />
const rejectedCSS = { items, onTransitionEnd: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedCSSSpread = <ToggleSwitcher {...rejectedCSS} />
const rejectedMedia = { items, onCanPlay: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedMediaSpread = <ToggleSwitcher {...rejectedMedia} />
const rejectedMetadata = { items, itemProp: "browser" }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedMetadataSpread = <ToggleSwitcher {...rejectedMetadata} />
const rejectedAdvancedARIA = { items, "aria-activedescendant": "other" }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedAdvancedARIASpread = <ToggleSwitcher {...rejectedAdvancedARIA} />
const rejectedScroll = { items, onScroll: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedScrollSpread = <ToggleSwitcher {...rejectedScroll} />
const rejectedLegacyKeypress = { items, onKeyPress: () => undefined }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedLegacyKeypressSpread = <ToggleSwitcher {...rejectedLegacyKeypress} />
const rejectedOwnedRole = { items, role: "radio" }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedOwnedRoleSpread = <ToggleSwitcher {...rejectedOwnedRole} />
const rejectedCSSClass = { items, customClassName: "browser" }
// @ts-expect-error Unsupported/protected root protocols remain rejected through object spreads.
export const RejectedCSSClassSpread = <ToggleSwitcher {...rejectedCSSClass} />
export const NativeRootRelationships = (
  <ToggleSwitcher
    items={items}
    aria-describedby="hint other"
    aria-details="details"
    aria-live="polite"
    accessibilityHint="Native hint"
    isReadOnly
    color={PlatformColor("systemBlueColor")}
  />
)

const rejectedGenericRootDrag = { items, draggable: true, onDragStart: () => undefined, "aria-grabbed": true }
// @ts-expect-error Generic HTML root drag protocols do not become native drag features through spreads.
export const RejectedGenericRootDragSpread = <ToggleSwitcher {...rejectedGenericRootDrag} />
export const NativeModalMetadata = <ToggleSwitcher items={items} aria-modal accessibilityViewIsModal={false} />
