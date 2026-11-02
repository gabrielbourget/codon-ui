import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeMotionTransition } from "../../motion/animation/types"

export type TNativeSelectionIndicatorRef = View
export type TNativeSelectionIndicatorRenderState = Readonly<{ isEntering: boolean; isExiting: boolean }>
export type TNativeSelectionIndicatorTransitionProperty = keyof TextStyle | "translate" | "all" | "none"
export type TNativeSelectionIndicatorProps = Omit<TNativeFocusViewProps, "children" | "style"> & {
  slot?: string | null
  isSelected?: boolean
  transitionProperties?: readonly TNativeSelectionIndicatorTransitionProperty[]
  transition?: TNativeMotionTransition
  children?: ReactNode | ((state: TNativeSelectionIndicatorRenderState & { defaultChildren: undefined }) => ReactNode)
  customStyles?: StyleProp<TextStyle>
  style?:
    | StyleProp<TextStyle>
    | ((state: TNativeSelectionIndicatorRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  render?: (
    props: TNativeFocusViewProps & RefAttributes<View>,
    state: TNativeSelectionIndicatorRenderState,
  ) => ReactElement
  "data-testid"?: string
}
