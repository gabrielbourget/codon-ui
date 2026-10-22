import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeFieldSemanticLabels } from "../../form/semantics"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TimePickerProps, TimeValue } from "../state/types"
import type { DateFieldState } from "../state/useDateFieldState"

export type TNativeTimeFieldRenderState = Readonly<{
  state: DateFieldState
  isInvalid: boolean
  isDisabled: boolean
  isReadOnly: boolean
  isRequired: boolean
}>
export type TNativeTimeFieldStyleState = TNativeTimeFieldRenderState & { defaultStyle: TextStyle }
export type TNativeTimeFieldProps<T extends TimeValue = TimeValue> = Omit<TNativeFocusViewProps, "children" | "style"> &
  Omit<
    TimePickerProps<T>,
    | "label"
    | "description"
    | "errorMessage"
    | "validationState"
    | "onFocus"
    | "onBlur"
    | "onFocusChange"
    | "onKeyDown"
    | "onKeyUp"
  > &
  TNativeSlotProps & {
    onFocusChange?: (focused: boolean) => void
    id?: string
    name?: string
    form?: string
    autoComplete?: string
    nativeAccessibilityLabels?: Partial<TNativeFieldSemanticLabels>
    "data-testid"?: string
    ariaDescribedBy?: string | readonly string[]
    ariaDetails?: string | readonly string[]
    "aria-describedby"?: string
    "aria-details"?: string
    children?: ReactNode | ((state: TNativeTimeFieldRenderState) => ReactNode)
    style?: StyleProp<TextStyle> | ((state: TNativeTimeFieldStyleState) => StyleProp<TextStyle>)
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: TNativeTimeFieldRenderState) => ReactElement
  }

// RAC's TimeFieldContext accepts any supported TimeValue subtype. Method
// bivariance preserves that provider boundary without exposing `any` to owners.
export type TNativeTimeFieldContextProps = Omit<Partial<TNativeTimeFieldProps>, "onChange" | "validate"> & {
  onChange?: { change(value: TimeValue | null): void }["change"]
  validate?: { validate(value: TimeValue): ReturnType<NonNullable<TNativeTimeFieldProps["validate"]>> }["validate"]
}
