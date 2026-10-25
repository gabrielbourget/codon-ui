import type { View } from "react-native"

import type { TNativeTimePickerAppearanceProps } from "../../date/field/appearance"
import type {
  TNativeTimeFieldProps,
  TNativeTimeFieldRenderState,
  TNativeTimeFieldStyleState,
} from "../../date/field/types"
import type { TimeValue } from "../../date/state/types"

export const TIME_PICKER_SIZE__SM = "small"
export const TIME_PICKER_SIZE__MD = "medium"
export const TIME_PICKER_SIZE__LG = "large"
export const AVAILABLE_TIMEPICKER_TEXT_SIZES = [
  TIME_PICKER_SIZE__SM,
  TIME_PICKER_SIZE__MD,
  TIME_PICKER_SIZE__LG,
] as const
export type TNativeTimePickerTextSize = (typeof AVAILABLE_TIMEPICKER_TEXT_SIZES)[number]
export type TNativeTimePickerRef = View
export type TNativeTimePickerProps<T extends TimeValue = TimeValue> = TNativeTimeFieldProps<T> &
  TNativeTimePickerAppearanceProps
export type TNativeTimePickerRenderState = TNativeTimeFieldRenderState
export type TNativeTimePickerStyleState = TNativeTimeFieldStyleState
export type TNativeTimePickerLabels = Required<NonNullable<TNativeTimePickerAppearanceProps["labels"]>>
export type TPartialNativeTimePickerLabels = Partial<TNativeTimePickerLabels>
export type TNativeTimePickerValue = TimeValue
