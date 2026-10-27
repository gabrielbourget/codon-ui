import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Double, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  paintOpacity?: WithDefault<Double, 1>
  panelPosition?: WithDefault<"fixed" | "absolute" | "relative" | "static", "fixed">
  panelViewportHeight?: WithDefault<boolean, false>
  panelViewportWidth?: WithDefault<boolean, false>
  establishesContainingBlock?: WithDefault<boolean, false>
}

export default codegenNativeComponent<NativeProps>("CUIOverlayHost") as HostComponent<NativeProps>
