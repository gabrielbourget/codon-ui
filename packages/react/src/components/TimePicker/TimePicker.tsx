"use client"

import { type FC, type ForwardedRef, forwardRef } from "react"
import { DateInput, DateSegment, Group, TimeField as TimePickerAdobe, type TimeValue } from "react-aria-components"

import { type TTimePickerProps, calibrateComponent } from "./helpers"
import { resolveTimePickerLabels } from "./labels"

const TimePicker: FC<TTimePickerProps<TimeValue>> = forwardRef(
  <T extends TimeValue>(props: TTimePickerProps<T>, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      isDisabled,
      isReadOnly,
      shouldForceLeadingZeros = true,
      hourCycle = 24,
      textSize,
      geometry,
      granularity,
      enableFocusStyle,
      offsetFocusRing,
      errorState,
      warningState,
      successState,
      ComponentIcon: ComponentIcon__props,
      customInputIconGroupStyles,
      customStyles: customStyles__props,
      customInputStyles,
      className,
      style,
      labels,
      "data-testid": dataTestID,
      ...rest
    } = props
    const resolvedLabels = resolveTimePickerLabels(labels)

    const {
      timePickerStyles,
      timeInputStyles,
      timeSegmentStyles,
      inputIconGroupStyles,
      timePickerStyle,
      customTimeInputStyles,
      ComponentIcon,
    } = calibrateComponent(props)

    return (
      <TimePickerAdobe
        {...rest}
        ref={forwardedRef}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        hourCycle={hourCycle}
        granularity={granularity}
        className={timePickerStyles}
        style={timePickerStyle}
        data-testid={dataTestID ?? "time-picker"}
      >
        <Group
          className={inputIconGroupStyles}
          style={customInputIconGroupStyles}
          aria-label={resolvedLabels.inputIconGroupAriaLabel}
        >
          <DateInput className={timeInputStyles} style={customTimeInputStyles}>
            {(segment) => <DateSegment className={timeSegmentStyles} segment={segment} />}
          </DateInput>
          {ComponentIcon}
        </Group>
      </TimePickerAdobe>
    )
  },
)

TimePicker.displayName = "TimePicker"

export default TimePicker
