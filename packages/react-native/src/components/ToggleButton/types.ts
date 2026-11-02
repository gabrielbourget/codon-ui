import type { ReactElement, ReactNode } from "react"
import type { AccessibilityState, StyleProp } from "react-native"

import type {
  TNativeButtonProps,
  TNativeButtonRef,
  TNativeButtonRenderState,
  TNativeButtonRootStyle,
} from "../Button/types"
import type { TNativeDisplayDimension } from "../displayDimensions"

export type TNativeToggleButtonRef = TNativeButtonRef
export type TNativeToggleButtonSelectionState = Readonly<{
  isSelected: boolean
  defaultSelected: boolean
  setSelected: (selected: boolean) => void
  toggle: () => void
}>
export type TNativeToggleButtonRenderState = Omit<TNativeButtonRenderState, "isPending"> & {
  isSelected: boolean
  state: TNativeToggleButtonSelectionState
}
export type TNativeToggleButtonStyleState = TNativeToggleButtonRenderState & { defaultStyle: TNativeButtonRootStyle }
export type TNativeToggleButtonChildrenState = TNativeToggleButtonRenderState & { defaultChildren: undefined }
export type TNativeToggleButtonProps = Omit<
  TNativeButtonProps,
  | "render"
  | "children"
  | "slot"
  | "id"
  | "style"
  | "width"
  | "height"
  | "isPending"
  | "colorMode"
  | "transparent"
  | "hoverColor"
  | "raisedOnHover"
  | "accessibilityState"
  | "aria-busy"
  | "aria-checked"
  | "aria-selected"
> & {
  slot?: string | null
  id?: string | number
  isSelected?: boolean
  defaultSelected?: boolean
  onChange?: (selected: boolean) => void
  autoFocus?: boolean
  preventFocusOnPress?: boolean
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  children?: ReactNode | ((state: TNativeToggleButtonChildrenState) => ReactNode)
  render?: (
    props: Parameters<NonNullable<TNativeButtonProps["render"]>>[0],
    state: TNativeToggleButtonRenderState,
  ) => ReactElement
  style?:
    | StyleProp<TNativeButtonRootStyle>
    | ((state: TNativeToggleButtonStyleState) => StyleProp<TNativeButtonRootStyle>)
  accessibilityState?: Omit<AccessibilityState, "disabled" | "busy" | "checked" | "selected">
  "aria-checked"?: never
  "aria-selected"?: never
  "aria-busy"?: never
}
