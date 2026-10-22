import type * as React from "react"
import { codegenNativeCommands, codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { DirectEventHandler, Double, Int32, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export type NativeKeyData = Readonly<{
  kind: string
  ownerId: string
  target: Int32
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

export type NativeActivationData = Readonly<{
  kind: string
  ownerId: string
  target: Int32
  source: "android-click" | "ios-accessibility-activate"
  observedAt: Double
  activationId: Double
  scopeOwnerId: string
  windowId: string
  epoch: Double
}>

export type NativeAccessibilityData = Readonly<{
  ownerId: string
  target: Int32
  windowId: string
  platform: "android" | "ios"
  selected: boolean
  // UIKit's actual enum; -1 on Android, which has no corresponding container-type property.
  containerType: Int32
  // Actual Android NodeInfo fields; empty on UIKit, which has no corresponding properties.
  containerTitle: string
  roleDescription: string
  label: string
  hint: string
  value: string
  description: string
  details: string
  descriptionAvailable: boolean
  detailsAvailable: boolean
  collection: string
  observedAt: Double
}>

export type NativeMotionColors = Readonly<{
  ownerId: string
  target: Int32
  kind: "environment" | "sample"
  requestId: string
  windowId: string
  scopeOwnerId: string
  epoch: Double
  environmentRevision: Double
  attached: boolean
  colors: string
  error: string
  observedAt: Double
}>

export type NativeMotionGeometry = Readonly<{
  ownerId: string
  bindingId: string
  target: Int32
  kind: "sample" | "mount-before" | "mount-after" | "frame" | "detached"
  requestId: string
  windowId: string
  scopeOwnerId: string
  epoch: Double
  attachmentRevision: Double
  geometryRevision: Double
  commitRevision: string
  transactionId: string
  attached: boolean
  snapshot: string
  error: string
  observedAt: Double
}>

export type NativeFocusData = Readonly<{
  ownerId: string
  target: Int32
  isFocused: boolean
  isFocusVisible: boolean
  origin: "unknown" | "keyboard" | "pointer" | "programmatic"
  timestamp: Double
}>

export type NativeFocusWithinData = Readonly<{
  ownerId: string
  bindingId: string
  target: Int32
  surfaceId: Int32
  windowId: string
  scopeOwnerId: string
  scopeEpoch: Double
  sequence: Double
  attached: boolean
  active: boolean
  within: boolean
  focusedTarget: Int32
  textInputFocused: boolean
  origin: string
  observedAt: Double
}>

export type NativeFormActionStatus = Readonly<{
  ownerId: string
  descriptorRevision: string
  viewOwnerId: string
  target: Int32
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  scopeOwnerId: string
  scopeEpoch: Double
  attached: boolean
  active: boolean
  enabled: boolean
}>

export interface NativeProps extends ViewProps {
  ownerId: string
  nativeFocusWithinBinding?: string
  onNativeFocusWithin?: DirectEventHandler<NativeFocusWithinData>
  nativeFormActionBinding?: string
  onNativeFormActionStatus?: DirectEventHandler<NativeFormActionStatus>
  nativeCollectionBinding?: string
  nativeCollectionSemantics?: string
  keyboardFocusable?: WithDefault<boolean, true>
  nativeTabStop?: WithDefault<boolean, true>
  nativePressable?: WithDefault<boolean, false>
  nativeMotionGeometryBinding?: string
  nativeMotionGeometryRevision?: string
  nativeMotionColorObservation?: WithDefault<boolean, false>
  nativeMotionVisible?: WithDefault<boolean, true>
  nativeMotionProjectionRevision?: string
  nativeMotionDrawingOwner?: WithDefault<boolean, false>
  nativeMotionProjectionRadii?: string
  nativeNavigation?: WithDefault<boolean, false>
  nativeNavigationLabel?: WithDefault<string, "Navigation">
  capturedKeys?: ReadonlyArray<string>
  nativeLabelledBy?: ReadonlyArray<string>
  nativeDescribedBy?: ReadonlyArray<string>
  nativeDetailsBy?: ReadonlyArray<string>
  nativeDescriptionTag?: WithDefault<Int32, 0>
  nativeDescriptionLabel?: WithDefault<string, "Description">
  nativeDetailsLabel?: WithDefault<string, "Details">
  nativeScrollAnchorTag?: WithDefault<Int32, 0>
  nativeScrollAnchorKey?: string
  nativeScrollAnchorRevision?: string
  onNativeAccessibilitySnapshot?: DirectEventHandler<NativeAccessibilityData>
  onNativeMotionGeometry?: DirectEventHandler<NativeMotionGeometry>
  onNativeMotionColors?: DirectEventHandler<NativeMotionColors>
  onNativeActivation?: DirectEventHandler<NativeActivationData>
  onNativeKey?: DirectEventHandler<NativeKeyData>
  onNativeFocusChange?: DirectEventHandler<NativeFocusData>
}

type TNativeComponent = HostComponent<NativeProps>
interface NativeCommands {
  queryMotionGeometry: (
    viewRef: React.ElementRef<TNativeComponent>,
    ownerId: string,
    bindingId: string,
    requestId: string,
  ) => void
  sampleMotionColors: (
    viewRef: React.ElementRef<TNativeComponent>,
    ownerId: string,
    requestId: string,
    request: string,
  ) => void
  inspectAccessibility: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
  requestKeyboardFocus: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
  requestContainerFocus: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
  requestKeyboardBlur: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
}

export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    "requestKeyboardFocus",
    "requestContainerFocus",
    "requestKeyboardBlur",
    "inspectAccessibility",
    "sampleMotionColors",
    "queryMotionGeometry",
  ],
})

export default codegenNativeComponent<NativeProps>("CUIFocusView") as TNativeComponent
