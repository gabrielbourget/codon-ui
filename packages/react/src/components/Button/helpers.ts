import classNames from "classnames"
import type { ComponentPropsWithoutRef, CSSProperties } from "react"
import type { Button, ButtonRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./ButtonStyles.module.css"

export const COLOR_MODE__FILL = "fill"
export const COLOR_MODE__OUTLINE = "outline"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AVAILABLE_COLOR_MODES = [COLOR_MODE__FILL, COLOR_MODE__OUTLINE] as const
export type TAvailableColorModes = (typeof AVAILABLE_COLOR_MODES)[number]

type TButtonRootProps = Omit<ComponentPropsWithoutRef<typeof Button>, "disabled">

export type TButtonProps = TButtonRootProps & {
  "data-testid"?: string
  height?: number | string
  width?: number | string
  color?: string
  colorMode?: TAvailableColorModes
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  autoFocus?: boolean
  transparent?: boolean
  raised?: boolean
  raisedOnHover?: boolean
  hoverColor?: string
  customStyles?: CSSProperties
  customClassName?: string
}

type TButtonCSSVariables = CSSProperties & {
  "--btn-bg"?: CSSProperties["backgroundColor"]
  "--btn-hover-bg"?: CSSProperties["backgroundColor"]
}

type TButtonStyleRenderProps = ButtonRenderProps & {
  defaultStyle: CSSProperties
}

type TButtonClassNameRenderProps = ButtonRenderProps & {
  defaultClassName: string | undefined
}

type TButtonCalibration = {
  buttonStyles: TButtonProps["className"]
  buttonStyle: TButtonProps["style"]
  customStyles: CSSProperties
}

const mergeButtonClassNames = (
  computedClassName: string,
  classNameProp: TButtonProps["className"],
): TButtonProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TButtonClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const getButtonCSSVariables = (rootStyles: CSSProperties, hoverColor?: string): TButtonCSSVariables => {
  const buttonCSSVariables: TButtonCSSVariables = {}

  if (rootStyles.backgroundColor !== undefined) {
    buttonCSSVariables["--btn-bg"] = rootStyles.backgroundColor
  }

  if (hoverColor !== undefined) {
    buttonCSSVariables["--btn-hover-bg"] = hoverColor
  }

  return buttonCSSVariables
}

const mergeButtonStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
  hoverColor: string | undefined,
): CSSProperties => {
  const rootStyles = {
    ...computedStyles,
    ...styleProp,
  }

  return {
    ...rootStyles,
    ...getButtonCSSVariables(rootStyles, hoverColor),
  }
}

const computeButtonColorStyles = (props: TButtonProps) => {
  const { transparent = false, colorMode = COLOR_MODE__FILL, order, color } = props
  let colorStyle: string | undefined = undefined

  if (transparent) {
    colorStyle = styles["button--transparent"]
    return colorStyle
  }

  if (color) {
    return colorMode === COLOR_MODE__FILL ? styles["button--customFill"] : styles["button--customOutline"]
  }

  if (!order) {
    return colorMode === COLOR_MODE__FILL ? styles["button--fill"] : styles["button--outline"]
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? styles["button--primary--fill"] : styles["button--primary--outline"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL ? styles["button--secondary--fill"] : styles["button--secondary--outline"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL ? styles["button--tertiary--fill"] : styles["button--tertiary--outline"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL ? styles["button--quaternary--fill"] : styles["button--quaternary--outline"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL ? styles["button--quintenary--fill"] : styles["button--quintenary--outline"]
      break
    default:
      colorStyle = colorMode === COLOR_MODE__FILL ? styles["button--primary--fill"] : styles["button--primary--outline"]
      break
  }

  return colorStyle
}

const computeButtonGeometryStyle = (props: TButtonProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["button--rounded"]
    case ROUND:
      return styles["button--round"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TButtonProps): TButtonCalibration => {
  const {
    raised,
    color,
    enableFocusStyle,
    raisedOnHover = false,
    offsetFocusRing = true,
    colorMode = COLOR_MODE__FILL,
    height,
    width,
    customStyles: customStyles__props,
    customClassName,
    className,
    hoverColor,
    style,
  } = props
  const { button } = styles
  let computedBackgroundColor: string | undefined = undefined
  let computedBorderStyle: string | undefined = undefined
  let computedColor: string | undefined = undefined

  const colorStyle = computeButtonColorStyles(props)
  const buttonGeometryStyle = computeButtonGeometryStyle(props)
  const raisedStyle = raised !== undefined && raised === false ? undefined : styles["button--raised"]
  const raisedOnHoverStyle = raisedOnHover ? styles["button--raisedOnHover"] : undefined
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["button--noFocusStyle"]
      : styles["button--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing ? styles["button--offsetFocusRing"] : undefined

  const computedButtonStyles = classNames(
    button,
    buttonGeometryStyle,
    colorStyle,
    raisedStyle,
    raisedOnHoverStyle,
    focusStyle,
    offsetFocusRingStyle,
    customClassName,
  )
  const buttonStyles = mergeButtonClassNames(computedButtonStyles, className)

  if (color) {
    if (colorMode === COLOR_MODE__FILL) {
      computedBackgroundColor = color
    } else if (colorMode === COLOR_MODE__OUTLINE) {
      computedBorderStyle = `2px solid ${color}`
      computedColor = color
    }
  }

  const customStyles = Object.assign(
    {
      backgroundColor: computedBackgroundColor,
      color: computedColor,
      border: computedBorderStyle,
      height,
      width,
    },
    { ...customStyles__props },
  )

  const buttonStyle =
    typeof style === "function"
      ? (styleProps: TButtonStyleRenderProps) => mergeButtonStyles(customStyles, style(styleProps), hoverColor)
      : mergeButtonStyles(customStyles, style, hoverColor)

  return { buttonStyles, buttonStyle, customStyles }
}
