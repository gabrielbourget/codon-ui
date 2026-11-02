import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { StyleProp, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeToolbarListenerProps } from "../../input/nativeToolbarKeyboard"

import type { TNativeToggleGroupState, TNativeToggleGroupStateOptions } from "./state"

export const NATIVE_TOGGLE_GROUP_ORIENTATIONS = ["horizontal", "vertical"] as const
export type TNativeToggleGroupOrientation = (typeof NATIVE_TOGGLE_GROUP_ORIENTATIONS)[number]
export type TNativeToggleButtonGroupRef = View
export type TNativeToggleButtonGroupRenderState = Readonly<{
  orientation: TNativeToggleGroupOrientation
  isDisabled: boolean
  state: TNativeToggleGroupState
}>
export type TNativeToggleButtonGroupStyleState = TNativeToggleButtonGroupRenderState & { defaultStyle: ViewStyle }
export type TNativeToggleButtonGroupRootProps = ViewProps &
  RefAttributes<View> &
  Pick<TNativeToolbarListenerProps, "onNativeOrdinaryEditorKeyCapture" | "onNativeDateKeyCapture">
export type TNativeToggleButtonGroupProps = Omit<
  ViewProps,
  "children" | "style" | "accessible" | "role" | "accessibilityRole"
> &
  TNativeToggleGroupStateOptions & {
    slot?: string | null
    orientation?: TNativeToggleGroupOrientation
    children?: ReactNode | ((state: TNativeToggleButtonGroupRenderState & { defaultChildren: undefined }) => ReactNode)
    render?: (props: TNativeToggleButtonGroupRootProps, state: TNativeToggleButtonGroupRenderState) => ReactElement
    customStyles?: StyleProp<ViewStyle>
    style?: StyleProp<ViewStyle> | ((state: TNativeToggleButtonGroupStyleState) => StyleProp<ViewStyle>)
    "data-testid"?: string
  }
