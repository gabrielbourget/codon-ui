"use client"

import { type FC, type ForwardedRef, forwardRef } from "react"
import type { DateValue } from "react-aria-components"
import {
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DateRangePicker as DateTimeRangePickerAdobe,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  RangeCalendar,
} from "react-aria-components"

import Button from "../Button/Button"

import {
  DateTimeRangePickerDefaultChevronLeftIcon,
  DateTimeRangePickerDefaultChevronRightIcon,
} from "./DefaultDateTimeRangePickerIcons"
import { type TDateTimeRangePickerProps, calibrateComponent } from "./helpers"
import { resolveDateTimeRangePickerLabels } from "./labels"

const DateTimeRangePicker: FC<TDateTimeRangePickerProps<DateValue>> = forwardRef(
  <T extends DateValue>(props: TDateTimeRangePickerProps<T>, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      isDisabled,
      isReadOnly,
      customStyles,
      className,
      style,
      isOpen,
      placement,
      dayLength = "narrow",
      onChange,
      hourCycle = 24,
      shouldForceLeadingZeros = true,
      multiMonth = false,
      textSize,
      geometry,
      enableFocusStyle,
      offsetFocusRing,
      errorState,
      warningState,
      successState,
      ComponentIcon: ComponentIcon__props,
      customInputStyles,
      customButtonStyles,
      customInputButtonGroupStyles,
      customDialogStyles,
      customPopoverStyles,
      customCalendarStyles,
      customCalendarHeaderStyles,
      customCalendarPrevBtnStyles: customCalendarPrevBtnStyles__props,
      customCalendarNextBtnStyles: customCalendarNextBtnStyles__props,
      customCalendarGridStyles,
      customCalendarGridHeaderStyles,
      customCalendarGridHeaderCellStyles,
      customCalendarGridBodyStyles,
      customCalendarGridBodyCellStyles,
      labels,
      "data-testid": dataTestID,
      ...rest
    } = props
    const resolvedLabels = resolveDateTimeRangePickerLabels(labels)

    const {
      dateTimeRangePickerStyles,
      inputButtonGroupStyles,
      dateTimeInputStyles,
      dateTimeSegmentStyles,
      popoverStyles,
      dialogStyles,
      calendarRowStyles,
      calendarStyles,
      calendarTopRowStyles,
      calendarHeaderStyles,
      calendarGridStyles,
      calendarGridHeaderStyles,
      calendarGridHeaderCellStyles,
      calendarGridBodyStyles,
      calendarGridBodyCellStyles,
      computedCustomTriggerButtonStyles,
      computedCustomDateInputStyles,
      computedCustomCalendarPrevBtnStyles,
      computedCustomCalendarNextBtnStyles,
      calendarButtonIconColor,
      ComponentIcon,
      dateTimeRangePickerStyle,
    } = calibrateComponent(props)

    return (
      <DateTimeRangePickerAdobe
        {...rest}
        style={dateTimeRangePickerStyle}
        className={dateTimeRangePickerStyles}
        ref={forwardedRef}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        isOpen={isOpen}
        onChange={onChange}
        hourCycle={hourCycle}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        data-testid={dataTestID ?? "datetime-range-picker"}
      >
        <Group
          className={inputButtonGroupStyles}
          style={customInputButtonGroupStyles}
          aria-label={resolvedLabels.inputButtonGroupAriaLabel}
        >
          <DateInput
            slot="start"
            className={dateTimeInputStyles}
            style={computedCustomDateInputStyles}
            data-testid="datetime-range-picker-input"
          >
            {(segment) => <DateSegment className={dateTimeSegmentStyles} segment={segment} data-textsize-target />}
          </DateInput>
          <span aria-hidden="true">–</span>
          <DateInput
            slot="end"
            className={dateTimeInputStyles}
            style={computedCustomDateInputStyles}
            data-testid="datetime-range-picker-input"
          >
            {(segment) => <DateSegment className={dateTimeSegmentStyles} segment={segment} data-textsize-target />}
          </DateInput>
          <Button
            aria-haspopup="dialog"
            geometry="rounded"
            raised={false}
            data-triggerbutton
            aria-label={resolvedLabels.triggerButtonAriaLabel}
            customStyles={computedCustomTriggerButtonStyles}
          >
            {ComponentIcon}
          </Button>
        </Group>
        <Popover
          className={popoverStyles}
          style={customPopoverStyles}
          offset={5}
          placement={placement}
          data-testid="datetime-range-picker-popover"
        >
          <Dialog style={customDialogStyles} className={dialogStyles}>
            <RangeCalendar
              style={customCalendarStyles}
              className={calendarStyles}
              visibleDuration={multiMonth ? { months: 2 } : undefined}
              aria-label={resolvedLabels.calendarAriaLabel}
              data-testid="datetime-range-picker-calendar"
            >
              <header className={calendarTopRowStyles}>
                <Button
                  slot="previous"
                  customStyles={computedCustomCalendarPrevBtnStyles}
                  raised={false}
                  data-calendarprevbtn
                  data-testid="datetime-range-picker-prev-btn"
                >
                  <DateTimeRangePickerDefaultChevronLeftIcon size={15} color={calendarButtonIconColor} />
                </Button>
                <Heading
                  style={customCalendarHeaderStyles}
                  className={calendarHeaderStyles}
                  data-textsize-target
                  data-testid="datetime-range-picker-calendar-heading"
                />
                <Button
                  slot="next"
                  customStyles={computedCustomCalendarNextBtnStyles}
                  raised={false}
                  data-calendarnextbtn
                  data-testid="datetime-range-picker-next-btn"
                >
                  <DateTimeRangePickerDefaultChevronRightIcon size={15} color={calendarButtonIconColor} />
                </Button>
              </header>
              <div className={calendarRowStyles}>
                <CalendarGrid
                  style={customCalendarGridStyles}
                  className={calendarGridStyles}
                  weekdayStyle={dayLength}
                  data-testid="datetime-range-picker-calendar-grid"
                >
                  <CalendarGridHeader
                    className={calendarGridHeaderStyles}
                    style={customCalendarGridHeaderStyles}
                    data-textsize-target
                    data-testid="datetime-range-picker-calendar-header"
                  >
                    {(day) => (
                      <CalendarHeaderCell
                        className={calendarGridHeaderCellStyles}
                        style={customCalendarGridHeaderCellStyles}
                        data-textsize-target
                        data-testid="datetime-range-picker-calendar-header-cell"
                      >
                        {day}
                      </CalendarHeaderCell>
                    )}
                  </CalendarGridHeader>
                  <CalendarGridBody
                    className={calendarGridBodyStyles}
                    style={customCalendarGridBodyStyles}
                    data-textsize-target
                    data-testid="datetime-range-picker-calendar-body"
                  >
                    {(date) => (
                      <CalendarCell
                        date={date}
                        style={customCalendarGridBodyCellStyles}
                        className={calendarGridBodyCellStyles}
                        data-textsize-target
                        data-testid="datetime-range-picker-calendar-body-cell"
                      />
                    )}
                  </CalendarGridBody>
                </CalendarGrid>
                {multiMonth ? (
                  <CalendarGrid
                    style={customCalendarGridStyles}
                    className={calendarGridStyles}
                    weekdayStyle={dayLength}
                    offset={{ months: 1 }}
                    data-testid="datetime-range-picker-calendar-grid"
                  >
                    <CalendarGridHeader
                      className={calendarGridHeaderStyles}
                      style={customCalendarGridHeaderStyles}
                      data-textsize-target
                      data-testid="datetime-range-picker-calendar-header"
                    >
                      {(day) => (
                        <CalendarHeaderCell
                          className={calendarGridHeaderCellStyles}
                          style={customCalendarGridHeaderCellStyles}
                          data-textsize-target
                          data-testid="datetime-range-picker-calendar-header-cell"
                        >
                          {day}
                        </CalendarHeaderCell>
                      )}
                    </CalendarGridHeader>
                    <CalendarGridBody
                      className={calendarGridBodyStyles}
                      style={customCalendarGridBodyStyles}
                      data-textsize-target
                      data-testid="datetime-range-picker-calendar-body"
                    >
                      {(date) => (
                        <CalendarCell
                          date={date}
                          style={customCalendarGridBodyCellStyles}
                          className={calendarGridBodyCellStyles}
                          data-textsize-target
                          data-testid="datetime-range-picker-calendar-body-cell"
                        />
                      )}
                    </CalendarGridBody>
                  </CalendarGrid>
                ) : undefined}
              </div>
            </RangeCalendar>
          </Dialog>
        </Popover>
      </DateTimeRangePickerAdobe>
    )
  },
)

export default DateTimeRangePicker
