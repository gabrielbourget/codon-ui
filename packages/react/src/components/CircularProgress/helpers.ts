import classNames from "classnames"
import type { CSSProperties } from "react"
import type { ProgressBarProps, ProgressBarRenderProps } from "react-aria-components"

import {
  STROKE_LINECAP__BUTT,
  STROKE_LINECAP__ROUND,
  STROKE_LINECAP__SQUARE,
  type TAvailableStrokeLinecaps,
} from "../../tokens/svg"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./CircularProgressStyles.module.css"

export const VIEWBOX_WIDTH = 100
export const VIEWBOX_HEIGHT = 100
export const VIEWBOX_HEIGHT_HALF = 50

const COMPONENT__TRACK = "track"
const COMPONENT__PATH = "path"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CIRCULAR_PROGRESS_COMPONENTS = [COMPONENT__TRACK, COMPONENT__PATH] as const
type TCircularProgressComponents = (typeof CIRCULAR_PROGRESS_COMPONENTS)[number]

export type TCircularProgressProps = ProgressBarProps & {
  "data-testid"?: string
  value: number
  height?: number | string
  width?: number | string
  backgroundColor?: string
  pathColor?: string
  trackColor?: string
  order?: TThemingOrderCode
  circleRatio?: number
  backgroundPadding?: number
  strokeWidth?: number
  strokeLineCap?: TAvailableStrokeLinecaps
  counterClockwise?: boolean
  text?: string
  customStyles?: CSSProperties
  customSVGStyles?: CSSProperties
  customTrackStyles?: CSSProperties
  customPathStyles?: CSSProperties
  customTextStyles?: CSSProperties
  customBackgroundStyles?: CSSProperties
}

type TCircularProgressClassNameRenderProps = ProgressBarRenderProps & {
  defaultClassName: string | undefined
}

type TCircularProgressStyleRenderProps = ProgressBarRenderProps & {
  defaultStyle: CSSProperties
}

type TCircularProgressCalibration = {
  circularProgressStyles: TCircularProgressProps["className"]
  circularProgressStyle: TCircularProgressProps["style"]
  svgStyles: string
  pathStyles: string
  trackStyles: string
  textStyles: string
  backgroundStyles: string
  customBackgroundStyles: CSSProperties
  customPathStyles: CSSProperties
  customTrackStyles: CSSProperties
  customStyles: CSSProperties
}

const mergeCircularProgressClassNames = (
  computedClassName: string,
  classNameProp: ProgressBarProps["className"],
): ProgressBarProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TCircularProgressClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeCircularProgressStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeCircularProgressStyle = (
  computedStyles: CSSProperties,
  styleProp: ProgressBarProps["style"],
): ProgressBarProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TCircularProgressStyleRenderProps) =>
      mergeCircularProgressStyles(computedStyles, styleProp(styleProps))
  }

  return mergeCircularProgressStyles(computedStyles, styleProp)
}

export const computeBackgroundPadding = (props: TCircularProgressProps) => {
  const { backgroundColor, backgroundPadding = 0 } = props
  if (!backgroundColor) return 0
  else return backgroundPadding
}

export const computePathRadius = (props: TCircularProgressProps) => {
  const { strokeWidth = 8 } = props
  // The radius of the path is defined to be in the middle, so in order for the path to
  // fit perfectly inside the 100x100 viewBox, need to subtract half the strokeWidth
  return VIEWBOX_HEIGHT_HALF - strokeWidth / 2 - computeBackgroundPadding(props)
}

// Ratio of path length to track length, as a value between 0 and 1
export const computePathRatio = (props: TCircularProgressProps) => {
  const { value = 0, minValue = 0, maxValue = 100 } = props
  const range = maxValue - minValue

  if (range <= 0) return 0

  const boundedValue = Math.min(Math.max(value, minValue), maxValue)
  // Escape logic in case value is greater than maxValue. Circle should be full at most.
  return Math.min((boundedValue - minValue) / range, 1)
}

const computeStrokeLinecapStyle = (props: TCircularProgressProps, component: TCircularProgressComponents) => {
  const { strokeLineCap } = props
  let strokeLineCapStyle: string | undefined = undefined

  switch (strokeLineCap) {
    case STROKE_LINECAP__BUTT:
      strokeLineCapStyle =
        component === COMPONENT__TRACK
          ? styles["circularProgress__track--lineCapButt"]
          : styles["circularProgress__path--lineCapButt"]
      break
    case STROKE_LINECAP__ROUND:
      strokeLineCapStyle =
        component === COMPONENT__TRACK
          ? styles["circularProgress__track--lineCapRound"]
          : styles["circularProgress__path--lineCapRound"]
      break
    case STROKE_LINECAP__SQUARE:
      strokeLineCapStyle =
        component === COMPONENT__TRACK
          ? styles["circularProgress__track--lineCapSquare"]
          : styles["circularProgress__path--lineCapSquare"]
      break
    default:
      strokeLineCapStyle =
        component === COMPONENT__TRACK
          ? styles["circularProgress__track--lineCapButt"]
          : styles["circularProgress__path--lineCapButt"]
      break
  }

  return strokeLineCapStyle
}

const computePathColorStyle = (props: TCircularProgressProps) => {
  const { order, pathColor } = props
  let colorStyle: string | undefined = undefined

  if (pathColor) return

  if (!order) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = styles["circularProgress__path--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = styles["circularProgress__path--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = styles["circularProgress__path--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = styles["circularProgress__path--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = styles["circularProgress__path--quintenary"]
      break
    default:
      colorStyle = styles["circularProgress__path--primary"]
      break
  }

  return colorStyle
}

export const calibrateComponent = (props: TCircularProgressProps): TCircularProgressCalibration => {
  const {
    circularProgress,
    circularProgress__svg,
    circularProgress__path,
    circularProgress__track,
    circularProgress__text,
    circularProgress__background,
  } = styles
  const {
    customTrackStyles: customTrackStyles_props,
    customPathStyles: customPathStyles_props,
    customBackgroundStyles: customBackgroundStyles_props,
    backgroundColor,
    pathColor,
    customStyles: customStyles_props,
    trackColor,
    height,
    width,
    className,
    style,
  } = props

  const pathColorStyle = computePathColorStyle(props)
  const pathLineCapStyle = computeStrokeLinecapStyle(props, "path")
  const trackLineCapStyle = computeStrokeLinecapStyle(props, "track")

  const computedCircularProgressStyles = classNames(circularProgress)
  const circularProgressStyles = mergeCircularProgressClassNames(computedCircularProgressStyles, className)
  const svgStyles = classNames(circularProgress__svg)
  const pathStyles = classNames(circularProgress__path, pathLineCapStyle, pathColorStyle)
  const trackStyles = classNames(circularProgress__track, trackLineCapStyle)
  const textStyles = classNames(circularProgress__text)
  const backgroundStyles = classNames(circularProgress__background)

  const customBackgroundStyles = Object.assign({ backgroundColor }, { ...customBackgroundStyles_props })
  const customPathStyles = Object.assign({ color: pathColor }, { ...customPathStyles_props })
  const customTrackStyles = Object.assign({ color: trackColor }, { ...customTrackStyles_props })
  const customStyles = Object.assign({ height, width }, { ...customStyles_props })
  const circularProgressStyle = computeCircularProgressStyle(customStyles, style)

  return {
    circularProgressStyles,
    circularProgressStyle,
    svgStyles,
    pathStyles,
    trackStyles,
    textStyles,
    backgroundStyles,
    customBackgroundStyles,
    customPathStyles,
    customTrackStyles,
    customStyles,
  }
}
