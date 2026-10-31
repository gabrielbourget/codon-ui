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

export type NativeCollectionInspectionData = Readonly<{
  requestId: string
  ownerId: string
  rootId: string
  rootRevision: string
  target: Int32
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  accepted: boolean
  inspection: string
  error: string
}>

export type NativeCollectionActionData = Readonly<{
  requestId: string
  ownerId: string
  rootId: string
  rootRevision: string
  target: Int32
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  visibleTarget: Int32
  accepted: boolean
}>

export interface NativeProps extends ViewProps {
  ownerId: string
  rootId: string
  rootRevision: string
  inspectionRequest?: string
  actionRequests?: string
  onNativeCollectionCommit?: DirectEventHandler<NativeCollectionCommitData>
  onNativeCollectionInspection?: DirectEventHandler<NativeCollectionInspectionData>
  onNativeCollectionAction?: DirectEventHandler<NativeCollectionActionData>
}

export default codegenNativeComponent<NativeProps>("CUICollectionRoot") as HostComponent<NativeProps>
