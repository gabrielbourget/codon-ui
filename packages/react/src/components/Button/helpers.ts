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

const {
  ["button--applyFocusStyle"]: buttonApplyFocusStyle,
  ["button--customFill"]: buttonCustomFill,
  ["button--customOutline"]: buttonCustomOutline,
  ["button--fill"]: buttonFill,
  ["button--noFocusStyle"]: buttonNoFocusStyle,
  ["button--offsetFocusRing"]: buttonOffsetFocusRing,
  ["button--outline"]: buttonOutline,
  ["button--primary--fill"]: buttonPrimaryFill,
  ["button--primary--outline"]: buttonPrimaryOutline,
  ["button--quaternary--fill"]: buttonQuaternaryFill,
  ["button--quaternary--outline"]: buttonQuaternaryOutline,
  ["button--quintenary--fill"]: buttonQuintenaryFill,
  ["button--quintenary--outline"]: buttonQuintenaryOutline,
  ["button--raised"]: buttonRaised,
  ["button--raisedOnHover"]: buttonRaisedOnHover,
  ["button--round"]: buttonRound,
  ["button--rounded"]: buttonRounded,
  ["button--secondary--fill"]: buttonSecondaryFill,
  ["button--secondary--outline"]: buttonSecondaryOutline,
  ["button--tertiary--fill"]: buttonTertiaryFill,
  ["button--tertiary--outline"]: buttonTertiaryOutline,
  ["button--transparent"]: buttonTransparent,
} = styles

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
    colorStyle = buttonTransparent
    return colorStyle
  }

  if (color) {
    return colorMode === COLOR_MODE__FILL ? buttonCustomFill : buttonCustomOutline
  }

  if (!order) {
    return colorMode === COLOR_MODE__FILL ? buttonFill : buttonOutline
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonPrimaryFill : buttonPrimaryOutline
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonSecondaryFill : buttonSecondaryOutline
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonTertiaryFill : buttonTertiaryOutline
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonQuaternaryFill : buttonQuaternaryOutline
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonQuintenaryFill : buttonQuintenaryOutline
      break
    default:
      colorStyle = colorMode === COLOR_MODE__FILL ? buttonPrimaryFill : buttonPrimaryOutline
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
      return buttonRounded
    case ROUND:
      return buttonRound
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
  const raisedStyle = raised !== undefined && raised === false ? undefined : buttonRaised
  const raisedOnHoverStyle = raisedOnHover ? buttonRaisedOnHover : undefined
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false ? buttonNoFocusStyle : buttonApplyFocusStyle
  const offsetFocusRingStyle = offsetFocusRing ? buttonOffsetFocusRing : undefined

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
