import classNames from "classnames"
import type { CSSProperties } from "react"
import type { RadioProps, RadioRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./RadioStyles.module.css"

export type TRadioProps = RadioProps & {
  "data-testid"?: string
  value: string
  height?: number | string
  width?: number | string
  color?: string
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  customStyles?: CSSProperties
  customShapeStyles?: CSSProperties
}

type TRadioClassNameRenderProps = RadioRenderProps & {
  defaultClassName: string | undefined
}

type TRadioCalibration = {
  radioStyles: TRadioProps["className"]
  radioStyle: TRadioProps["style"]
  shapeStyles: string
  shapeStyle: CSSProperties | undefined
}

type TRadioStyleRenderProps = RadioRenderProps & {
  defaultStyle: CSSProperties
}

const mergeRadioClassNames = (
  computedClassName: string,
  classNameProp: RadioProps["className"],
): RadioProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TRadioClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeRadioStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeRadioStyle = (computedStyles: CSSProperties, styleProp: RadioProps["style"]): RadioProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TRadioStyleRenderProps) => mergeRadioStyles(computedStyles, styleProp(styleProps))
  }

  return mergeRadioStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TRadioProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["shape--rounded"]
    case ROUND:
      return styles["shape--round"]
    default:
      return undefined
  }
}

const computeColorStyle = (props: TRadioProps) => {
  let { color } = props
  const { order } = props
  if (color) color = color.toLowerCase().trim()

  let colorStyle: string | undefined = undefined

  if (color) return

  if (!color && !order) {
    colorStyle = styles["shape--fallback"]
    return colorStyle
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = styles["shape--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = styles["shape--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = styles["shape--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = styles["shape--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = styles["shape--quintenary"]
      break
    default:
      colorStyle = styles["shape--primary"]
      break
  }

  return colorStyle
}

export const calibrateComponent = (props: TRadioProps): TRadioCalibration => {
  const {
    offsetFocusRing: offsetFocusRing__props = true,
    enableFocusStyle,
    height,
    width,
    customStyles: customStyles__props,
    customShapeStyles,
    className,
    style,
  } = props
  const { radio, shape } = styles

  const geometryStyle = computeGeometryStyle(props)
  const colorStyle = computeColorStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["shape--noFocusStyle"]
      : styles["shape--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["shape--offsetFocusRing"] : undefined

  const computedRadioStyles = classNames(radio)
  const radioStyles = mergeRadioClassNames(computedRadioStyles, className)
  const shapeStyles = classNames(shape, geometryStyle, colorStyle, focusStyle, offsetFocusRingStyle)

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const radioStyle = computeRadioStyle(customStyles, style)
  const shapeStyle = customShapeStyles

  return {
    radioStyles,
    radioStyle,
    shapeStyles,
    shapeStyle,
  }
}
