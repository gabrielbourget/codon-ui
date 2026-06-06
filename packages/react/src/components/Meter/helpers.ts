import classNames from "classnames"
import type { CSSProperties } from "react"
import { type MeterProps, type MeterRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./MeterStyles.module.css"

const COMPONENT__TRACK = "track"
const COMPONENT__BAR = "bar"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const METER_COMPONENTS = [COMPONENT__TRACK, COMPONENT__BAR]
type TMeterComponents = (typeof METER_COMPONENTS)[number]

export const METER_DIRECTION__LEFT = "left"
export const METER_DIRECTION__RIGHT = "right"
export const METER_DIRECTION__UP = "up"
export const METER_DIRECTION__DOWN = "down"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const METER_DIRECTIONS = [METER_DIRECTION__LEFT, METER_DIRECTION__RIGHT, METER_DIRECTION__UP, METER_DIRECTION__DOWN]
type TMeterDirections = (typeof METER_DIRECTIONS)[number]

export const METER_ORIENTATION__HORIZONTAL = "horizontal"
export const METER_ORIENTATION__VERTICAL = "vertical"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const METER_ORIENTATIONS = [METER_ORIENTATION__HORIZONTAL, METER_ORIENTATION__VERTICAL]
type TMeterOrientations = (typeof METER_ORIENTATIONS)[number]

export type TMeterProps = MeterProps & {
  "data-testid"?: string
  value: number
  height?: number | string
  width?: number | string
  barColor?: string
  trackColor?: string
  raised?: boolean
  direction?: TMeterDirections
  orientation?: TMeterOrientations
  trackGeometry?: TCornerGeometry
  barGeometry?: TCornerGeometry
  order?: TThemingOrderCode
  customStyles?: CSSProperties
  customBarStyles?: CSSProperties
  customTrackStyles?: CSSProperties
}

type TMeterClassNameRenderProps = MeterRenderProps & {
  defaultClassName: string | undefined
}

type TMeterStyleRenderProps = MeterRenderProps & {
  defaultStyle: CSSProperties
}

type TMeterCalibration = {
  meterStyles: TMeterProps["className"]
  meterStyle: TMeterProps["style"]
  trackStyles: string
  barStyles: string
  computedCustomBarStyles: CSSProperties
  computedCustomTrackStyles: CSSProperties
}

const mergeMeterClassNames = (
  computedClassName: string,
  classNameProp: MeterProps["className"],
): MeterProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TMeterClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeMeterStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeMeterStyle = (computedStyles: CSSProperties, styleProp: MeterProps["style"]): MeterProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TMeterStyleRenderProps) => mergeMeterStyles(computedStyles, styleProp(styleProps))
  }

  return mergeMeterStyles(computedStyles, styleProp)
}

const computeBarColorStyle = (props: TMeterProps) => {
  let { barColor } = props
  const { order } = props
  if (barColor) barColor = barColor.toLowerCase().trim()

  let backgroundColorStyle: string | undefined = undefined

  if (barColor) return

  if (!order) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      backgroundColorStyle = styles["meter__bar--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      backgroundColorStyle = styles["meter__bar--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      backgroundColorStyle = styles["meter__bar--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      backgroundColorStyle = styles["meter__bar--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      backgroundColorStyle = styles["meter__bar--quintenary"]
      break
    default:
      backgroundColorStyle = styles["meter__bar--primary"]
      break
  }

  return backgroundColorStyle
}

const computeGeometryStyle = (props: TMeterProps, component: TMeterComponents) => {
  const { trackGeometry = ROUND, barGeometry = ROUND } = props
  const computedProp = component === COMPONENT__TRACK ? trackGeometry : barGeometry

  switch (computedProp) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return component === COMPONENT__TRACK ? styles["meter__track--rounded"] : styles["meter__bar--rounded"]
    case ROUND:
      return component === COMPONENT__TRACK ? styles["meter__track--round"] : styles["meter__bar--round"]
    default:
      return undefined
  }
}

const computeOrientationAndDirectionStyle = (props: TMeterProps) => {
  const { orientation = METER_ORIENTATION__HORIZONTAL, direction = METER_DIRECTION__RIGHT } = props
  let orientationStyle, directionStyle

  if (orientation === METER_ORIENTATION__HORIZONTAL) {
    orientationStyle = styles["meter--horizontal"]

    // Right direction works by default. Up and down direction are invalid
    //    while the meter's orientation is horizontal.
    if (direction === METER_DIRECTION__LEFT) directionStyle = styles["meter--dirLeft"]
  } else {
    orientationStyle = styles["meter--vertical"]

    // Up direction works by default. Right and left direction are invalid
    //    while the meter's orientation is vertical.
    if (direction === METER_DIRECTION__DOWN) directionStyle = styles["meter--dirDown"]
  }

  return { orientationStyle, directionStyle }
}

export const calibrateComponent = (props: TMeterProps): TMeterCalibration => {
  const { meter, meter__track, meter__bar } = styles
  const {
    trackColor,
    barColor,
    height,
    width,
    raised,
    customStyles,
    customTrackStyles,
    customBarStyles,
    className,
    style,
  } = props

  const trackGeometryStyle = computeGeometryStyle(props, "track")
  const barGeometryStyle = computeGeometryStyle(props, "bar")
  const barColorStyle = computeBarColorStyle(props)
  const { orientationStyle, directionStyle } = computeOrientationAndDirectionStyle(props)
  const raisedStyle = raised !== undefined && raised === true ? styles["meter__track--raised"] : undefined

  const computedMeterStyles = classNames(meter, orientationStyle, directionStyle)
  const meterStyles = mergeMeterClassNames(computedMeterStyles, className)
  const meterStyle = computeMeterStyle({ ...customStyles }, style)
  const trackStyles = classNames(meter__track, raisedStyle, trackGeometryStyle)
  const barStyles = classNames(meter__bar, barGeometryStyle, barColorStyle)

  const computedCustomTrackStyles = Object.assign(
    { backgroundColor: trackColor, height, width },
    { ...customTrackStyles },
  )
  const computedCustomBarStyles = Object.assign({ backgroundColor: barColor }, { ...customBarStyles })

  return {
    meterStyles,
    meterStyle,
    trackStyles,
    barStyles,
    computedCustomBarStyles,
    computedCustomTrackStyles,
  }
}
