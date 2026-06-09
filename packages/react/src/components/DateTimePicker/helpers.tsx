import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { DatePickerProps, DatePickerRenderProps, DateValue } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"
import textStyles from "../Text/TextStyles.module.css"

import calendarStyleModules from "./CalendarStyles.module.css"
import styles from "./DateTimePickerStyles.module.css"
import { DateTimePickerDefaultCalendarIcon } from "./DefaultDateTimePickerIcons"
import type { TPartialDateTimePickerLabels } from "./labels"

export const DATETIME_PICKER_SIZE__SM = "small"
export const DATETIME_PICKER_SIZE__MD = "medium"
export const DATETIME_PICKER_SIZE__LG = "large"

export const AVAILABLE_DATETIMEPICKER_TEXT_SIZES = [
  DATETIME_PICKER_SIZE__SM,
  DATETIME_PICKER_SIZE__MD,
  DATETIME_PICKER_SIZE__LG,
]
export type TAvailableDateTimePickerTextSizes = (typeof AVAILABLE_DATETIMEPICKER_TEXT_SIZES)[number]

export const DAY_LENGTH__NARROW = "narrow"
export const DAY_LENGTH__SHORT = "short"
export const DAY_LENGTH__LONG = "long"

export const AVAILABLE_DAY_LENGTHS = [DAY_LENGTH__NARROW, DAY_LENGTH__SHORT, DAY_LENGTH__LONG] as const
export type TAvailableDayLengths = (typeof AVAILABLE_DAY_LENGTHS)[number]

export const HOUR_CYCLE__12 = 12
export const HOUR_CYCLE__24 = 24

export const AVAILABLE_HOUR_CYCLES = [HOUR_CYCLE__12, HOUR_CYCLE__24] as const
export type TAvailableHourCycles = (typeof AVAILABLE_HOUR_CYCLES)[number]

export const GRANULARITY__DAY = "day"
export const GRANULARITY__HOUR = "hour"
export const GRANULARITY__MINUTE = "minute"
export const GRANULARITY__SECOND = "second"

export const AVAILABLE_TIME_GRANULARITIES = [
  GRANULARITY__DAY,
  GRANULARITY__HOUR,
  GRANULARITY__MINUTE,
  GRANULARITY__SECOND,
] as const
type TAvailableTimeGranularities = (typeof AVAILABLE_TIME_GRANULARITIES)[number]

export type TDateTimePickerProps<T extends DateValue> = DatePickerProps<T> & {
  "data-testid"?: string
  textSize?: TAvailableDateTimePickerTextSizes
  geometry?: TCornerGeometry
  multiMonth?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  placement?: TAvailablePopoverPlacementPositions
  dayLength?: TAvailableDayLengths
  hourCycle?: TAvailableHourCycles
  granularity?: TAvailableTimeGranularities
  shouldForceLeadingZeros?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  labels?: TPartialDateTimePickerLabels
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

type TDateTimePickerClassNameRenderProps = DatePickerRenderProps & {
  defaultClassName: string | undefined
}

type TDateTimePickerStyleRenderProps = DatePickerRenderProps & {
  defaultStyle: CSSProperties
}

type TDateTimePickerGeometryStyles = {
  inputButtonGroupGeometryStyle?: string
  popoverGeometryStyle?: string
  dialogGeometryStyle?: string
}

type TDateTimePickerCalibration<T extends DateValue> = {
  dateTimePickerStyles: TDateTimePickerProps<T>["className"]
  dateTimePickerStyle: TDateTimePickerProps<T>["style"]
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
  customTriggerButtonStyles: CSSProperties
  customDateInputStyles: CSSProperties
  customCalendarPrevBtnStyles: CSSProperties
  customCalendarNextBtnStyles: CSSProperties
  calendarButtonIconColor: string
  ComponentIcon: ReactNode
}

const mergeDateTimePickerClassNames = <T extends DateValue>(
  computedClassName: string,
  classNameProp: DatePickerProps<T>["className"],
): DatePickerProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TDateTimePickerClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeDateTimePickerStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeDateTimePickerStyle = <T extends DateValue>(
  computedStyles: CSSProperties,
  styleProp: DatePickerProps<T>["style"],
): DatePickerProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TDateTimePickerStyleRenderProps) =>
      mergeDateTimePickerStyles(computedStyles, styleProp(styleProps))
  }

  return mergeDateTimePickerStyles(computedStyles, styleProp)
}

const computeGeometryStyles = <T extends DateValue>(props: TDateTimePickerProps<T>): TDateTimePickerGeometryStyles => {
  const { geometry = ROUNDED } = props
  let inputButtonGroupGeometryStyle: string | undefined = undefined
  let popoverGeometryStyle: string | undefined = undefined
  let dialogGeometryStyle: string | undefined = undefined

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

const computeTextSizeStyle = <T extends DateValue>(props: TDateTimePickerProps<T>) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case DATETIME_PICKER_SIZE__SM:
      textSizeStyle = b11
      break
    case DATETIME_PICKER_SIZE__MD:
      textSizeStyle = b10
      break
    case DATETIME_PICKER_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeDateTimePickerBorderStyle = <T extends DateValue>(props: TDateTimePickerProps<T>) => {
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
  props: TDateTimePickerProps<T>,
): TDateTimePickerCalibration<T> => {
  const {
    dateTimePicker,
    dateTimePicker__calendarRow,
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
    enableFocusStyle = true,
    offsetFocusRing: offsetFocusRing__props = true,
    customInputStyles,
    customButtonStyles,
    customCalendarPrevBtnStyles: customCalendarPrevBtnStyles__props,
    customCalendarNextBtnStyles: customCalendarNextBtnStyles__props,
    customStyles,
    className,
    style,
  } = props
  let { ComponentIcon } = props

  if (!ComponentIcon) ComponentIcon = <DateTimePickerDefaultCalendarIcon size={15} />

  const { inputButtonGroupGeometryStyle, popoverGeometryStyle, dialogGeometryStyle } = computeGeometryStyles(props)
  const textSizeStyle = computeTextSizeStyle(props)
  const dateTimePickerBorderStyle = computeDateTimePickerBorderStyle(props)
  const focusStyle = enableFocusStyle
    ? styles["inputButtonGroup--applyFocusStyle"]
    : styles["inputButtonGroup--noFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props ? styles["inputButtonGroup--offsetFocusRing"] : undefined

  const computedDateTimePickerStyles = classNames(dateTimePicker)
  const dateTimePickerStyles = mergeDateTimePickerClassNames(computedDateTimePickerStyles, className)
  const dateTimePickerStyle = computeDateTimePickerStyle(customStyles ?? {}, style)
  const inputButtonGroupStyles = classNames(
    inputButtonGroup,
    dateTimePickerBorderStyle,
    inputButtonGroupGeometryStyle,
    focusStyle,
    offsetFocusRingStyle,
  )
  const dateTimeInputStyles = classNames(dateTimeInput)
  const dateTimeSegmentStyles = classNames(dateTimeSegment, textSizeStyle)
  const popoverStyles = classNames(popover, popoverGeometryStyle)
  const dialogStyles = classNames(dialog, dialogGeometryStyle)
  const calendarRowStyles = classNames(dateTimePicker__calendarRow)
  const calendarStyles = classNames(calendar)
  const calendarTopRowStyles = classNames(calendar__topRow)
  const calendarHeaderStyles = classNames(calendar__header, textSizeStyle, textStyles["fw-bold"])
  const calendarGridStyles = classNames(calendar__grid)
  const calendarGridHeaderStyles = classNames(calendar__grid__header, textSizeStyle)
  const calendarGridHeaderCellStyles = classNames(calendar__grid__header__cell, textSizeStyle, textStyles["fw-bold"])
  const calendarGridBodyStyles = classNames(calendar__grid__body, textSizeStyle)
  const calendarGridBodyCellStyles = classNames(calendar__grid__body__cell, textSizeStyle)

  const customTriggerButtonStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", paddingLeft: 1.5 },
    { ...customButtonStyles },
  )

  const customDateInputStyles = Object.assign(
    {},
    { border: "none", backgroundColor: "transparent" },
    { ...customInputStyles },
  )
  const customCalendarPrevBtnStyles = Object.assign(
    { justifyContent: "flex-start", padding: 1.5 },
    { ...customCalendarPrevBtnStyles__props },
  )
  const customCalendarNextBtnStyles = Object.assign(
    { justifyContent: "flex-end", padding: 1.5 },
    { ...customCalendarNextBtnStyles__props },
  )

  const calendarButtonIconColor = "currentColor"

  return {
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
  }
}
