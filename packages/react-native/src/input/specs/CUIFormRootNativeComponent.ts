import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Int32 } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  ownerId: string
  descriptorId: string
  descriptorRevision: string
  formTarget: Int32
  formId: string
}

export default codegenNativeComponent<NativeProps>("CUIFormRoot") as HostComponent<NativeProps>
