import { CalendarDateTime, Time, parseZonedDateTime } from "@internationalized/date"
import { createRef } from "react"

import {
  TimePicker,
  NativeLocaleProvider,
  NativeTimeFieldContext,
  NativeTimeFieldLabel,
  NativeTimeFieldText,
  NativeTimeFieldError,
  type TimePickerProps,
  type TNativeTimePickerRef,
} from "../src"

export const Values = [
  new Time(13, 45, 7),
  new CalendarDateTime(2024, 10, 1, 13, 45, 7),
  parseZonedDateTime("2024-10-01T13:45:07-04:00[America/New_York]"),
]
export const ValueClasses = Values.map((value) => (
  <TimePicker
    ref={createRef<TNativeTimePickerRef>()}
    value={value}
    granularity="second"
    onChange={(next) => next?.hour}
  />
))
export const ControlledNull = <TimePicker value={null} defaultValue={Values[0]} isRequired name="clock" />
export const Readonly = <TimePicker isReadOnly hourCycle={12} geometry="round" textSize="small" />
export const RenderStyle = (
  <TimePicker width={0} style={({ defaultStyle, state }) => [defaultStyle, { opacity: state.isInvalid ? 0.5 : 1 }]} />
)
export const ContextField = (
  <NativeLocaleProvider locale="ar-EG">
    <NativeTimeFieldContext.Provider value={{ isReadOnly: true }}>
      <TimePicker>
        <NativeTimeFieldLabel>Time</NativeTimeFieldLabel>
        <NativeTimeFieldText slot="description">Choose a time</NativeTimeFieldText>
        <NativeTimeFieldError />
      </TimePicker>
    </NativeTimeFieldContext.Provider>
  </NativeLocaleProvider>
)
export const GenericTimeProps: TimePickerProps<Time> = { value: new Time(13), onChange: (value) => value?.hour }
// @ts-expect-error TimePicker preserves TimeValue objects rather than string values.
export const InvalidValue = <TimePicker value="13:45" />
// @ts-expect-error Native root refs are actual View instances.
export const InvalidRef = <TimePicker ref={createRef<{ tagName: string }>()} />
// @ts-expect-error Native styles do not accept CSS units.
export const InvalidStyle = <TimePicker customStyles={{ fontSize: "1rem" }} />
// @ts-expect-error The source supports only 12/24-hour cycles.
export const InvalidCycle = <TimePicker hourCycle={13} />
// @ts-expect-error Native components do not expose DOM class plumbing.
export const InvalidClass = <TimePicker className="clock" />
