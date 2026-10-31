import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Double, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  ownerId: string
  windowId: string
  epoch: string
  hasClamp?: WithDefault<boolean, false>
  maximumLines?: WithDefault<Double, 0>
  noWrap?: WithDefault<boolean, false>
}

export default codegenNativeComponent<NativeProps>("CUIClampHost") as HostComponent<NativeProps>
