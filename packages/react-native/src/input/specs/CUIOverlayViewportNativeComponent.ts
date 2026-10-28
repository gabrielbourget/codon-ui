import { codegenNativeComponent, type HostComponent, type ViewProps } from "react-native"

export interface NativeProps extends ViewProps {
  ownerId: string
}

export default codegenNativeComponent<NativeProps>("CUIOverlayViewport") as HostComponent<NativeProps>
