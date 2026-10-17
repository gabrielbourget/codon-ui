import type { ReactNode } from "react"
import type { ColorValue, StyleProp } from "react-native"

import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeButtonRootStyle } from "../Button/types"
import type { TNativeDisplayDimension } from "../displayDimensions"
import type {
  TNativeNumberInputProps,
  TNativeNumberInputRef,
  TNativeNumberInputRenderState,
} from "../NumberInput/types"

export const AVAILABLE_NATIVE_STEPPER_TYPES = ["cohesive", "segmented"] as const
export const AVAILABLE_NATIVE_STEPPER_ORIENTATIONS = ["horizontal", "vertical"] as const
export const AVAILABLE_NATIVE_STEPPER_COLOR_MODES = ["fill", "outline"] as const
export type TNativeStepperType = (typeof AVAILABLE_NATIVE_STEPPER_TYPES)[number]
export type TNativeStepperOrientation = (typeof AVAILABLE_NATIVE_STEPPER_ORIENTATIONS)[number]
export type TNativeStepperColorMode = (typeof AVAILABLE_NATIVE_STEPPER_COLOR_MODES)[number]
export type TNativeStepperRef = TNativeNumberInputRef
export type TNativeStepperRootStyle = TNativeButtonRootStyle
export type TNativeStepperRenderState = TNativeNumberInputRenderState
export type TNativeStepperStyleState = TNativeStepperRenderState & { defaultStyle: TNativeStepperRootStyle }
export type TNativeStepperLabels = { inputButtonGroupAriaLabel: string }

type TStepperBase<T> = T extends unknown
  ? Omit<T, "style" | "customStyles" | "customGroupStyles" | "IncrementIcon" | "DecrementIcon" | "width" | "height">
  : never

export type TNativeStepperProps = TStepperBase<TNativeNumberInputProps> & {
  type?: TNativeStepperType
  orientation?: TNativeStepperOrientation
  colorMode?: TNativeStepperColorMode
  order?: TThemingOrderCode
  color?: ColorValue
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  PlusIcon?: ReactNode
  MinusIcon?: ReactNode
  labels?: Partial<TNativeStepperLabels>
  customStyles?: StyleProp<TNativeStepperRootStyle>
  customGroupStyles?: StyleProp<TNativeStepperRootStyle>
  style?: StyleProp<TNativeStepperRootStyle> | ((state: TNativeStepperStyleState) => StyleProp<TNativeStepperRootStyle>)
}
