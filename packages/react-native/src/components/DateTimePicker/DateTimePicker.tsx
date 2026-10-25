import { createCalendar } from "@internationalized/date"
import { forwardRef, useContext, type ForwardedRef, type ReactElement, type RefAttributes } from "react"
import type { View } from "react-native"

import { useNativeContextProps } from "../../collection/context"
import { calibrateNativeDatePickerStyle } from "../../date/picker/appearance"
import { NativeDatePickerContext, NativeDatePickerStateContext } from "../../date/picker/context"
import { NativeDatePickerView } from "../../date/picker/NativeDatePickerView"
import type { TNativeDateTimePickerProps } from "../../date/picker/types"
import type { DateValue } from "../../date/state/types"
import { useDateFieldState } from "../../date/state/useDateFieldState"
import type { DatePickerState } from "../../date/state/useDatePickerState"
import { useDatePickerState } from "../../date/state/useDatePickerState"
import { NativeFormBehaviorContext } from "../../form/context"
import { useNativeLocale } from "../../locale/NativeLocaleProvider"
import { privateValidationStateProp } from "../ComboBox/state/useFormValidationState"

export const DateTimePicker = forwardRef((authored: TNativeDateTimePickerProps, ref: ForwardedRef<View>) => {
  const [props, forwardedRef] = useNativeContextProps(
    { ...authored, style: calibrateNativeDatePickerStyle<DatePickerState>(authored) },
    ref,
    NativeDatePickerContext,
  )
  const { locale, direction } = useNativeLocale(),
    formBehavior = useContext(NativeFormBehaviorContext)
  const validationBehavior = props.validationBehavior ?? formBehavior ?? "native"
  const { onFocus: _focus, onBlur: _blur, onFocusChange: _change, onKeyDown: _down, onKeyUp: _up, ...rest } = props
  const state = useDatePickerState({
    ...rest,
    hourCycle: props.hourCycle ?? 24,
    shouldForceLeadingZeros: props.shouldForceLeadingZeros ?? true,
    validationBehavior,
  })
  const field = useDateFieldState<DateValue>({
    ...rest,
    locale,
    createCalendar,
    hourCycle: props.hourCycle ?? 24,
    shouldForceLeadingZeros: props.shouldForceLeadingZeros ?? true,
    value: state.value,
    onChange: state.setValue,
    validationBehavior,
    [privateValidationStateProp]: state,
  })
  return (
    <NativeDatePickerStateContext.Provider value={state}>
      <NativeDatePickerView
        range={false}
        props={props}
        state={state}
        appearanceProps={authored}
        forwardedRef={forwardedRef}
        fields={[{ slot: "value", state: field }]}
        locale={locale}
        direction={direction}
        validationBehavior={validationBehavior}
      />
    </NativeDatePickerStateContext.Provider>
  )
}) as <T extends DateValue>(props: TNativeDateTimePickerProps<T> & RefAttributes<View>) => ReactElement
