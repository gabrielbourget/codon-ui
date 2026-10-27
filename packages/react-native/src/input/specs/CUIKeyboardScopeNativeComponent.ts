import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { DirectEventHandler, Double, Int32, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export type NativeScopedKeyData = Readonly<{
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
type NativeFloatingTarget = Readonly<{ id: string; targetTag: Int32; descriptionTag: Int32; descriptionLabel: string }>
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
type NativeMenuPointerPolicy = Readonly<{
  id: string
  parentTarget: Int32
  submenuTarget: Int32
  triggerTarget: Int32
  parentBinding: string
  submenuBinding: string
  triggerBinding: string
}>
export type NativeMenuPointerData = Readonly<{
  ownerId: string
  windowId: string
  epoch: Double
  revision: Double
  policyId: string
  sequence: Double
  phase: "status" | "move" | "down" | "reset" | "handoff" | "retired"
  ready: boolean
  suppressed: boolean
  observationId: Double
  pointerType: "mouse" | "touch" | "pen" | "virtual" | "unknown"
  pageX: Double
  pageY: Double
  timestamp: Double
  target: Int32
  hitPath: Int32[]
  nativeButtons: string
  nativeModifiers: string
  geometry: string
  error: string
}>

export type NativeEditorKeyboardBinding = Readonly<{
  bindingId: string
  bindingRevision: string
  targetTag: Int32
  moduleLease: string
}>
export type NativeEditorKeyData = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: Int32
  windowId: string
  epoch: Double
  eventId: Double
  phase: "down" | "up" | "cancel"
  key: string
  code: string
  nativeCode: Int32
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
  timestamp: Double
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
export type NativeEditorKeyboardDecision = Readonly<{
  ownerId: string
  bindingId: string
  bindingRevision: string
  target: Int32
  windowId: string
  epoch: Double
  eventId: Double
  phase: "down" | "up" | "cancel"
  decision: "allowed" | "prevented" | "unacknowledged" | "retired"
  elapsedMs: Double
}>

export interface NativeProps extends ViewProps {
  ownerId: string
  dialogScopes?: ReadonlyArray<NativeDialogBinding>
  dialogRevision?: Double
  onNativeDialogStatus?: DirectEventHandler<NativeDialogStatus>
  onNativeDialogAction?: DirectEventHandler<NativeDialogAction>
  editorKeyboardBindings?: ReadonlyArray<NativeEditorKeyboardBinding>
  onNativeEditorKey?: DirectEventHandler<NativeEditorKeyData>
  onNativeEditorKeyboardStatus?: DirectEventHandler<NativeEditorKeyboardStatus>
  onNativeEditorKeyboardDecision?: DirectEventHandler<NativeEditorKeyboardDecision>
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
  menuPointerPolicies?: ReadonlyArray<NativeMenuPointerPolicy>
  menuPointerRevision?: Double
  onNativeMenuPointer?: DirectEventHandler<NativeMenuPointerData>
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
