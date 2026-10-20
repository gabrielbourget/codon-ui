import type { ReactNode } from "react"
import type { StyleProp, TextStyle } from "react-native"

import type { TNativeFocusViewProps, TNativeFocusViewRef } from "../../input/types"
import type { MotionValue } from "../../motion/kernel"
import type { TNativeMotionOwnerProps } from "../../motion/owner/NativeMotionOwner"
import type { TNativeMotionVisualHostProps } from "../../motion/visual/types"
import type { TNativeDisplayDimension } from "../displayDimensions"

export type TNativeCardRef = TNativeFocusViewRef
export type TNativeCardProps = Omit<TNativeFocusViewProps, "children" | "style" | keyof TNativeMotionOwnerProps> &
  TNativeMotionOwnerProps &
  Pick<TNativeMotionVisualHostProps, "transformTemplate" | "onUpdate"> & {
    children?: ReactNode
    height?: TNativeDisplayDimension
    width?: TNativeDisplayDimension
    borderRadius?: number | `${number}%`
    layoutMode?: "size" | "position"
    raised?: boolean
    customStyles?: StyleProp<TextStyle>
    style?: StyleProp<TextStyle>
    values?: Readonly<Record<string, MotionValue<number> | MotionValue<string>>>
    "data-testid"?: string
  }
