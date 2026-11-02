import type { ReactNode } from "react"
import type { ColorValue, StyleProp, TextInput, ViewStyle } from "react-native"

import type { TNativeOrdinaryEditorKeyEvent } from "../../input/ordinaryEditorKeys"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeDisplayDimension } from "../displayDimensions"
import type {
  TNativeNumberInputInputProps,
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
export type TNativeStepperRootStyle = ViewStyle & { color?: ColorValue }
export type TNativeStepperRenderState = TNativeNumberInputRenderState
export type TNativeStepperStyleState = TNativeStepperRenderState & { defaultStyle: TNativeStepperRootStyle }
export type TNativeStepperLabels = { inputButtonGroupAriaLabel: string }

export type TNativeStepperKeyboardEvent = TNativeOrdinaryEditorKeyEvent<TextInput>
/** Genuine original editor observations; JS preventDefault cannot veto an already proceeding native default. */
export type TNativeStepperKeyboardCallbacks = {
  onKeyDown?: (event: TNativeStepperKeyboardEvent) => void
  onKeyUp?: (event: TNativeStepperKeyboardEvent) => void
}
export type TNativeStepperInputProps = TNativeNumberInputInputProps & TNativeStepperKeyboardCallbacks

type TStepperBase<T> = T extends unknown
  ? Omit<
      T,
      | "style"
      | "customStyles"
      | "customGroupStyles"
      | "IncrementIcon"
      | "DecrementIcon"
      | "width"
      | "height"
      | "render"
      | "inputProps"
    >
  : never

export type TNativeStepperProps = TStepperBase<TNativeNumberInputProps> &
  TNativeStepperKeyboardCallbacks & {
    inputProps?: TNativeStepperInputProps
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
    style?:
      | StyleProp<TNativeStepperRootStyle>
      | ((state: TNativeStepperStyleState) => StyleProp<TNativeStepperRootStyle>)
  }
