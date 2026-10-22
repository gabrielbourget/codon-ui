import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { DirectEventHandler, Double, Int32 } from "react-native/Libraries/Types/CodegenTypes"

export type NativeFormCommitData = Readonly<{
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  target: Int32
  originalTarget: Int32
  surfaceId: Int32
  windowId: string
  epoch: Double
  sequence: Double
  mountRevision: string
  attached: boolean
  active: boolean
  complete: boolean
  metadataOnly: boolean
  originalClass: string
  error: string
}>

export interface NativeProps extends ViewProps {
  onNativeFormCommit?: DirectEventHandler<NativeFormCommitData>
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  editorTarget: Int32
  hasFormAssociation: boolean
  formId: string
  semanticBinding?: string
}

export default codegenNativeComponent<NativeProps>("CUIFieldBinding") as HostComponent<NativeProps>
