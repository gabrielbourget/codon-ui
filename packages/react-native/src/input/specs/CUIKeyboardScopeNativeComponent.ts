import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type {
  BubblingEventHandler,
  DirectEventHandler,
  Double,
  Int32,
  WithDefault,
} from "react-native/Libraries/Types/CodegenTypes"

// Registration metadata mirrors the locked stock PointerEvent serializer; the stock processor emits these events.
type NativePointerCaptureData = Readonly<{
  pointerId: Int32
  pressure: Double
  pointerType: string
  clientX: Double
  clientY: Double
  x: Double
  y: Double
  pageX: Double
  pageY: Double
  screenX: Double
  screenY: Double
  offsetX: Double
  offsetY: Double
  width: Double
  height: Double
  tiltX: Int32
  tiltY: Int32
  detail: Int32
  buttons: Int32
  tangentialPressure: Double
  twist: Int32
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
  isPrimary: boolean
  button: Int32
}>

export type NativeDragActionData = Readonly<{ packet: string }>
export type NativeScopedKeyData = Readonly<{
  originalEditorAction?: string
  kind: string
  ownerId: string
  policyId: string
  target: Int32
  focusedTarget: Int32
  windowId: string
  epoch: Double
  policyRevision: Double
  key: string
  nativeCode: Int32
  characters: string
  phase: "down" | "up"
  repeat: boolean
  cancelled: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  nativeModifierData: string
  nativeDefaultHandled: boolean
  timestamp: Double
}>
export type NativeInputModalityData = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  origin: "keyboard" | "pointer"
  timestamp: Double
}>
type NativeKeyPolicy = Readonly<{
  originalEditorAction?: boolean
  id: string
  tokens: ReadonlyArray<string>
  excludeEditable: boolean
  excludeComposing: boolean
  targetTag: Int32
}>
type NativeDialogBinding = Readonly<{
  id: string
  parentId: string
  bindingId: string
  targetTag: Int32
  memberTargets: ReadonlyArray<Readonly<{ id: string; targetTag: Int32 }>>
  entryTargets: ReadonlyArray<Readonly<{ id: string; targetTag: Int32; allowed: boolean }>>
  enabled: boolean
  entryAllowed: boolean
}>
export type NativeDialogStatus = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  revision: Double
  ready: boolean
  error: string
}>
export type NativeDialogAction = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  revision: Double
  id: string
  bindingId: string
  phase: "entered" | "wrapped" | "restored"
  target: Int32
}>
export type NativeScopeStatus = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  policyRevision: Double
  ready: boolean
  windowActive: boolean
}>
export type NativeFloatingObservation = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  id: string
  targetTag: Int32
  x: Double
  y: Double
  width: Double
  height: Double
  scrollRevision: Double
  revision: Double
}>
type NativeFloatingTarget = Readonly<{ id: string; targetTag: Int32 }>
type NativeKeyObservation = Readonly<{ id: string; targetTag: Int32 }>
export type NativeObservedKeyData = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  observationRevision: Double
  eventId: Double
  observerIds: string[]
  target: Int32
  focusedTarget: Int32
  key: string
  code: string
  nativeCode: Int32
  legacyKeyCode: Int32
  location: Int32
  repeat: boolean
  cancelled: boolean
  isComposing: boolean
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  capsLock: boolean
  nativeModifierData: string
  defaultCaptured: boolean
  timestamp: Double
}>
type NativeObservationStatus = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  observationRevision: Double
  ready: boolean
  windowActive: boolean
}>

type NativePointerRegistration = Readonly<{ id: string; targetTag: Int32 }>
export type NativeWindowPointerData = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  sequence: Double
  phase: "start" | "move" | "end" | "cancel" | "activation"
  pointerId: Int32
  pointerType: "touch" | "mouse" | "pen" | "virtual"
  isPrimary: boolean
  button: Int32
  buttons: Int32
  nativeButtons: string
  shiftKey: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  nativeModifiers: string
  pageX: Double
  pageY: Double
  timestamp: Double
  target: Int32
  registrations: {
    id: string
    ownerId: string
    epoch: Double
    revision: Double
    targetTag: Int32
    depth: Int32
  }[]
}>
export type NativePointerStatus = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  revision: Double
  ready: boolean
  error: string
}>
type NativeOrdinaryEditorBinding = Readonly<{
  bindingId: string
  bindingRevision: string
  targetTag: Int32
  subtree: boolean
  toolbarTargetOnly: boolean
  toolbarSubtreeOnly: boolean
  originalEditorAction?: boolean
}>

export type NativeEditorKeyboardStatus = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: Int32
  windowId: string
  epoch: Double
  sequence: Double
  ready: boolean
  windowActive: boolean
  error: string
}>

type NativeEditorWheelBinding = Readonly<{
  bindingId: string
  bindingRevision: string
  targetTag: Int32
  groupTarget: Int32
}>
export type NativeEditorWheelStatus = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: Int32
  groupTarget: Int32
  windowId: string
  epoch: Double
  sequence: Double
  ready: boolean
  windowActive: boolean
  sourceKind: string
  error: string
}>
export type NativeEditorWheelData = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: Int32
  groupTarget: Int32
  focusedTarget: Int32
  windowId: string
  epoch: Double
  sequence: Double
  timestamp: Double
  deltaX: Double
  deltaY: Double
  rawAxisX: Double
  rawAxisY: Double
  sourceKind: string
  nativeDefaultHandled: boolean
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
}>

export interface NativeProps extends ViewProps {
  onGotPointerCapture?: BubblingEventHandler<NativePointerCaptureData>
  onLostPointerCapture?: BubblingEventHandler<NativePointerCaptureData>
  onNativeDragAction?: DirectEventHandler<NativeDragActionData>
  onNativeDragStatus?: DirectEventHandler<NativeDragActionData>
  dragBindings?: WithDefault<string, "[]">
  ownerId: string
  dialogScopes?: ReadonlyArray<NativeDialogBinding>
  dialogRevision?: Double
  onNativeDialogStatus?: DirectEventHandler<NativeDialogStatus>
  onNativeDialogAction?: DirectEventHandler<NativeDialogAction>
  toolbarBindings?: WithDefault<string, "[]">
  onNativeToolbarKeyboard?: DirectEventHandler<NativeDragActionData>
  onNativeToolbarStatus?: DirectEventHandler<NativeDragActionData>
  ordinaryEditorBindings?: ReadonlyArray<NativeOrdinaryEditorBinding>
  onNativeOrdinaryEditorStatus?: DirectEventHandler<NativeEditorKeyboardStatus>
  editorWheelBindings?: ReadonlyArray<NativeEditorWheelBinding>
  onNativeEditorWheelStatus?: DirectEventHandler<NativeEditorWheelStatus>
  onNativeEditorWheel?: DirectEventHandler<NativeEditorWheelData>
  enabled?: WithDefault<boolean, true>
  policies?: ReadonlyArray<NativeKeyPolicy>
  acceptedWindowId?: string
  acceptedEpoch?: Double
  policyRevision?: Double
  floatingTargets?: ReadonlyArray<NativeFloatingTarget>
  observations?: ReadonlyArray<NativeKeyObservation>
  observationRevision?: Double
  pointerRegistrations?: ReadonlyArray<NativePointerRegistration>
  pointerRevision?: Double
  onNativeWindowPointer?: DirectEventHandler<NativeWindowPointerData>
  onNativePointerStatus?: DirectEventHandler<NativePointerStatus>
  onNativeObservedKey?: DirectEventHandler<NativeObservedKeyData>
  onNativeObservationStatus?: DirectEventHandler<NativeObservationStatus>
  onNativeFloatingObservation?: DirectEventHandler<NativeFloatingObservation>
  onNativeScopedKey?: DirectEventHandler<NativeScopedKeyData>
  onNativeInputModality?: DirectEventHandler<NativeInputModalityData>
  onNativeScopeStatus?: DirectEventHandler<NativeScopeStatus>
}

export default codegenNativeComponent<NativeProps>("CUIKeyboardScope") as HostComponent<NativeProps>
