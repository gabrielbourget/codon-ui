import type { FC, RefAttributes } from "react"

import { NativeTimePickerRenderer } from "../../date/field/NativeTimePickerRenderer"
import type { TimeValue } from "../../date/state/types"

import type { TNativeTimePickerProps, TNativeTimePickerRef } from "./types"

export const TimePicker: FC<TNativeTimePickerProps<TimeValue> & RefAttributes<TNativeTimePickerRef>> =
  NativeTimePickerRenderer

TimePicker.displayName = "TimePicker"
