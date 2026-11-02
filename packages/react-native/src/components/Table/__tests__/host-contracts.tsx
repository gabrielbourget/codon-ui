import { createRef, type ComponentProps, type TouchEvent } from "react"
import { View, type NativeSyntheticEvent, type PointerEvent, type ViewProps } from "react-native"

import { NativeFocusView, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "../../.."
import { NativeTablePropsContext } from "../context"

type TCaptureProps = {
  onTouchStartCapture?: ViewProps["onTouchStart"]
  onTouchMoveCapture?: ViewProps["onTouchMove"]
  onTouchCancelCapture?: ViewProps["onTouchCancel"]
}
const capture: NonNullable<ViewProps["onTouchStart"]> = (event) => {
  const originalTarget = event.nativeEvent.target
  void originalTarget
}
type TPointerProps = {
  onPointerOver?: ViewProps["onPointerDown"]
  onPointerOverCapture?: ViewProps["onPointerDown"]
  onPointerOut?: ViewProps["onPointerDown"]
  onPointerOutCapture?: ViewProps["onPointerDown"]
  onGotPointerCapture?: ViewProps["onPointerDown"]
  onGotPointerCaptureCapture?: ViewProps["onPointerDown"]
  onLostPointerCapture?: ViewProps["onPointerDown"]
  onLostPointerCaptureCapture?: ViewProps["onPointerDown"]
}
const pointer: NonNullable<ViewProps["onPointerDown"]> = (event) => {
  void event.nativeEvent.pointerType
}
const readPointers = (host: TPointerProps) => {
  const over: ViewProps["onPointerDown"] = host.onPointerOver
  const overCapture: ViewProps["onPointerDown"] = host.onPointerOverCapture
  const out: ViewProps["onPointerDown"] = host.onPointerOut
  const outCapture: ViewProps["onPointerDown"] = host.onPointerOutCapture
  const got: ViewProps["onPointerDown"] = host.onGotPointerCapture
  const gotCapture: ViewProps["onPointerDown"] = host.onGotPointerCaptureCapture
  const lost: ViewProps["onPointerDown"] = host.onLostPointerCapture
  const lostCapture: ViewProps["onPointerDown"] = host.onLostPointerCaptureCapture
  void [over, overCapture, out, outCapture, got, gotCapture, lost, lostCapture]
}
const readCaptures = (host: TCaptureProps) => {
  const start: ViewProps["onTouchStart"] = host.onTouchStartCapture
  const move: ViewProps["onTouchMove"] = host.onTouchMoveCapture
  const cancel: ViewProps["onTouchCancel"] = host.onTouchCancelCapture
  void [start, move, cancel]
}

const originalRoot = createRef<View>()
export const nativeTableTouchCaptureCalls = [
  <Table
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <NativeFocusView {...host} />
    }}
  />,
  <TableHeader
    columns={[]}
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <View {...host} />
    }}
  />,
  <TableBody
    columns={[]}
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <View {...host} />
    }}
  />,
  <TableRow
    item={{}}
    columns={[]}
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <NativeFocusView {...host} />
    }}
  />,
  <TableCell
    columnID="name"
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <NativeFocusView {...host} />
    }}
  />,
  <TableColumn
    columnID="name"
    ref={originalRoot}
    onTouchStartCapture={capture}
    onTouchMoveCapture={capture}
    onTouchCancelCapture={capture}
    onPointerOver={pointer}
    onPointerOverCapture={pointer}
    onPointerOut={pointer}
    onPointerOutCapture={pointer}
    onGotPointerCapture={pointer}
    onGotPointerCaptureCapture={pointer}
    onLostPointerCapture={pointer}
    onLostPointerCaptureCapture={pointer}
    render={(host) => {
      readCaptures(host)
      readPointers(host)
      return <NativeFocusView {...host} />
    }}
  />,
  // @ts-expect-error Table capture handlers receive the original native touch payload, not a DOM TouchEvent.
  <Table onTouchStartCapture={(_event: TouchEvent) => {}} />,
  // @ts-expect-error Native touch capture handlers are functions, not boolean capture requests.
  <TableCell columnID="name" onTouchMoveCapture />,
  // @ts-expect-error Pointer counterparts retain native PointerEvent rather than touch callbacks.
  <TableColumn columnID="name" onPointerOutCapture={capture} />,
  // @ts-expect-error This component-local gap correction does not expand the generic NativeFocusView API.
  <NativeFocusView onTouchCancelCapture={capture} />,
]

export const originalTablePointerCaptureCalls = () => {
  const original = originalRoot.current
  original?.setPointerCapture(7)
  const held: boolean | undefined = original?.hasPointerCapture(7)
  original?.releasePointerCapture(7)
  void held
  // @ts-expect-error Original stock View capture IDs remain numeric.
  original?.setPointerCapture("7")
  // @ts-expect-error A capture ID is not a native event or ref proxy.
  original?.releasePointerCapture({ pointerId: 7 })
}

export const existingNativeTableMetadataCalls = [
  <Table style={{ direction: "rtl", display: "none" }} accessibilityLanguage="ar" />,
  <TableHeader columns={[]} style={{ direction: "ltr", display: "flex" }} accessibilityLanguage="fr-CA" />,
  <TableBody columns={[]} style={{ direction: "rtl", display: "none" }} accessibilityLanguage="" />,
  <TableRow item={{}} columns={[]} style={{ direction: "ltr", display: "flex" }} accessibilityLanguage="en" />,
  <TableCell columnID="name" style={{ direction: "rtl", display: "none" }} accessibilityLanguage="ar" />,
  <TableColumn columnID="name" style={{ direction: "ltr", display: "flex" }} accessibilityLanguage="fr-CA" />,
  // @ts-expect-error Native layout direction does not encode HTML first-strong auto semantics.
  <Table style={{ direction: "auto" }} />,
  // @ts-expect-error Native accessibility language is a string, not a locale object.
  <TableHeader columns={[]} accessibilityLanguage={{ language: "fr" }} />,
  // @ts-expect-error Native display visibility uses none/flex, not a hidden alias value.
  <TableCell columnID="name" style={{ display: "hidden" }} />,
]

// Independent authority list: approved generic View-root browser/advanced-ARIA boundary.
type TBrowserHostField =
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
  | "color"
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
type TBoundaryValues<T, K extends string = TBrowserHostField> = {
  [P in K]: P extends keyof T ? Exclude<T[P], undefined> : "missing boundary"
}
type TAssertRejected<T extends { [P in TBrowserHostField]: never }> = T
type TAssertRootRejected<T extends { [P in Exclude<TBrowserHostField, "slot" | "onScroll">]: never }> = T
type TRenderHost<T extends { render?: unknown }> =
  NonNullable<T["render"]> extends (...args: infer A) => unknown ? A[0] : never
type THeader = ComponentProps<typeof TableHeader>
type TBody = ComponentProps<typeof TableBody>
type TRow = ComponentProps<typeof TableRow>
type TCell = ComponentProps<typeof TableCell>
type TColumn = ComponentProps<typeof TableColumn>
export type TTableApprovedBrowserBoundaryCalls = [
  TAssertRootRejected<TBoundaryValues<ComponentProps<typeof Table>, Exclude<TBrowserHostField, "slot" | "onScroll">>>,
  TAssertRejected<TBoundaryValues<THeader>>,
  TAssertRejected<TBoundaryValues<TBody>>,
  TAssertRejected<TBoundaryValues<TRow>>,
  TAssertRejected<TBoundaryValues<TCell>>,
  TAssertRejected<TBoundaryValues<TColumn>>,
  TAssertRejected<TBoundaryValues<TRenderHost<ComponentProps<typeof Table>>>>,
  TAssertRejected<TBoundaryValues<TRenderHost<THeader>>>,
  TAssertRejected<TBoundaryValues<TRenderHost<TBody>>>,
  TAssertRejected<TBoundaryValues<TRenderHost<TRow>>>,
  TAssertRejected<TBoundaryValues<TRenderHost<TCell>>>,
  TAssertRejected<TBoundaryValues<TRenderHost<TColumn>>>,
]
const browserSpread = { inert: true, "aria-owns": "another-tree" }
const nativeClick = (_event: PointerEvent | NativeSyntheticEvent<Record<never, never>>) => {}
export const approvedNativeTableHostCalls = [
  <Table
    accessible={false}
    role="grid"
    slot={null}
    onScroll={() => {}}
    onClick={nativeClick}
    onClickCapture={nativeClick}
    accessibilityLabel="People"
    accessibilityHint="Choose a row"
    aria-live="polite"
  />,
  <NativeTablePropsContext.Provider value={{ slot: "people", accessible: false, role: "grid", onScroll: () => {} }} />,
  <TableHeader columns={[]} onClick={nativeClick} onClickCapture={nativeClick} />,
  <TableBody columns={[]} onClick={nativeClick} onClickCapture={nativeClick} />,
  <TableRow item={{}} columns={[]} onClick={nativeClick} onClickCapture={nativeClick} />,
  <TableCell columnID="name" colSpan={2} onClick={nativeClick} onClickCapture={nativeClick} />,
  <TableColumn columnID="name" isRowHeader allowsSorting onClick={nativeClick} onClickCapture={nativeClick} />,
  // @ts-expect-error Generic authored subtree inertness is explicitly excluded, also through spreads.
  <Table {...browserSpread} />,
  // @ts-expect-error Header original hosts do not promise browser service protocols.
  <TableHeader columns={[]} {...browserSpread} />,
  // @ts-expect-error Body original hosts do not promise browser service protocols.
  <TableBody columns={[]} {...browserSpread} />,
  // @ts-expect-error Row native drag/navigation/selection does not admit generic browser services.
  <TableRow item={{}} columns={[]} {...browserSpread} />,
  // @ts-expect-error Cell semantics come from the actual collection, not authored HTML coordinates.
  <TableCell columnID="name" {...browserSpread} />,
  // @ts-expect-error Column sorting semantics remain collection-owned.
  <TableColumn columnID="name" {...browserSpread} />,
  // @ts-expect-error The same explicit browser boundary applies to named native contexts.
  <NativeTablePropsContext.Provider value={{ slots: { people: browserSpread } }} />,
  // @ts-expect-error Root grouping would hide or regroup meaningful descendant AT targets.
  <Table accessible />,
  // @ts-expect-error The original root remains the collection-owned native grid.
  <Table role="button" />,
  // @ts-expect-error A contradictory legacy role is not an authored override.
  <Table accessibilityRole="button" />,
  // @ts-expect-error Native context values retain the same grouping boundary.
  <NativeTablePropsContext.Provider value={{ accessible: true }} />,
  // @ts-expect-error Native context values retain the same grid-role boundary.
  <NativeTablePropsContext.Provider value={{ role: "button" }} />,
  // @ts-expect-error Legacy roles cannot be supplied through context either.
  <NativeTablePropsContext.Provider value={{ accessibilityRole: "button" }} />,
  // @ts-expect-error The root real slot API does not imply HTML slot on other parts.
  <TableCell columnID="name" slot="html-slot" />,
  // @ts-expect-error Only the root renderer owner exposes meaningful scroll observation.
  <TableRow item={{}} columns={[]} onScroll={() => {}} />,
  // @ts-expect-error Raw click is a native pointer or empty Android click packet, never a full DOM MouseEvent.
  <Table onClick={(_event: import("react").MouseEvent) => {}} />,
]
