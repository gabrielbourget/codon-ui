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

export type NativeFocusData = Readonly<{
  ownerId: string
  target: Int32
  isFocused: boolean
  isFocusVisible: boolean
  origin: "unknown" | "keyboard" | "pointer" | "programmatic"
  timestamp: Double
}>

export interface NativeProps extends ViewProps {
  ownerId: string
  keyboardFocusable?: WithDefault<boolean, true>
  nativePressable?: WithDefault<boolean, false>
  capturedKeys?: ReadonlyArray<string>
  onNativeKey?: DirectEventHandler<NativeKeyData>
  onNativeFocusChange?: DirectEventHandler<NativeFocusData>
}

type TNativeComponent = HostComponent<NativeProps>
interface NativeCommands {
  requestKeyboardFocus: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
  requestKeyboardBlur: (viewRef: React.ElementRef<TNativeComponent>, ownerId: string) => void
}

export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ["requestKeyboardFocus", "requestKeyboardBlur"],
})

export default codegenNativeComponent<NativeProps>("CUIFocusView") as TNativeComponent
