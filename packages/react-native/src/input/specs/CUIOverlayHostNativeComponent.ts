import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Double, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  paintOpacity?: WithDefault<Double, 1>
}

export default codegenNativeComponent<NativeProps>("CUIOverlayHost") as HostComponent<NativeProps>
