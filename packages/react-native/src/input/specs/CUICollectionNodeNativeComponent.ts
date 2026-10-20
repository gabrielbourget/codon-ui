import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"

export interface NativeProps extends ViewProps {
  ownerId: string
  rootId: string
  descriptorId: string
  descriptorRevision: string
}

export default codegenNativeComponent<NativeProps>("CUICollectionNode") as HostComponent<NativeProps>
