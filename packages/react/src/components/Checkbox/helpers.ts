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

const {
  ["shape--applyFocusStyle"]: shapeApplyFocusStyle,
  ["shape--fallback"]: shapeFallback,
  ["shape--noFocusStyle"]: shapeNoFocusStyle,
  ["shape--offsetFocusRing"]: shapeOffsetFocusRing,
  ["shape--primary"]: shapePrimary,
  ["shape--quaternary"]: shapeQuaternary,
  ["shape--quintenary"]: shapeQuintenary,
  ["shape--raised"]: shapeRaised,
  ["shape--round"]: shapeRound,
  ["shape--rounded"]: shapeRounded,
  ["shape--secondary"]: shapeSecondary,
  ["shape--tertiary"]: shapeTertiary,
} = styles

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
      return shapeRounded
    case ROUND:
      return shapeRound
    default:
      return undefined
  }
}

const computeColorStyle = (props: TCheckboxProps) => {
  const { order, color } = props

  let colorStyle = ""

  if (color) return

  if (!color && !order) {
    colorStyle = shapeFallback
    return colorStyle
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = shapePrimary
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = shapeSecondary
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = shapeTertiary
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = shapeQuaternary
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = shapeQuintenary
      break
    default:
      colorStyle = shapePrimary
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
    enableFocusStyle !== undefined && enableFocusStyle === false ? shapeNoFocusStyle : shapeApplyFocusStyle
  const offsetFocusRingStyle = offsetFocusRing__props === true ? shapeOffsetFocusRing : undefined
  const raisedStyle = raised ? shapeRaised : undefined

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
