import { codegenNativeComponent, codegenNativeCommands, type HostComponent, type ViewProps } from "react-native"
import type {
  BubblingEventHandler,
  DirectEventHandler,
  Double,
  Int32,
  WithDefault,
} from "react-native/Libraries/Types/CodegenTypes"

export type NativeDateSegmentData = Readonly<{
  kind: string
  ownerId: string
  segmentId: string
  bindingRevision: string
  target: Int32
  nativeInstance: string
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  timestamp: Double
  text: string
  nativeData: string
  document: string
  replacementStart: Int32
  replacementEnd: Int32
  selectionStart: Int32
  selectionEnd: Int32
  composingStart: Int32
  composingEnd: Int32
  focused: boolean
  active: boolean
}>

export type NativeFieldKeyData = Readonly<{
  fieldDispatch: string
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

export interface NativeProps extends ViewProps {
  ownerId: string
  segmentId: string
  bindingRevision: string
  displayText: string
  locale: string
  keyboardMode?: WithDefault<string, "numeric">
  segmentDisabled: boolean
  segmentReadOnly: boolean
  segmentEditable: boolean
  segmentPlaceholder?: WithDefault<boolean, false>
  onNativeFieldKey?: BubblingEventHandler<NativeFieldKeyData>
  onNativeSegmentInput?: DirectEventHandler<NativeDateSegmentData>
}

type TNativeComponent = HostComponent<NativeProps>
interface NativeCommands {
  requestSegmentFocus: (
    viewRef: React.ElementRef<TNativeComponent>,
    ownerId: string,
    segmentId: string,
    bindingRevision: string,
    windowId: string,
    epoch: Double,
  ) => void
  requestSegmentBlur: (
    viewRef: React.ElementRef<TNativeComponent>,
    ownerId: string,
    segmentId: string,
    bindingRevision: string,
    windowId: string,
    epoch: Double,
  ) => void
}
export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ["requestSegmentFocus", "requestSegmentBlur"],
})
export default codegenNativeComponent<NativeProps>("CUIDateSegment") as TNativeComponent
