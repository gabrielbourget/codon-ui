import type * as React from "react"
import { codegenNativeCommands, codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { DirectEventHandler, Int32 } from "react-native/Libraries/Types/CodegenTypes"

export type NativeCollectionCommitData = Readonly<{ data: string }>
export type NativeCollectionActionData = Readonly<{ data: string }>

export interface NativeProps extends ViewProps {
  publication: string
  actionRequests?: string
  onNativeCollectionCommit?: DirectEventHandler<NativeCollectionCommitData>
  onNativeCollectionAction?: DirectEventHandler<NativeCollectionActionData>
}

type TNativeComponent = HostComponent<NativeProps>
interface NativeCommands {
  requestTextInputFocus: (viewRef: React.ElementRef<TNativeComponent>, target: Int32, binding: string) => void
}
export const Commands = codegenNativeCommands<NativeCommands>({ supportedCommands: ["requestTextInputFocus"] })
export default codegenNativeComponent<NativeProps>("CUICollectionRoot") as TNativeComponent
