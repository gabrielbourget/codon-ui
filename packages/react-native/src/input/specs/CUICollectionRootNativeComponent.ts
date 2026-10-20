import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { DirectEventHandler, Double, Int32 } from "react-native/Libraries/Types/CodegenTypes"

export type NativeCollectionCommitData = Readonly<{
  ownerId: string
  rootId: string
  rootRevision: string
  target: Int32
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  mountRevision: string
  attached: boolean
  complete: boolean
  metadataOnly: boolean
  hierarchy: string
  error: string
}>

export interface NativeProps extends ViewProps {
  ownerId: string
  rootId: string
  rootRevision: string
  onNativeCollectionCommit?: DirectEventHandler<NativeCollectionCommitData>
}

export default codegenNativeComponent<NativeProps>("CUICollectionRoot") as HostComponent<NativeProps>
