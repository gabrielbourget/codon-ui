import classNames from "classnames"
import type { CSSProperties } from "react"
import type { ToggleButtonProps, ToggleButtonRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./ToggleButtonStyles.module.css"

export type TToggleButtonProps = ToggleButtonProps & {
  "data-testid"?: string
  height?: number | string
  width?: number | string
  color?: string
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  raised?: boolean
  autoFocus?: boolean
  customStyles?: CSSProperties
}

type TToggleButtonClassNameRenderProps = ToggleButtonRenderProps & {
  defaultClassName: string | undefined
}

type TToggleButtonCalibration = {
  toggleButtonStyles: TToggleButtonProps["className"]
  toggleButtonStyle: TToggleButtonProps["style"]
}

type TToggleButtonStyleRenderProps = ToggleButtonRenderProps & {
  defaultStyle: CSSProperties
}

const mergeToggleButtonClassNames = (
  computedClassName: string,
  classNameProp: ToggleButtonProps["className"],
): ToggleButtonProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TToggleButtonClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeToggleButtonStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeToggleButtonStyle = (
  computedStyles: CSSProperties,
  styleProp: ToggleButtonProps["style"],
): ToggleButtonProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TToggleButtonStyleRenderProps) => mergeToggleButtonStyles(computedStyles, styleProp(styleProps))
  }

  return mergeToggleButtonStyles(computedStyles, styleProp)
}

const computeToggleButtonColorStyle = (props: TToggleButtonProps) => {
  let { color } = props
  const { order } = props
  if (color) color = color.toLowerCase().trim()

  let backgroundColorStyle: string | undefined = undefined

  if (color) return

  if (!order) return styles["toggleButton--no-bg-color-provided-fallback"]

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      backgroundColorStyle = styles["toggleButton--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      backgroundColorStyle = styles["toggleButton--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      backgroundColorStyle = styles["toggleButton--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      backgroundColorStyle = styles["toggleButton--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      backgroundColorStyle = styles["toggleButton--quintenary"]
      break
    default:
      backgroundColorStyle = styles["toggleButton--primary"]
      break
  }

  return backgroundColorStyle
}

const computeToggleButtonGeometryStyle = (props: TToggleButtonProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["toggleButton--rounded"]
    case ROUND:
      return styles["toggleButton--round"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TToggleButtonProps): TToggleButtonCalibration => {
  const {
    raised = false,
    color,
    enableFocusStyle,
    height,
    width,
    offsetFocusRing: offsetFocusRing__props = true,
    customStyles: customStyles__props,
    className,
    style,
  } = props
  const { toggleButton } = styles

  const colorStyle = computeToggleButtonColorStyle(props)
  const toggleButtonGeometryStyle = computeToggleButtonGeometryStyle(props)
  const raisedStyle = raised ? styles["toggleButton--raised"] : undefined
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["toggleButton--noFocusStyle"]
      : styles["toggleButton--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["toggleButton--offsetFocusRing"] : undefined

  const computedToggleButtonStyles = classNames(
    toggleButton,
    toggleButtonGeometryStyle,
    colorStyle,
    raisedStyle,
    focusStyle,
    offsetFocusRingStyle,
  )

  const customStyles = Object.assign({ backgroundColor: color, height, width }, { ...customStyles__props })
  const toggleButtonStyles = mergeToggleButtonClassNames(computedToggleButtonStyles, className)
  const toggleButtonStyle = computeToggleButtonStyle(customStyles, style)

  return { toggleButtonStyles, toggleButtonStyle }
}
