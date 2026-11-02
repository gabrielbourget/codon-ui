import { createRef } from "react"
import { StyleSheet, type View } from "react-native"

import {
  toast,
  Toaster,
  type TNativeToast,
  type PartialToastLabels,
  TOAST_POSITION__TOP_RIGHT,
  TOAST_TYPE__INFO,
} from "../src"

const styles = StyleSheet.create({ root: { marginTop: 2 }, text: { color: "blue" } })
const accepted = (
  <Toaster
    ref={createRef<View>()}
    offset={0}
    maxVisibleToasts={0}
    toastGap={0}
    customRootStyles={[styles.root, false]}
    toastLabels={{ closeButtonAriaLabel: "" }}
    ariaLabelledBy="heading"
    ariaDescribedBy="summary"
    ariaDetails="details"
    labels={{ descriptionLabel: "Résumé" }}
  />
)
const payload: TNativeToast = {
  id: 0,
  duration: 0,
  important: false,
  raised: false,
  dismissable: false,
  titleText: "",
  showButtons: false,
  customBodyTextStyles: styles.text,
  customStyles: { width: "50%", color: "blue" },
}
const publishEmpty = () => toast({ ...payload, id: "" })
// @ts-expect-error DOM classes have a native style equivalent rather than a silently ignored prop.
const domClass = <Toaster className="web" />
// @ts-expect-error Native offsets use logical units.
const cssOffset = <Toaster offset="15px" />
// @ts-expect-error No uncontrolled mirror of the published queue is accepted.
const mirroredQueue = <Toaster defaultToasts={[]} />
// @ts-expect-error Native dimensions reject CSS rem strings.
const cssToast: TNativeToast = { id: "", width: "20rem" }
const domEvent: TNativeToast = {
  id: 0,
  // @ts-expect-error Existing Button events remain native events.
  customCloseButtonProps: { onPress: (event: { clientX: number }) => event.clientX },
}

void [accepted, publishEmpty, domClass, cssOffset, mirroredQueue, cssToast, domEvent]

const unrestricted = (
  <Toaster expandToggleHotkey={[]} dismissalHotkey={["constructor", "repeat"]} position={TOAST_POSITION__TOP_RIGHT} />
)
const labels: PartialToastLabels = { closeButtonAriaLabel: "" }
const typed: TNativeToast = { id: "", type: TOAST_TYPE__INFO, labels }
void [unrestricted, typed]

export const AuthoredToasterTouchCapture = (
  <Toaster
    onTouchStartCapture={(event) => {
      event.persist()
      const identifier: string = event.nativeEvent.identifier
      void identifier
    }}
  />
)
export const InvalidBrowserToasterTouchCapture = (
  // @ts-expect-error Root touch capture receives the original native touch event, not a browser touch-list wrapper.
  <Toaster onTouchStartCapture={(_event: { changedTouches: unknown[] }) => undefined} />
)

export const StockToasterRootEvents = (
  <Toaster
    onTouchMoveCapture={(event) => event.persist()}
    onTouchCancelCapture={(event) => event.persist()}
    onClick={(event) => {
      event.persist()
      // @ts-expect-error A stock Android native click may carry an empty payload, so touch lists are not promised.
      const touches: unknown[] = event.nativeEvent.changedTouches
      void touches
      if ("pointerType" in event.nativeEvent && typeof event.nativeEvent.pointerType === "string") {
        const type: string = event.nativeEvent.pointerType
        void type
      }
    }}
    onClickCapture={(event) => event.persist()}
    onPointerOver={(event) => {
      const type: string = event.nativeEvent.pointerType
      void type
    }}
    onPointerOverCapture={(event) => event.persist()}
    onPointerOut={(event) => event.persist()}
    onPointerOutCapture={(event) => event.persist()}
    onGotPointerCapture={(event) => {
      const id: number = event.nativeEvent.pointerId
      void id
    }}
    onGotPointerCaptureCapture={(event) => event.persist()}
    onLostPointerCapture={(event) => event.persist()}
    onLostPointerCaptureCapture={(event) => event.persist()}
  />
)

export const OriginalToasterRootFocus = (
  <Toaster
    onFocus={(event) => {
      event.persist()
      const target: number = event.nativeEvent.target
      // @ts-expect-error Root bubbling focus is the original stock event, not a direct CUI owner acknowledgment.
      const owner: string = event.nativeEvent.ownerId
      void [target, owner]
    }}
    onBlur={(event) => event.persist()}
    onFocusCapture={(event) => event.persist()}
    onBlurCapture={(event) => event.persist()}
  />
)

export const OriginalToasterRootKeys = (
  <Toaster
    onKeyDownCapture={(event) => event.persist()}
    onKeyDown={(event) => {
      const key: string = event.nativeEvent.key
      const measure = event.currentTarget.measure
      // @ts-expect-error Root key observers receive native payloads, not a browser keyCode facade.
      const legacy: number = event.keyCode
      void [key, measure, legacy]
    }}
    onKeyUpCapture={(event) => event.persist()}
    onKeyUp={(event) => event.persist()}
  />
)

const approvedUnsupportedToasterRootFields = [
  "translate",
  "inert",
  "onAuxClick",
  "onAuxClickCapture",
  "onContextMenu",
  "onContextMenuCapture",
  "onDoubleClick",
  "onDoubleClickCapture",
  "onWheel",
  "onWheelCapture",
  "onScroll",
  "onScrollCapture",
  "onScrollEnd",
  "onScrollEndCapture",
  "defaultChecked",
  "defaultValue",
  "autoCapitalize",
  "contentEditable",
  "enterKeyHint",
  "spellCheck",
  "autoCorrect",
  "unselectable",
  "inputMode",
  "onCopy",
  "onCopyCapture",
  "onCut",
  "onCutCapture",
  "onPaste",
  "onPasteCapture",
  "onCompositionEnd",
  "onCompositionEndCapture",
  "onCompositionStart",
  "onCompositionStartCapture",
  "onCompositionUpdate",
  "onCompositionUpdateCapture",
  "onChange",
  "onChangeCapture",
  "onBeforeInput",
  "onBeforeInputCapture",
  "onInput",
  "onInputCapture",
  "onReset",
  "onResetCapture",
  "onSubmit",
  "onSubmitCapture",
  "onInvalid",
  "onInvalidCapture",
  "onLoad",
  "onLoadCapture",
  "onError",
  "onErrorCapture",
  "onAbort",
  "onAbortCapture",
  "onCanPlay",
  "onCanPlayCapture",
  "onCanPlayThrough",
  "onCanPlayThroughCapture",
  "onDurationChange",
  "onDurationChangeCapture",
  "onEmptied",
  "onEmptiedCapture",
  "onEncrypted",
  "onEncryptedCapture",
  "onEnded",
  "onEndedCapture",
  "onLoadedData",
  "onLoadedDataCapture",
  "onLoadedMetadata",
  "onLoadedMetadataCapture",
  "onLoadStart",
  "onLoadStartCapture",
  "onPause",
  "onPauseCapture",
  "onPlay",
  "onPlayCapture",
  "onPlaying",
  "onPlayingCapture",
  "onProgress",
  "onProgressCapture",
  "onRateChange",
  "onRateChangeCapture",
  "onSeeked",
  "onSeekedCapture",
  "onSeeking",
  "onSeekingCapture",
  "onStalled",
  "onStalledCapture",
  "onSuspend",
  "onSuspendCapture",
  "onTimeUpdate",
  "onTimeUpdateCapture",
  "onVolumeChange",
  "onVolumeChangeCapture",
  "onWaiting",
  "onWaitingCapture",
  "onSelect",
  "onSelectCapture",
  "aria-activedescendant",
  "aria-atomic",
  "aria-autocomplete",
  "aria-braillelabel",
  "aria-brailleroledescription",
  "aria-colcount",
  "aria-colindex",
  "aria-colindextext",
  "aria-colspan",
  "aria-controls",
  "aria-current",
  "aria-description",
  "aria-errormessage",
  "aria-flowto",
  "aria-haspopup",
  "aria-invalid",
  "aria-keyshortcuts",
  "aria-level",
  "aria-multiline",
  "aria-multiselectable",
  "aria-orientation",
  "aria-owns",
  "aria-placeholder",
  "aria-posinset",
  "aria-pressed",
  "aria-readonly",
  "aria-relevant",
  "aria-required",
  "aria-roledescription",
  "aria-rowcount",
  "aria-rowindex",
  "aria-rowindextext",
  "aria-rowspan",
  "aria-setsize",
  "aria-sort",
  "contextMenu",
  "popover",
  "popoverTargetAction",
  "popoverTarget",
  "onAnimationStart",
  "onAnimationStartCapture",
  "onAnimationEnd",
  "onAnimationEndCapture",
  "onAnimationIteration",
  "onAnimationIterationCapture",
  "onToggle",
  "onBeforeToggle",
  "onTransitionCancel",
  "onTransitionCancelCapture",
  "onTransitionEnd",
  "onTransitionEndCapture",
  "onTransitionRun",
  "onTransitionRunCapture",
  "onTransitionStart",
  "onTransitionStartCapture",
  "suppressContentEditableWarning",
  "suppressHydrationWarning",
  "nonce",
  "slot",
  "radioGroup",
  "about",
  "content",
  "datatype",
  "inlist",
  "prefix",
  "property",
  "rel",
  "resource",
  "rev",
  "typeof",
  "vocab",
  "autoSave",
  "color",
  "itemProp",
  "itemScope",
  "itemType",
  "itemID",
  "itemRef",
  "results",
  "security",
  "is",
  "exportparts",
  "part",
  "dir",
  "hidden",
  "lang",
  "title",
  "accessKey",
  "autoFocus",
  "onKeyPress",
  "onKeyPressCapture",
  "draggable",
  "aria-dropeffect",
  "aria-grabbed",
  "onDrag",
  "onDragCapture",
  "onDragEnd",
  "onDragEndCapture",
  "onDragEnter",
  "onDragEnterCapture",
  "onDragExit",
  "onDragExitCapture",
  "onDragLeave",
  "onDragLeaveCapture",
  "onDragOver",
  "onDragOverCapture",
  "onDragStart",
  "onDragStartCapture",
  "onDrop",
  "onDropCapture",
] as const
void approvedUnsupportedToasterRootFields

type TApprovedUnsupportedToasterRootField = (typeof approvedUnsupportedToasterRootFields)[number]
type TAssertToasterBoundary<T extends true> = T
type TNativeToasterProps = import("../src").TNativeToasterProps
export type TEveryApprovedToasterBoundaryExists = TAssertToasterBoundary<
  Exclude<TApprovedUnsupportedToasterRootField, keyof TNativeToasterProps> extends never ? true : false
>
export type TEveryApprovedToasterBoundaryRejectsValues = TAssertToasterBoundary<
  {
    [K in TApprovedUnsupportedToasterRootField]: NonNullable<TNativeToasterProps[K]> extends never ? true : false
  }[TApprovedUnsupportedToasterRootField] extends true
    ? true
    : false
>

export const NativeToasterRegionAndCommonAccessibility = (
  <Toaster
    labels={{ regionRoleDescription: "Region locale", descriptionLabel: "Description", detailsLabel: "Details" }}
    role="region"
    ariaLabel="Updates"
    ariaDescribedBy="description"
    ariaDetails="details"
    accessibilityState={{ selected: true }}
    accessibilityValue={{ text: "Ready" }}
    accessibilityActions={[{ name: "activate", label: "Inspect" }]}
    onAccessibilityAction={(event) => event.persist()}
    aria-live="polite"
  />
)

const rejectedToasterInert = { inert: true }
export const InvalidToasterInertSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterInert} />
)

const rejectedToasterScroll = { onScroll: () => undefined }
export const InvalidToasterScrollSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterScroll} />
)

const rejectedToasterEditor = { contentEditable: true }
export const InvalidToasterEditorSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterEditor} />
)

const rejectedToasterClipboard = { onCopy: () => undefined }
export const InvalidToasterClipboardSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterClipboard} />
)

const rejectedToasterMedia = { onLoad: () => undefined }
export const InvalidToasterMediaSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterMedia} />
)

const rejectedToasterVirtualFocus = { "aria-activedescendant": "row" }
export const InvalidToasterVirtualFocusSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterVirtualFocus} />
)

const rejectedToasterCollectionCoordinates = { "aria-rowcount": 4 }
export const InvalidToasterCollectionCoordinatesSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterCollectionCoordinates} />
)

const rejectedToasterUnmappedWidgetState = { "aria-invalid": true }
export const InvalidToasterUnmappedWidgetStateSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterUnmappedWidgetState} />
)

const rejectedToasterExtraDescription = { "aria-description": "More" }
export const InvalidToasterExtraDescriptionSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterExtraDescription} />
)

const rejectedToasterBraille = { "aria-braillelabel": "Braille" }
export const InvalidToasterBrailleSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterBraille} />
)

const rejectedToasterAnnouncementPolicy = { "aria-atomic": true }
export const InvalidToasterAnnouncementPolicySpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterAnnouncementPolicy} />
)

const rejectedToasterCSS = { onAnimationEnd: () => undefined }
export const InvalidToasterCSSSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterCSS} />
)

const rejectedToasterMetadata = { itemScope: true }
export const InvalidToasterMetadataSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterMetadata} />
)

const rejectedToasterPresentation = { title: "Help" }
export const InvalidToasterPresentationSpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterPresentation} />
)

const rejectedToasterBrowserKey = { accessKey: "a" }
export const InvalidToasterBrowserKeySpread = (
  // @ts-expect-error Explicitly approved native Toaster root boundary also rejects object spreads.
  <Toaster {...rejectedToasterBrowserKey} />
)

export const InvalidToasterRegionRoleLabel = (
  // @ts-expect-error The localized region role description remains a string caption.
  <Toaster labels={{ regionRoleDescription: 3 }} />
)

const rejectedToasterSystemDraggable = { draggable: true }
export const InvalidToasterSystemDraggableSpread = (
  // @ts-expect-error Exact Toaster-root system drag boundary rejects this prop through a spread.
  <Toaster {...rejectedToasterSystemDraggable} />
)

const rejectedToasterSourceDrag = { onDragStart: () => undefined }
export const InvalidToasterSourceDragSpread = (
  // @ts-expect-error Exact Toaster-root system drag boundary rejects this prop through a spread.
  <Toaster {...rejectedToasterSourceDrag} />
)

const rejectedToasterDropCapture = { onDropCapture: () => undefined }
export const InvalidToasterDropCaptureSpread = (
  // @ts-expect-error Exact Toaster-root system drag boundary rejects this prop through a spread.
  <Toaster {...rejectedToasterDropCapture} />
)

const rejectedToasterGrabbedMetadata = { "aria-grabbed": true }
export const InvalidToasterGrabbedMetadataSpread = (
  // @ts-expect-error Exact Toaster-root system drag boundary rejects this prop through a spread.
  <Toaster {...rejectedToasterGrabbedMetadata} />
)

const rejectedToasterDropEffectMetadata = { "aria-dropeffect": "copy" }
export const InvalidToasterDropEffectMetadataSpread = (
  // @ts-expect-error Exact Toaster-root system drag boundary rejects this prop through a spread.
  <Toaster {...rejectedToasterDropEffectMetadata} />
)
