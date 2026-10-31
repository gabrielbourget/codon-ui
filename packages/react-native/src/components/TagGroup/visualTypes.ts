import type { ColorValue, StyleProp, TextStyle } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"

import type { TNativeTagGroupSelectionBehavior, TNativeTagGroupSelectionMode } from "./model"

export const NATIVE_TAG_GROUP_ORIENTATIONS = ["horizontal", "vertical"] as const
export type TNativeTagGroupOrientation = (typeof NATIVE_TAG_GROUP_ORIENTATIONS)[number]
export type TNativeTagGroupVisualProps = {
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  orientation?: TNativeTagGroupOrientation
  customStyles?: StyleProp<TextStyle>
  customTagListStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
}
export type TNativeGroupedTagState = Readonly<{
  isSelected: boolean
  isDisabled: boolean
  isHovered: boolean
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  allowsSelection: boolean
  hasAction: boolean
  allowsRemoving: boolean
  selectionMode: TNativeTagGroupSelectionMode
  selectionBehavior: TNativeTagGroupSelectionBehavior
}>
export type TNativeGroupedTagVisualProps = {
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  color?: ColorValue
  transparent?: boolean
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle> | ((state: TNativeGroupedTagState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
}
