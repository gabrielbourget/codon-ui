import classNames from "classnames"
import type { CSSProperties } from "react"
import type { SliderProps, SliderRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"
import textStyles from "../Text/TextStyles.module.css"

import styles from "./SliderStyles.module.css"

export type TSliderProps = SliderProps & {
  "data-testid"?: string
  label?: string
  labelID?: string
  thumbAriaLabels?: string[]
  thumbNames?: string[]
  height?: string | number
  width?: string | number
  maxWidth?: string | number
  thumbColor?: string
  trackColor?: string
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  customStyles?: CSSProperties
  customLabelStyles?: CSSProperties
  customOutputStyles?: CSSProperties
  customOutputFormatter?: (thumbValue: number[]) => string
  customTrackStyles?: CSSProperties
  customThumbStyles?: CSSProperties
}

type TSliderClassNameRenderProps = SliderRenderProps & {
  defaultClassName: string | undefined
}

type TSliderStyleRenderProps = SliderRenderProps & {
  defaultStyle: CSSProperties
}

type TSliderCalibration = {
  sliderStyles: TSliderProps["className"]
  sliderStyle: TSliderProps["style"]
  labelStyles: string
  outputStyles: string
  trackStyles: string
  thumbStyles: string
  customStyles: CSSProperties
  customTrackStyles: CSSProperties
  customThumbStyles: CSSProperties
}

type TSliderCSSVariables = CSSProperties & {
  "--max-width"?: string
}

const mergeSliderClassNames = (
  computedClassName: string,
  classNameProp: SliderProps["className"],
): SliderProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TSliderClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeSliderStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeSliderStyle = (computedStyles: CSSProperties, styleProp: SliderProps["style"]): SliderProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TSliderStyleRenderProps) => mergeSliderStyles(computedStyles, styleProp(styleProps))
  }

  return mergeSliderStyles(computedStyles, styleProp)
}

export const toCSSSize = (value?: string | number): string | undefined => {
  if (value === undefined || value === "") return undefined
  if (typeof value === "number") return `${value}px`

  const trimmedValue = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(trimmedValue)) return `${trimmedValue}px`

  return trimmedValue
}

const computeGeometryStyles = (props: TSliderProps) => {
  const { geometry = ROUND } = props
  let trackGeometryStyle: string | undefined = undefined
  let thumbGeometryStyle: string | undefined = undefined

  switch (geometry) {
    case ORTHOGONAL:
      break
    case ROUNDED:
      trackGeometryStyle = styles["slider__track--rounded"]
      thumbGeometryStyle = styles["slider__thumb--rounded"]
      break
    case ROUND:
      trackGeometryStyle = styles["slider__track--round"]
      thumbGeometryStyle = styles["slider__thumb--round"]
      break
    default:
      trackGeometryStyle = styles["slider__track--round"]
      thumbGeometryStyle = styles["slider__thumb--round"]
      break
  }

  return { trackGeometryStyle, thumbGeometryStyle }
}

const computeColorStyle = (props: TSliderProps) => {
  const { order, thumbColor } = props
  let colorStyle: string | undefined = undefined

  if (thumbColor) return
  if (!thumbColor && !order) return

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = styles["slider__thumb--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = styles["slider__thumb--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = styles["slider__thumb--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = styles["slider__thumb--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = styles["slider__thumb--quintenary"]
      break
    default:
      colorStyle = styles["slider__thumb--primary"]
      break
  }

  return colorStyle
}

export const calibrateComponent = (props: TSliderProps): TSliderCalibration => {
  const { slider, slider__label, slider__output, slider__track, slider__thumb } = styles
  const { b11 } = textStyles
  const {
    height,
    width,
    trackColor,
    thumbColor,
    enableFocusStyle = true,
    offsetFocusRing: offsetFocusRing__props = true,
    raised = true,
    customStyles: customStyles__props,
    customThumbStyles: customThumbStyles__props,
    customTrackStyles: customTrackStyles__props,
    className,
    maxWidth = 300,
    style,
  } = props

  const colorStyle = computeColorStyle(props)
  const focusStyle = enableFocusStyle ? styles["slider__thumb--applyFocusStyle"] : styles["slider__thumb--noFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["slider__thumb--offsetFocusRing"] : undefined
  const { trackGeometryStyle, thumbGeometryStyle } = computeGeometryStyles(props)
  const raisedStyle = raised ? styles["slider__thumb--raised"] : null

  const computedSliderStyles = classNames(slider)
  const sliderStyles = mergeSliderClassNames(computedSliderStyles, className)
  const labelStyles = classNames(slider__label)
  const outputStyles = classNames(slider__output, b11, textStyles["fw-bold"])
  const trackStyles = classNames(slider__track, trackGeometryStyle)
  const thumbStyles = classNames(
    slider__thumb,
    thumbGeometryStyle,
    focusStyle,
    offsetFocusRingStyle,
    raisedStyle,
    colorStyle,
  )

  const customStyles: TSliderCSSVariables = Object.assign(
    { "--max-width": toCSSSize(maxWidth), height, width },
    { ...customStyles__props },
  )
  const sliderStyle = computeSliderStyle(customStyles, style)
  const customTrackStyles = Object.assign({ backgroundColor: trackColor }, { ...customTrackStyles__props })
  const customThumbStyles = Object.assign({ backgroundColor: thumbColor }, { ...customThumbStyles__props })

  return {
    sliderStyles,
    sliderStyle,
    labelStyles,
    outputStyles,
    trackStyles,
    thumbStyles,
    customStyles,
    customTrackStyles,
    customThumbStyles,
  }
}
