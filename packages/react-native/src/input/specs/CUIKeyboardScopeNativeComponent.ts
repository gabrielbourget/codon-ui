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

export interface NativeProps extends ViewProps {
  ownerId: string
  enabled?: WithDefault<boolean, true>
  policies?: ReadonlyArray<NativeKeyPolicy>
  acceptedWindowId?: string
  acceptedEpoch?: Double
  policyRevision?: Double
  floatingTargets?: ReadonlyArray<NativeFloatingTarget>
  onNativeFloatingObservation?: DirectEventHandler<NativeFloatingObservation>
  onNativeScopedKey?: DirectEventHandler<NativeScopedKeyData>
  onNativeInputModality?: DirectEventHandler<NativeInputModalityData>
  onNativeScopeStatus?: DirectEventHandler<NativeScopeStatus>
}

export default codegenNativeComponent<NativeProps>("CUIKeyboardScope") as HostComponent<NativeProps>
