import { createCalendar } from "@internationalized/date"
import { forwardRef, useContext, type ForwardedRef, type ReactElement, type RefAttributes } from "react"
import type { View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { calibrateNativeDatePickerStyle } from "../../date/picker/appearance"
import { NativeDateRangePickerContext, NativeDateRangePickerStateContext } from "../../date/picker/context"
import { NativeDatePickerView } from "../../date/picker/NativeDatePickerView"
import type { TNativeDateTimeRangePickerProps } from "../../date/picker/types"
import type { DateValue } from "../../date/state/types"
import { useDateFieldState } from "../../date/state/useDateFieldState"
import type { DateRangePickerState } from "../../date/state/useDateRangePickerState"
import { useDateRangePickerState } from "../../date/state/useDateRangePickerState"
import { NativeFormBehaviorContext } from "../../form/context"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { privateValidationStateProp } from "../ComboBox/state/useFormValidationState"

export const DateTimeRangePicker = forwardRef((authored: TNativeDateTimeRangePickerProps, ref: ForwardedRef<View>) => {
  const [props, forwardedRef] = useNativeContextProps(
    { ...authored, style: calibrateNativeDatePickerStyle<DateRangePickerState>(authored) },
    ref,
    NativeDateRangePickerContext,
  )
  const { locale, direction } = useNativeLocale(),
    formBehavior = useContext(NativeFormBehaviorContext)
  const validationBehavior = props.validationBehavior ?? formBehavior ?? "native"
  const { onFocus: _focus, onBlur: _blur, onFocusChange: _change, onKeyDown: _down, onKeyUp: _up, ...rest } = props
  const state = useDateRangePickerState({
    ...rest,
    hourCycle: props.hourCycle ?? 24,
    shouldForceLeadingZeros: props.shouldForceLeadingZeros ?? true,
    validationBehavior,
  })
  const options = {
    ...rest,
    locale,
    createCalendar,
    hourCycle: props.hourCycle ?? 24,
    shouldForceLeadingZeros: props.shouldForceLeadingZeros ?? true,
    validationBehavior,
    validate: undefined,
    [privateValidationStateProp]: state,
  }
  const start = useDateFieldState({
    ...options,
    defaultValue: undefined,
    value: state.value.start,
    onChange: (value) => state.setDateTime("start", value),
  })
  const end = useDateFieldState({
    ...options,
    defaultValue: undefined,
    value: state.value.end,
    onChange: (value) => state.setDateTime("end", value),
  })
  return (
    <NativeDateRangePickerStateContext.Provider value={state}>
      <NativeDatePickerView
        range={true}
        props={props}
        state={state}
        appearanceProps={authored}
        forwardedRef={forwardedRef}
        fields={[
          { slot: "start", state: start },
          { slot: "end", state: end },
        ]}
        locale={locale}
        direction={direction}
        validationBehavior={validationBehavior}
      />
    </NativeDateRangePickerStateContext.Provider>
  )
}) as <T extends DateValue>(props: TNativeDateTimeRangePickerProps<T> & RefAttributes<View>) => ReactElement
