import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { DateRangePickerProps, DateRangePickerRenderProps, DateValue } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"
import textStyles from "../Text/TextStyles.module.css"

import calendarStyleModules from "./CalendarStyles.module.css"
import styles from "./DateTimeRangePickerStyles.module.css"
import { DateTimeRangePickerDefaultCalendarIcon } from "./DefaultDateTimeRangePickerIcons"
import type { TPartialDateTimeRangePickerLabels } from "./labels"

export const DATETIME_RANGE_PICKER_SIZE__SM = "small"
export const DATETIME_RANGE_PICKER_SIZE__MD = "medium"
export const DATETIME_RANGE_PICKER_SIZE__LG = "large"

export const AVAILABLE_DATETIMERANGEPICKER_TEXT_SIZES = [
  DATETIME_RANGE_PICKER_SIZE__SM,
  DATETIME_RANGE_PICKER_SIZE__MD,
  DATETIME_RANGE_PICKER_SIZE__LG,
]
export type TAvailableDateTimeRangePickerTextSizes = (typeof AVAILABLE_DATETIMERANGEPICKER_TEXT_SIZES)[number]

type TAvailableDayLengths = "narrow" | "short" | "long"
type TAvailableHourCycles = 12 | 24
type TAvailableTimeGranularities = "day" | "hour" | "minute" | "second"

export type TDateTimeRangePickerProps<T extends DateValue> = DateRangePickerProps<T> & {
  "data-testid"?: string
  textSize?: TAvailableDateTimeRangePickerTextSizes
  geometry?: TCornerGeometry
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  placement?: TAvailablePopoverPlacementPositions
  multiMonth?: boolean
  dayLength?: TAvailableDayLengths
  hourCycle?: TAvailableHourCycles
  granularity?: TAvailableTimeGranularities
  shouldForceLeadingZeros?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  labels?: TPartialDateTimeRangePickerLabels
  customStyles?: CSSProperties
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
  customInputButtonGroupStyles?: CSSProperties
  customPopoverStyles?: CSSProperties
  customDialogStyles?: CSSProperties
  customCalendarStyles?: CSSProperties
  customCalendarHeaderStyles?: CSSProperties
  customCalendarPrevBtnStyles?: CSSProperties
  customCalendarNextBtnStyles?: CSSProperties
  customCalendarGridStyles?: CSSProperties
  customCalendarGridHeaderStyles?: CSSProperties
  customCalendarGridHeaderCellStyles?: CSSProperties
  customCalendarGridBodyStyles?: CSSProperties
  customCalendarGridBodyCellStyles?: CSSProperties
}

type TDateTimeRangePickerClassNameRenderProps = DateRangePickerRenderProps & {
  defaultClassName: string | undefined
}

type TDateTimeRangePickerStyleRenderProps = DateRangePickerRenderProps & {
  defaultStyle: CSSProperties
}

type TDateTimeRangePickerCalibration<T extends DateValue> = {
  dateTimeRangePickerStyles: TDateTimeRangePickerProps<T>["className"]
  dateTimeRangePickerStyle: TDateTimeRangePickerProps<T>["style"]
  inputButtonGroupStyles: string
  dateTimeInputStyles: string
  dateTimeSegmentStyles: string
  popoverStyles: string
  dialogStyles: string
  calendarRowStyles: string
  calendarStyles: string
  calendarTopRowStyles: string
  calendarHeaderStyles: string
  calendarGridStyles: string
  calendarGridHeaderStyles: string
  calendarGridHeaderCellStyles: string
  calendarGridBodyStyles: string
  calendarGridBodyCellStyles: string
  computedCustomTriggerButtonStyles: CSSProperties
  computedCustomDateInputStyles: CSSProperties
  computedCustomCalendarPrevBtnStyles: CSSProperties
  computedCustomCalendarNextBtnStyles: CSSProperties
  calendarButtonIconColor: string
  ComponentIcon: ReactNode
}

const mergeDateTimeRangePickerClassNames = <T extends DateValue>(
  computedClassName: string,
  classNameProp: DateRangePickerProps<T>["className"],
): DateRangePickerProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TDateTimeRangePickerClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeDateTimeRangePickerStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeDateTimeRangePickerStyle = <T extends DateValue>(
  computedStyles: CSSProperties,
  styleProp: DateRangePickerProps<T>["style"],
): DateRangePickerProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TDateTimeRangePickerStyleRenderProps) =>
      mergeDateTimeRangePickerStyles(computedStyles, styleProp(styleProps))
  }

  return mergeDateTimeRangePickerStyles(computedStyles, styleProp)
}

const computeGeometryStyle = <T extends DateValue>(props: TDateTimeRangePickerProps<T>) => {
  const { geometry = ROUNDED } = props
  let inputButtonGroupGeometryStyle: string | undefined
  let popoverGeometryStyle: string | undefined
  let dialogGeometryStyle: string | undefined

  switch (geometry) {
    case ORTHOGONAL:
      break
    case ROUNDED:
      inputButtonGroupGeometryStyle = styles["inputButtonGroup--rounded"]
      popoverGeometryStyle = styles["popover--rounded"]
      dialogGeometryStyle = styles["dialog--rounded"]
      break
    case ROUND:
      inputButtonGroupGeometryStyle = styles["inputButtonGroup--round"]
      popoverGeometryStyle = styles["popover--rounded"]
      dialogGeometryStyle = styles["dialog--rounded"]
      break
    default:
      inputButtonGroupGeometryStyle = styles["inputButtonGroup--rounded"]
      popoverGeometryStyle = styles["popover--rounded"]
      dialogGeometryStyle = styles["dialog--rounded"]
      break
  }

  return { inputButtonGroupGeometryStyle, popoverGeometryStyle, dialogGeometryStyle }
}

const computeTextSizeStyle = <T extends DateValue>(props: TDateTimeRangePickerProps<T>) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case DATETIME_RANGE_PICKER_SIZE__SM:
      textSizeStyle = b11
      break
    case DATETIME_RANGE_PICKER_SIZE__MD:
      textSizeStyle = b10
      break
    case DATETIME_RANGE_PICKER_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeDateTimeRangePickerBorderStyle = <T extends DateValue>(props: TDateTimeRangePickerProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle: string | undefined = undefined

  if (errorState) {
    borderStyle = styles["inputButtonGroup--errorState"]
    return borderStyle
  }

  if (warningState) {
    borderStyle = styles["inputButtonGroup--warningState"]
    return borderStyle
  }

  if (successState) {
    borderStyle = styles["inputButtonGroup--successState"]
    return borderStyle
  }

  return borderStyle
}

export const calibrateComponent = <T extends DateValue>(
  props: TDateTimeRangePickerProps<T>,
): TDateTimeRangePickerCalibration<T> => {
  const {
    dateTimePicker: dateTimeRangePicker,
    dateTimePicker__calendarRow: dateTimeRangePicker__calendarRow,
    inputButtonGroup,
    dateTimeInput,
    dateTimeSegment,
    popover,
    dialog,
  } = styles
  const {
    calendar,
    calendar__topRow,
    calendar__header,
    calendar__grid,
    calendar__grid__header,
    calendar__grid__header__cell,
    calendar__grid__body,
    calendar__grid__body__cell,
  } = calendarStyleModules
  const {
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    customInputStyles,
    customButtonStyles,
    customCalendarPrevBtnStyles,
    customCalendarNextBtnStyles,
    customStyles,
    className,
    style,
  } = props
  let { ComponentIcon } = props

  if (!ComponentIcon) ComponentIcon = <DateTimeRangePickerDefaultCalendarIcon size={15} />

  const { inputButtonGroupGeometryStyle, popoverGeometryStyle, dialogGeometryStyle } = computeGeometryStyle(props)
  const textSizeStyle = computeTextSizeStyle(props)
  const dateTimeRangePickerBorderStyle = computeDateTimeRangePickerBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["inputButtonGroup--noFocusStyle"]
      : styles["inputButtonGroup--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["inputButtonGroup--offsetFocusRing"] : undefined

  const computedDateTimeRangePickerStyles = classNames(dateTimeRangePicker)
  const dateTimeRangePickerStyles = mergeDateTimeRangePickerClassNames(computedDateTimeRangePickerStyles, className)
  const dateTimeRangePickerStyle = computeDateTimeRangePickerStyle(customStyles ?? {}, style)
  const inputButtonGroupStyles = classNames(
    inputButtonGroup,
    dateTimeRangePickerBorderStyle,
    inputButtonGroupGeometryStyle,
    focusStyle,
    offsetFocusRingStyle,
  )
  const dateTimeInputStyles = classNames(dateTimeInput, textSizeStyle)
  const dateTimeSegmentStyles = classNames(dateTimeSegment, textSizeStyle)
  const popoverStyles = classNames(popover, popoverGeometryStyle)
  const dialogStyles = classNames(dialog, dialogGeometryStyle)
  const calendarRowStyles = classNames(dateTimeRangePicker__calendarRow)
  const calendarStyles = classNames(calendar)
  const calendarTopRowStyles = classNames(calendar__topRow)
  const calendarHeaderStyles = classNames(calendar__header, textSizeStyle, textStyles["fw-bold"])
  const calendarGridStyles = classNames(calendar__grid)
  const calendarGridHeaderStyles = classNames(calendar__grid__header, textSizeStyle)
  const calendarGridHeaderCellStyles = classNames(calendar__grid__header__cell, textSizeStyle, textStyles["fw-bold"])
  const calendarGridBodyStyles = classNames(calendar__grid__body, textSizeStyle)
  const calendarGridBodyCellStyles = classNames(calendar__grid__body__cell, textSizeStyle)

  const computedCustomTriggerButtonStyles = Object.assign(
    {
      border: "none",
      backgroundColor: "transparent",
      paddingLeft: 1.5,
    },
    { ...customButtonStyles },
  )

  const computedCustomDateInputStyles = Object.assign(
    {},
    {
      border: "none",
      backgroundColor: "transparent",
    },
    { ...customInputStyles },
  )

  const computedCustomCalendarPrevBtnStyles = Object.assign(
    {
      justifyContent: "flex-start",
      padding: 1.5,
    },
    { ...customCalendarPrevBtnStyles },
  )

  const computedCustomCalendarNextBtnStyles = Object.assign(
    {
      justifyContent: "flex-end",
      padding: 1.5,
    },
    { ...customCalendarNextBtnStyles },
  )

  const calendarButtonIconColor = "currentColor"

  return {
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
  }
}
