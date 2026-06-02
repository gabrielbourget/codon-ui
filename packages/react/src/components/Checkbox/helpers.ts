import classNames from "classnames"
import type { CSSProperties } from "react"
import type { CheckboxProps, CheckboxRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./CheckboxStyles.module.css"

export type TCheckboxProps = CheckboxProps & {
  "data-testid"?: string
  height?: number | string
  width?: number | string
  geometry?: TCornerGeometry
  color?: string
  raised?: boolean
  order?: TThemingOrderCode
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  showIcon?: boolean
  customStyles?: CSSProperties
}

type TCheckboxClassNameRenderProps = CheckboxRenderProps & {
  defaultClassName: string | undefined
}

type TCheckboxCalibration = {
  checkboxStyles: TCheckboxProps["className"]
  checkboxStyle: TCheckboxProps["style"]
  shapeStyles: string
  shapeStyle: CSSProperties
  svgStyles: string
}

type TCheckboxStyleRenderProps = CheckboxRenderProps & {
  defaultStyle: CSSProperties
}

const mergeCheckboxClassNames = (
  computedClassName: string,
  classNameProp: CheckboxProps["className"],
): CheckboxProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TCheckboxClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeCheckboxStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeCheckboxStyle = (
  computedStyles: CSSProperties,
  styleProp: CheckboxProps["style"],
): CheckboxProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TCheckboxStyleRenderProps) => mergeCheckboxStyles(computedStyles, styleProp(styleProps))
  }

  return mergeCheckboxStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TCheckboxProps) => {
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

const computeColorStyle = (props: TCheckboxProps) => {
  const { order, color } = props

  let colorStyle = ""

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

export const calibrateComponent = (props: TCheckboxProps): TCheckboxCalibration => {
  const {
    offsetFocusRing: offsetFocusRing__props = true,
    enableFocusStyle,
    customStyles: customStyles__props,
    height,
    width,
    color,
    raised = false,
    className,
    style,
  } = props
  const { checkbox, shape, svg } = styles

  const geometryStyle = computeGeometryStyle(props)
  const colorStyle = computeColorStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["shape--noFocusStyle"]
      : styles["shape--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["shape--offsetFocusRing"] : undefined
  const raisedStyle = raised ? styles["shape--raised"] : undefined

  const computedCheckboxStyles = classNames(checkbox)
  const checkboxStyles = mergeCheckboxClassNames(computedCheckboxStyles, className)
  const shapeStyles = classNames(shape, geometryStyle, colorStyle, focusStyle, offsetFocusRingStyle, raisedStyle)
  const svgStyles = classNames(svg)

  const customStyles = Object.assign({ height, width, color }, { ...customStyles__props })
  const checkboxStyle = computeCheckboxStyle(customStyles, style)
  const shapeStyle = customStyles

  return {
    checkboxStyles,
    checkboxStyle,
    shapeStyles,
    shapeStyle,
    svgStyles,
  }
}
