import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"
import type { WithDefault } from "react-native/Libraries/Types/CodegenTypes"

export interface NativeProps extends ViewProps {
  slotRole?: WithDefault<"underlay" | "paint" | "body", "body">
}

export default codegenNativeComponent<NativeProps>("CUIOverlaySlot") as HostComponent<NativeProps>
