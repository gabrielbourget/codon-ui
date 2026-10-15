import type { ReactNode } from "react"
import type { StyleProp, View, ViewStyle } from "react-native"

import type { TNativeSelectKey, TNativeSelectSize } from "../Select/types"
import type { TNativeSelectionHostProps, TNativeSelectionState } from "../selection"

export type TNativeListBoxItemRef = View
export type TNativeListBoxItemRenderState = TNativeSelectionState
export type TNativeListBoxItemStyleState = TNativeListBoxItemRenderState & { defaultStyle: ViewStyle }
export type TNativeListBoxItemProps = Omit<TNativeSelectionHostProps, "id" | "accessibilityLabel" | "aria-label"> & {
  id: TNativeSelectKey
  textValue: string
  isSelected?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  children?: ReactNode | ((state: TNativeListBoxItemRenderState) => ReactNode)
  textSize?: TNativeSelectSize
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle> | ((state: TNativeListBoxItemStyleState) => StyleProp<ViewStyle>)
}
