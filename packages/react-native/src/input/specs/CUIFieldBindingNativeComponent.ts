import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Int32 } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  editorTarget: Int32
  hasFormAssociation: boolean
  formId: string
}

export default codegenNativeComponent<NativeProps>("CUIFieldBinding") as HostComponent<NativeProps>
