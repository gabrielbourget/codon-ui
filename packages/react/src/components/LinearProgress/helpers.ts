import classNames from "classnames"
import type { CSSProperties } from "react"
import { type ProgressBarProps, type ProgressBarRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./LinearProgressStyles.module.css"

const COMPONENT__TRACK = "track"
const COMPONENT__BAR = "bar"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LINEAR_PROGRESS_COMPONENTS = [COMPONENT__TRACK, COMPONENT__BAR]
type TLinearProgressComponents = (typeof LINEAR_PROGRESS_COMPONENTS)[number]

export const LINEAR_PROGRESS_DIRECTION__LEFT = "left"
export const LINEAR_PROGRESS_DIRECTION__RIGHT = "right"
export const LINEAR_PROGRESS_DIRECTION__UP = "up"
export const LINEAR_PROGRESS_DIRECTION__DOWN = "down"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LINEAR_PROGRESS_DIRECTIONS = [
  LINEAR_PROGRESS_DIRECTION__LEFT,
  LINEAR_PROGRESS_DIRECTION__RIGHT,
  LINEAR_PROGRESS_DIRECTION__UP,
  LINEAR_PROGRESS_DIRECTION__DOWN,
]
type TLinearProgressDirections = (typeof LINEAR_PROGRESS_DIRECTIONS)[number]

export const LINEAR_PROGRESS_ORIENTATION__HORIZONTAL = "horizontal"
export const LINEAR_PROGRESS_ORIENTATION__VERTICAL = "vertical"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LINEAR_PROGRESS_ORIENTATIONS = [LINEAR_PROGRESS_ORIENTATION__HORIZONTAL, LINEAR_PROGRESS_ORIENTATION__VERTICAL]
type TLinearProgressOrientations = (typeof LINEAR_PROGRESS_ORIENTATIONS)[number]

export type TLinearProgressProps = ProgressBarProps & {
  "data-testid"?: string
  value: number
  height?: number | string
  width?: number | string
  barColor?: string
  trackColor?: string
  raised?: boolean
  direction?: TLinearProgressDirections
  orientation?: TLinearProgressOrientations
  trackGeometry?: TCornerGeometry
  barGeometry?: TCornerGeometry
  order?: TThemingOrderCode
  customStyles?: CSSProperties
  customBarStyles?: CSSProperties
  customTrackStyles?: CSSProperties
}

type TLinearProgressClassNameRenderProps = ProgressBarRenderProps & {
  defaultClassName: string | undefined
}

type TLinearProgressStyleRenderProps = ProgressBarRenderProps & {
  defaultStyle: CSSProperties
}

type TLinearProgressCalibration = {
  linearProgressStyles: TLinearProgressProps["className"]
  linearProgressStyle: TLinearProgressProps["style"]
  trackStyles: string
  barStyles: string
  customBarStyles: CSSProperties
  customTrackStyles: CSSProperties
}

const mergeLinearProgressClassNames = (
  computedClassName: string,
  classNameProp: ProgressBarProps["className"],
): ProgressBarProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TLinearProgressClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeLinearProgressStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeLinearProgressStyle = (
  computedStyles: CSSProperties,
  styleProp: ProgressBarProps["style"],
): ProgressBarProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TLinearProgressStyleRenderProps) =>
      mergeLinearProgressStyles(computedStyles, styleProp(styleProps))
  }

  return mergeLinearProgressStyles(computedStyles, styleProp)
}

const computeBarColorStyle = (props: TLinearProgressProps) => {
  const { order, barColor } = props
  let backgroundColorStyle: string | undefined = undefined

  if (barColor) return

  if (!order) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      backgroundColorStyle = styles["linearProgress__bar--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      backgroundColorStyle = styles["linearProgress__bar--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      backgroundColorStyle = styles["linearProgress__bar--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      backgroundColorStyle = styles["linearProgress__bar--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      backgroundColorStyle = styles["linearProgress__bar--quintenary"]
      break
    default:
      backgroundColorStyle = styles["linearProgress__bar--primary"]
      break
  }

  return backgroundColorStyle
}

const computeGeometryStyle = (props: TLinearProgressProps, component: TLinearProgressComponents) => {
  const { trackGeometry = ROUND, barGeometry = ROUND } = props
  const computedProp = component === COMPONENT__TRACK ? trackGeometry : barGeometry

  switch (computedProp) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return component === COMPONENT__TRACK
        ? styles["linearProgress__track--rounded"]
        : styles["linearProgress__bar--rounded"]
    case ROUND:
      return component === COMPONENT__TRACK
        ? styles["linearProgress__track--round"]
        : styles["linearProgress__bar--round"]
    default:
      return component === COMPONENT__TRACK
        ? styles["linearProgress__track--round"]
        : styles["linearProgress__bar--round"]
  }
}

const computeOrientationAndDirectionStyle = (props: TLinearProgressProps) => {
  const { orientation = LINEAR_PROGRESS_ORIENTATION__HORIZONTAL, direction = LINEAR_PROGRESS_DIRECTION__RIGHT } = props
  let orientationStyle, directionStyle

  if (orientation === LINEAR_PROGRESS_ORIENTATION__HORIZONTAL) {
    orientationStyle = styles["linearProgress--horizontal"]

    // Right direction works by default. Up and down direction are invalid
    //    while the progress bar's orientation is horizontal.
    if (direction === LINEAR_PROGRESS_DIRECTION__LEFT) directionStyle = styles["linearProgress--dirLeft"]
  } else {
    orientationStyle = styles["linearProgress--vertical"]

    // Up direction works by default. Right and left direction are invalid
    //    while the progress bar's orientation is vertical.
    if (direction === LINEAR_PROGRESS_DIRECTION__DOWN) directionStyle = styles["linearProgress--dirDown"]
  }

  return { orientationStyle, directionStyle }
}

export const calibrateComponent = (props: TLinearProgressProps): TLinearProgressCalibration => {
  const { linearProgress, linearProgress__track, linearProgress__bar } = styles
  const {
    trackColor,
    barColor,
    height,
    width,
    raised,
    customStyles: customStyles_props,
    customTrackStyles: customTrackStyles_props,
    customBarStyles: customBarStyles_props,
    className,
    style,
  } = props

  const trackGeometryStyle = computeGeometryStyle(props, "track")
  const barGeometryStyle = computeGeometryStyle(props, "bar")
  const barColorStyle = computeBarColorStyle(props)
  const { orientationStyle, directionStyle } = computeOrientationAndDirectionStyle(props)
  const raisedStyle = raised !== undefined && raised === true ? styles["linearProgress__track--raised"] : undefined

  const computedLinearProgressStyles = classNames(linearProgress, orientationStyle, directionStyle)
  const linearProgressStyles = mergeLinearProgressClassNames(computedLinearProgressStyles, className)
  const linearProgressStyle = computeLinearProgressStyle({ ...customStyles_props }, style)
  const trackStyles = classNames(linearProgress__track, raisedStyle, trackGeometryStyle)
  const barStyles = classNames(linearProgress__bar, barGeometryStyle, barColorStyle)

  const customTrackStyles = Object.assign(
    { backgroundColor: trackColor, height, width },
    { ...customTrackStyles_props },
  )
  const customBarStyles = Object.assign({ backgroundColor: barColor }, { ...customBarStyles_props })

  return {
    linearProgressStyles,
    linearProgressStyle,
    trackStyles,
    barStyles,
    customBarStyles,
    customTrackStyles,
  }
}
