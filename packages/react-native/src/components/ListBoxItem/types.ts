import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { ColorValue, PressableProps, StyleProp, View, ViewStyle } from "react-native"

import type { TNativeSelectKey, TNativeSelectSize } from "../Select/types"
import type { TNativeSelectionHostProps, TNativeSelectionState } from "../selection"

export type TNativeListBoxItemRef = View
export type TNativeListBoxItemRenderState = TNativeSelectionState
export type TNativeListBoxItemRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeListBoxItemStyleState = TNativeListBoxItemRenderState & { defaultStyle: TNativeListBoxItemRootStyle }
export type TNativeListBoxItemProps = Omit<TNativeSelectionHostProps, "id" | "accessibilityLabel" | "aria-label"> & {
  render?: (props: PressableProps & RefAttributes<View>, state: TNativeListBoxItemRenderState) => ReactElement
  id: TNativeSelectKey
  textValue: string
  isSelected?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  children?: ReactNode | ((state: TNativeListBoxItemRenderState & { defaultChildren: undefined }) => ReactNode)
  textSize?: TNativeSelectSize
  customStyles?: StyleProp<TNativeListBoxItemRootStyle>
  style?:
    | StyleProp<TNativeListBoxItemRootStyle>
    | ((state: TNativeListBoxItemStyleState) => StyleProp<TNativeListBoxItemRootStyle>)
}
