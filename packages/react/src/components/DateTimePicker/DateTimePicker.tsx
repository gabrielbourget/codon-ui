"use client"

import { type FC, type ForwardedRef, forwardRef } from "react"
import type { DateValue } from "react-aria-components"
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as DateTimePickerAdobe,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
} from "react-aria-components"

import Button from "../Button/Button"

import {
  DateTimePickerDefaultChevronLeftIcon,
  DateTimePickerDefaultChevronRightIcon,
} from "./DefaultDateTimePickerIcons"
import { type TDateTimePickerProps, calibrateComponent } from "./helpers"
import { resolveDateTimePickerLabels } from "./labels"

const DateTimePicker: FC<TDateTimePickerProps<DateValue>> = forwardRef(
  <T extends DateValue>(props: TDateTimePickerProps<T>, forwardedRef: ForwardedRef<HTMLDivElement>) => {
    const {
      isDisabled,
      isReadOnly,
      customStyles,
      className,
      style,
      isOpen,
      onOpenChange,
      placement,
      dayLength = "narrow",
      hourCycle = 24,
      shouldForceLeadingZeros = true,
      multiMonth = true,
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
    const resolvedLabels = resolveDateTimePickerLabels(labels)

    const {
      dateTimePickerStyles,
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
      customTriggerButtonStyles,
      customDateInputStyles,
      customCalendarPrevBtnStyles,
      customCalendarNextBtnStyles,
      calendarButtonIconColor,
      ComponentIcon,
      dateTimePickerStyle,
    } = calibrateComponent(props)

    return (
      <DateTimePickerAdobe
        {...rest}
        ref={forwardedRef}
        isDisabled={isDisabled}
        isReadOnly={isReadOnly}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        hourCycle={hourCycle}
        shouldForceLeadingZeros={shouldForceLeadingZeros}
        className={dateTimePickerStyles}
        style={dateTimePickerStyle}
        data-testid={dataTestID ?? "datetime-picker"}
      >
        <Group
          className={inputButtonGroupStyles}
          style={customInputButtonGroupStyles}
          aria-label={resolvedLabels.inputButtonGroupAriaLabel}
        >
          <DateInput className={dateTimeInputStyles} style={customDateInputStyles} data-testid="datetime-picker-input">
            {(segment) => <DateSegment className={dateTimeSegmentStyles} segment={segment} data-textsize-target />}
          </DateInput>
          <Button
            aria-haspopup="dialog"
            geometry="rounded"
            raised={false}
            data-triggerbutton
            aria-label={resolvedLabels.triggerButtonAriaLabel}
            customStyles={customTriggerButtonStyles}
          >
            {ComponentIcon}
          </Button>
        </Group>
        <Popover
          className={popoverStyles}
          style={customPopoverStyles}
          offset={5}
          placement={placement}
          data-testid="datetime-picker-popover"
        >
          <Dialog style={customDialogStyles} className={dialogStyles}>
            <Calendar
              style={customCalendarStyles}
              className={calendarStyles}
              visibleDuration={multiMonth ? { months: 2 } : undefined}
              aria-label={resolvedLabels.calendarAriaLabel}
              data-testid="datetime-picker-calendar"
            >
              <header className={calendarTopRowStyles}>
                <Button
                  slot="previous"
                  customStyles={customCalendarPrevBtnStyles}
                  raised={false}
                  data-calendarprevbtn
                  data-testid="datetime-picker-prev-btn"
                >
                  <DateTimePickerDefaultChevronLeftIcon size={15} color={calendarButtonIconColor} />
                </Button>
                <Heading
                  style={customCalendarHeaderStyles}
                  className={calendarHeaderStyles}
                  data-textsize-target
                  data-testid="datetime-picker-calendar-heading"
                />
                <Button
                  slot="next"
                  customStyles={customCalendarNextBtnStyles}
                  raised={false}
                  data-calendarnextbtn
                  data-testid="datetime-picker-next-btn"
                >
                  <DateTimePickerDefaultChevronRightIcon size={15} color={calendarButtonIconColor} />
                </Button>
              </header>
              <div className={calendarRowStyles}>
                <CalendarGrid
                  style={customCalendarGridStyles}
                  className={calendarGridStyles}
                  weekdayStyle={dayLength}
                  data-testid="datetime-picker-calendar-grid"
                >
                  <CalendarGridHeader
                    className={calendarGridHeaderStyles}
                    style={customCalendarGridHeaderStyles}
                    data-textsize-target
                    data-testid="datetime-picker-calendar-header"
                  >
                    {(day) => (
                      <CalendarHeaderCell
                        className={calendarGridHeaderCellStyles}
                        style={customCalendarGridHeaderCellStyles}
                        data-textsize-target
                        data-testid="datetime-picker-calendar-header-cell"
                      >
                        {day}
                      </CalendarHeaderCell>
                    )}
                  </CalendarGridHeader>
                  <CalendarGridBody
                    className={calendarGridBodyStyles}
                    style={customCalendarGridBodyStyles}
                    data-textsize-target
                    data-testid="datetime-picker-calendar-body"
                  >
                    {(date) => (
                      <CalendarCell
                        date={date}
                        style={customCalendarGridBodyCellStyles}
                        className={calendarGridBodyCellStyles}
                        data-textsize-target
                        data-testid="datetime-picker-calendar-body-cell"
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
                  >
                    <CalendarGridHeader className={calendarGridHeaderStyles} style={customCalendarGridHeaderStyles}>
                      {(day) => (
                        <CalendarHeaderCell
                          className={calendarGridHeaderCellStyles}
                          style={customCalendarGridHeaderCellStyles}
                        >
                          {day}
                        </CalendarHeaderCell>
                      )}
                    </CalendarGridHeader>
                    <CalendarGridBody className={calendarGridBodyStyles} style={customCalendarGridBodyStyles}>
                      {(date) => (
                        <CalendarCell
                          date={date}
                          style={customCalendarGridBodyCellStyles}
                          className={calendarGridBodyCellStyles}
                        />
                      )}
                    </CalendarGridBody>
                  </CalendarGrid>
                ) : undefined}
              </div>
            </Calendar>
          </Dialog>
        </Popover>
      </DateTimePickerAdobe>
    )
  },
)

DateTimePicker.displayName = "DateTimePicker"

export default DateTimePicker
