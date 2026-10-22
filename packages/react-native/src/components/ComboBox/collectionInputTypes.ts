import type { ReactElement } from "react"
import type { StyleProp, TextInputProps, TextStyle } from "react-native"

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeInputHostRender } from "../Input/Input"
import type { TNativeInputProps, TNativeInputRenderState } from "../Input/types"

export type TNativeComboBoxInputRenderState = TNativeInputRenderState &
  Readonly<{
    isHovered: boolean
    isFocusVisible: boolean
  }>
export type TNativeComboBoxInputProps = Omit<TNativeInputProps, "style"> &
  TNativeSlotProps & {
    isInvalid?: boolean
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeComboBoxInputRenderState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (props: Parameters<TNativeInputHostRender>[0], state: TNativeComboBoxInputRenderState) => ReactElement
    onHoverStart?: TextInputProps["onPointerEnter"]
    onHoverEnd?: TextInputProps["onPointerLeave"]
    onHoverChange?: (hovered: boolean) => void
  }
