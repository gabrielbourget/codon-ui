import type { FC, ReactElement, RefAttributes } from "react"

import { NativeTimePickerRenderer } from "../../date/field/NativeTimePickerRenderer"
import type { TimeValue } from "../../date/state/types"

import type { TNativeTimePickerProps, TNativeTimePickerRef } from "./types"

export const TimePicker: {
  <T extends TimeValue>(props: TNativeTimePickerProps<T> & RefAttributes<TNativeTimePickerRef>): ReactElement
} & Pick<FC, keyof FC> = NativeTimePickerRenderer

TimePicker.displayName = "TimePicker"
