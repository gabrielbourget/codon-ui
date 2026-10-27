import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { Double, WithDefault } from "react-native/Libraries/Types/CodegenTypes"

type TLayoutLength = Readonly<{ field: string; points: Double; percent: Double }>

export interface NativeProps extends ViewProps {
  paintOpacity?: WithDefault<Double, 1>
  panelPosition?: WithDefault<"fixed" | "absolute" | "relative" | "static", "fixed">
  panelViewportHeight?: WithDefault<boolean, false>
  panelViewportWidth?: WithDefault<boolean, false>
  panelLayoutLengths?: ReadonlyArray<TLayoutLength>
  establishesContainingBlock?: WithDefault<boolean, false>
}

export default codegenNativeComponent<NativeProps>("CUIOverlayHost") as HostComponent<NativeProps>
