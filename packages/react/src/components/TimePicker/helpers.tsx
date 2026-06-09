import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import { type DateFieldRenderProps, type TimeFieldProps, type TimeValue } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import textStyles from "../Text/TextStyles.module.css"

import TimePickerDefaultClockIcon from "./DefaultClockIcon"
import type { TPartialTimePickerLabels } from "./labels"
import styles from "./TimePickerStyles.module.css"

export const TIME_PICKER_SIZE__SM = "small"
export const TIME_PICKER_SIZE__MD = "medium"
export const TIME_PICKER_SIZE__LG = "large"

export const AVAILABLE_TIMEPICKER_TEXT_SIZES = [TIME_PICKER_SIZE__SM, TIME_PICKER_SIZE__MD, TIME_PICKER_SIZE__LG]
type TAvailableTimePickerTextSizes = (typeof AVAILABLE_TIMEPICKER_TEXT_SIZES)[number]

type TAvailableHourCycles = 12 | 24
type TAvailableTimeGranularities = "hour" | "minute" | "second"

export type TTimePickerProps<T extends TimeValue> = TimeFieldProps<T> & {
  "data-testid"?: string
  height?: string | number
  width?: string | number
  textSize?: TAvailableTimePickerTextSizes
  geometry?: TCornerGeometry
  hourCycle?: TAvailableHourCycles
  granularity?: TAvailableTimeGranularities
  shouldForceLeadingZeros?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  labels?: TPartialTimePickerLabels
  customStyles?: CSSProperties
  customInputIconGroupStyles?: CSSProperties
  customInputStyles?: CSSProperties
}

type TTimePickerClassNameRenderProps = DateFieldRenderProps & {
  defaultClassName: string | undefined
}

type TTimePickerStyleRenderProps = DateFieldRenderProps & {
  defaultStyle: CSSProperties
}

type TTimePickerCalibration<T extends TimeValue> = {
  timePickerStyles: TTimePickerProps<T>["className"]
  timePickerStyle: TTimePickerProps<T>["style"]
  timeInputStyles: string
  inputIconGroupStyles: string
  timeSegmentStyles: string
  customStyles: CSSProperties
  customTimeInputStyles: CSSProperties
  ComponentIcon: ReactNode
}

const mergeTimePickerClassNames = <T extends TimeValue>(
  computedClassName: string,
  classNameProp: TimeFieldProps<T>["className"],
): TimeFieldProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TTimePickerClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeTimePickerStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeTimePickerStyle = <T extends TimeValue>(
  computedStyles: CSSProperties,
  styleProp: TimeFieldProps<T>["style"],
): TimeFieldProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TTimePickerStyleRenderProps) => mergeTimePickerStyles(computedStyles, styleProp(styleProps))
  }

  return mergeTimePickerStyles(computedStyles, styleProp)
}

const computeGeometryStyle = <T extends TimeValue>(props: TTimePickerProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["inputIconGroup--rounded"]
    case ROUND:
      return styles["inputIconGroup--round"]
    default:
      return undefined
  }
}

const computeTextSizeStyle = <T extends TimeValue>(props: TTimePickerProps<T>) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case TIME_PICKER_SIZE__SM:
      textSizeStyle = b11
      break
    case TIME_PICKER_SIZE__MD:
      textSizeStyle = b10
      break
    case TIME_PICKER_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeTimePickerBorderStyle = <T extends TimeValue>(props: TTimePickerProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle: string | undefined = undefined

  if (errorState) {
    borderStyle = styles["inputIconGroup--errorState"]
    return borderStyle
  }

  if (warningState) {
    borderStyle = styles["inputIconGroup--warningState"]
    return borderStyle
  }

  if (successState) {
    borderStyle = styles["inputIconGroup--successState"]
    return borderStyle
  }

  return borderStyle
}

export const calibrateComponent = <T extends TimeValue>(props: TTimePickerProps<T>): TTimePickerCalibration<T> => {
  const { timePicker, inputIconGroup, timeInput, timeSegment } = styles
  const {
    height,
    width,
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    customStyles: customStyles__props,
    customInputStyles,
    className,
    style,
  } = props
  let { ComponentIcon } = props

  if (!ComponentIcon) ComponentIcon = <TimePickerDefaultClockIcon size={15} />

  const geometryStyle = computeGeometryStyle(props)
  const textSizeStyle = computeTextSizeStyle(props)
  const timePickerBorderStyle = computeTimePickerBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["inputIconGroup--noFocusStyle"]
      : styles["inputIconGroup--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["inputIconGroup--offsetFocusRing"] : undefined

  const computedTimePickerStyles = classNames(timePicker)
  const timePickerStyles = mergeTimePickerClassNames(computedTimePickerStyles, className)
  const inputIconGroupStyles = classNames(
    inputIconGroup,
    timePickerBorderStyle,
    geometryStyle,
    focusStyle,
    offsetFocusRingStyle,
  )
  const timeInputStyles = classNames(timeInput)
  const timeSegmentStyles = classNames(timeSegment, textSizeStyle)

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const timePickerStyle = computeTimePickerStyle(customStyles, style)

  const customTimeInputStyles = Object.assign(
    {},
    { border: "none", backgroundColor: "transparent" },
    { ...customInputStyles },
  )

  return {
    timeInputStyles,
    inputIconGroupStyles,
    timePickerStyles,
    timeSegmentStyles,
    customStyles,
    timePickerStyle,
    customTimeInputStyles,
    ComponentIcon,
  }
}
