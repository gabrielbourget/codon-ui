import classNames from "classnames"
import { type CSSProperties, type ReactNode, useMemo } from "react"
import type { NumberFieldProps, NumberFieldRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import type { TPartialStepperLabels } from "./labels"
import styles from "./StepperStyles.module.css"

export const STEPPER_SIZE__SM = "small"
export const STEPPER_SIZE__MD = "medium"
export const STEPPER_SIZE__LG = "large"

export const AVAILABLE_INPUT_SIZES = [STEPPER_SIZE__SM, STEPPER_SIZE__MD, STEPPER_SIZE__LG] as const
export type TAvailableInputSizes = (typeof AVAILABLE_INPUT_SIZES)[number]

export const ORIENTATION__HORIZONTAL = "horizontal"
export const ORIENTATION__VERTICAL = "vertical"
export const STEPPER_ORIENTATIONS = [ORIENTATION__HORIZONTAL, ORIENTATION__VERTICAL] as const
export type TAvailableStepperOrientations = (typeof STEPPER_ORIENTATIONS)[number]

export const STEPPER_TYPE__COHESIVE = "cohesive"
export const STEPPER_TYPE__SEGMENTED = "segmented"
export const AVAILABLE_STEPPER_TYPES = [STEPPER_TYPE__COHESIVE, STEPPER_TYPE__SEGMENTED] as const
export type TAvailableStepperTypes = (typeof AVAILABLE_STEPPER_TYPES)[number]

export const COLOR_MODE__FILL = "fill"
export const COLOR_MODE__OUTLINE = "outline"
export const AVAILABLE_COLOR_MODES = [COLOR_MODE__FILL, COLOR_MODE__OUTLINE] as const
export type TAvailableColorModes = (typeof AVAILABLE_COLOR_MODES)[number]

type TAvailableButtonColorModes = TAvailableColorModes

const DEFAULT_STEPPER_ICON_SIZE = 15
const DEFAULT_LIGHT_ACTION_FOREGROUND = "#ffffff"
const DEFAULT_DARK_ACTION_FOREGROUND = "#000000"

const StepperDefaultMinusIcon = (props: { color: string }) => {
  const { color } = props

  return (
    <svg
      width={DEFAULT_STEPPER_ICON_SIZE}
      height={DEFAULT_STEPPER_ICON_SIZE}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
    >
      <path d="M5 11h14v2H5z" />
    </svg>
  )
}

const StepperDefaultPlusIcon = (props: { color: string }) => {
  const { color } = props

  return (
    <svg
      width={DEFAULT_STEPPER_ICON_SIZE}
      height={DEFAULT_STEPPER_ICON_SIZE}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
    >
      <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6z" />
    </svg>
  )
}

type TRgbColor = {
  r: number
  g: number
  b: number
}

const hexToRgb = (hex: string): TRgbColor | null => {
  const expandedHex = hex.trim().replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/iu, (_match, r, g, b) => {
    return r + r + g + g + b + b
  })
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/iu.exec(expandedHex)

  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

const isValidRgbComponent = (value: number) => value >= 0 && value <= 255

const parseCssColorToRgb = (color: string): TRgbColor | null => {
  const normalizedColor = color.trim()
  const hexColor = hexToRgb(normalizedColor)

  if (hexColor) return hexColor

  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/iu.exec(
    normalizedColor,
  )

  if (!rgbMatch) return null

  const r = parseInt(rgbMatch[1], 10)
  const g = parseInt(rgbMatch[2], 10)
  const b = parseInt(rgbMatch[3], 10)

  if (!isValidRgbComponent(r) || !isValidRgbComponent(g) || !isValidRgbComponent(b)) return null

  return { r, g, b }
}

const determineColorLuminance = (r: number, g: number, b: number): number => {
  const colorValues = [r, g, b].map((value) => {
    const normalizedValue = value / 255

    return normalizedValue <= 0.03928 ? normalizedValue / 12.92 : Math.pow((normalizedValue + 0.055) / 1.055, 2.4)
  })

  return colorValues[0] * 0.2126 + colorValues[1] * 0.7152 + colorValues[2] * 0.0722
}

const computeContrastScore = (luminance1: number, luminance2: number): number => {
  const lighterColorLuminance = Math.max(luminance1, luminance2)
  const darkerColorLuminance = Math.min(luminance1, luminance2)

  return (lighterColorLuminance + 0.05) / (darkerColorLuminance + 0.05)
}

const determineReadableTextColor = (
  backgroundColor: string,
  lightColor: string = "#fff",
  darkColor: string = "#000",
): string | undefined => {
  const backgroundColorRgb = parseCssColorToRgb(backgroundColor)
  const lightColorRgb = parseCssColorToRgb(lightColor)
  const darkColorRgb = parseCssColorToRgb(darkColor)

  if (!backgroundColorRgb || !lightColorRgb || !darkColorRgb) return undefined

  const backgroundLuminance = determineColorLuminance(backgroundColorRgb.r, backgroundColorRgb.g, backgroundColorRgb.b)
  const lightColorLuminance = determineColorLuminance(lightColorRgb.r, lightColorRgb.g, lightColorRgb.b)
  const darkColorLuminance = determineColorLuminance(darkColorRgb.r, darkColorRgb.g, darkColorRgb.b)
  const lightContrastScore = computeContrastScore(backgroundLuminance, lightColorLuminance)
  const darkContrastScore = computeContrastScore(backgroundLuminance, darkColorLuminance)

  return lightContrastScore >= darkContrastScore ? lightColor : darkColor
}

export type TStepperProps = NumberFieldProps & {
  "data-testid"?: string
  height?: string | number
  width?: string | number
  color?: string
  colorMode?: TAvailableColorModes
  textSize?: TAvailableInputSizes
  order?: TThemingOrderCode
  type?: TAvailableStepperTypes
  geometry?: TCornerGeometry
  orientation?: TAvailableStepperOrientations
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  PlusIcon?: ReactNode
  MinusIcon?: ReactNode
  labels?: TPartialStepperLabels
  customStyles?: CSSProperties
  customGroupStyles?: CSSProperties
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
}

type TStepperClassNameRenderProps = NumberFieldRenderProps & {
  defaultClassName: string | undefined
}

type TStepperStyleRenderProps = NumberFieldRenderProps & {
  defaultStyle: CSSProperties
}

type TStepperCalibration = {
  stepperStyles: TStepperProps["className"]
  stepperStyle: TStepperProps["style"]
  stepperGroupStyles: string
  computedButtonColorMode: TAvailableButtonColorModes
  computedButtonTransparencyStatus: boolean
  computedButtonRaisedStatus: boolean
  customStyles: CSSProperties
  customGroupStyles: CSSProperties
  customInputStyles: CSSProperties
  customButtonStyles: CSSProperties
  MinusIcon: ReactNode
  PlusIcon: ReactNode
}

const mergeStepperClassNames = (
  computedClassName: string,
  classNameProp: NumberFieldProps["className"],
): NumberFieldProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TStepperClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeStepperStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeStepperStyle = (
  computedStyles: CSSProperties,
  styleProp: NumberFieldProps["style"],
): NumberFieldProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TStepperStyleRenderProps) => mergeStepperStyles(computedStyles, styleProp(styleProps))
  }

  return mergeStepperStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TStepperProps) => {
  const { geometry = ROUND } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["stepper__group--rounded"]
    case ROUND:
      return styles["stepper__group--round"]
    default:
      return undefined
  }
}

const computeColorStyle = (props: TStepperProps) => {
  const { order, color, colorMode = COLOR_MODE__FILL, type = STEPPER_TYPE__SEGMENTED } = props
  let colorStyle: string | undefined = undefined

  if (color) return

  // -> Color mode and theming order have no styling effect on segmented Stepper groups.
  if (type === STEPPER_TYPE__SEGMENTED) return styles["stepper__group--segmented"]

  if (type === STEPPER_TYPE__COHESIVE && order === undefined) {
    if (colorMode === COLOR_MODE__FILL) return styles["stepper__group--cohesive--fill"]
    if (colorMode === COLOR_MODE__OUTLINE) return styles["stepper__group--cohesive--outline"]
  }

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--primary"]
          : styles["stepper__group--cohesive--outline--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--secondary"]
          : styles["stepper__group--cohesive--outline--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--tertiary"]
          : styles["stepper__group--cohesive--outline--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--quaternary"]
          : styles["stepper__group--cohesive--outline--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--quintenary"]
          : styles["stepper__group--cohesive--outline--quintenary"]
      break
    default:
      colorStyle =
        colorMode === COLOR_MODE__FILL
          ? styles["stepper__group--cohesive--fill--primary"]
          : styles["stepper__group--cohesive--outline--primary"]
      break
  }

  return colorStyle
}

const computeValidationStyle = (props: TStepperProps) => {
  const { errorState, warningState, successState } = props

  if (errorState) return styles["stepper--errorState"]
  if (warningState) return styles["stepper--warningState"]
  if (successState) return styles["stepper--successState"]

  return undefined
}

export const useComputeButtonColorMode = (props: TStepperProps): TAvailableButtonColorModes => {
  const computedButtonColorMode = useMemo(() => {
    const { colorMode: stepperColorMode, type } = props
    let computedButtonColorMode: TAvailableButtonColorModes = COLOR_MODE__FILL

    if (type === STEPPER_TYPE__COHESIVE) {
      if (stepperColorMode === COLOR_MODE__FILL) {
        computedButtonColorMode = COLOR_MODE__FILL
      } else if (stepperColorMode === COLOR_MODE__OUTLINE) {
        computedButtonColorMode = COLOR_MODE__FILL
      }
    } else if (type === STEPPER_TYPE__SEGMENTED) {
      if (stepperColorMode === COLOR_MODE__FILL) {
        computedButtonColorMode = COLOR_MODE__FILL
      } else if (stepperColorMode === COLOR_MODE__OUTLINE) {
        computedButtonColorMode = COLOR_MODE__OUTLINE
      }
    }

    return computedButtonColorMode
  }, [props])

  return computedButtonColorMode
}

const computeStepperInputMargins = (props: TStepperProps) => {
  const { type, orientation } = props
  const computedMargins = { marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0 }

  if (type === STEPPER_TYPE__SEGMENTED) return computedMargins

  if (orientation === ORIENTATION__HORIZONTAL) {
    computedMargins.marginTop = 2.5
    computedMargins.marginBottom = 2.5
  } else {
    computedMargins.marginTop = 2.5
    computedMargins.marginBottom = 2.5
  }

  return computedMargins
}

const resolveCohesiveStepperActionForeground = (order: TThemingOrderCode): string => {
  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      return "var(--aui-action-primary-foreground)"
    case THEME_ORDER_CODE__SECONDARY:
      return "var(--aui-action-secondary-foreground)"
    case THEME_ORDER_CODE__TERTIARY:
      return "var(--aui-action-tertiary-foreground)"
    case THEME_ORDER_CODE__QUATERNARY:
      return "var(--aui-action-quaternary-foreground)"
    case THEME_ORDER_CODE__QUINTENARY:
      return "var(--aui-action-quintenary-foreground)"
    default:
      return "var(--aui-action-primary-foreground)"
  }
}

const computeStepperInputColor = (props: TStepperProps): string | undefined => {
  const { color, colorMode = COLOR_MODE__FILL, type, order } = props

  if (type !== STEPPER_TYPE__COHESIVE) return undefined

  if (color) {
    if (colorMode === COLOR_MODE__OUTLINE) return color

    const readableTextColor = determineReadableTextColor(
      color,
      DEFAULT_LIGHT_ACTION_FOREGROUND,
      DEFAULT_DARK_ACTION_FOREGROUND,
    )

    return readableTextColor ?? DEFAULT_LIGHT_ACTION_FOREGROUND
  }

  if (colorMode === COLOR_MODE__OUTLINE) return "var(--aui-control-foreground)"

  if (!order) return "var(--aui-control-background)"

  return resolveCohesiveStepperActionForeground(order)
}

export const useCalibrateComponent = (props: TStepperProps): TStepperCalibration => {
  const { stepper, stepper__group } = styles
  const {
    enableFocusStyle,
    offsetFocusRing = true,
    orientation = ORIENTATION__HORIZONTAL,
    type,
    height,
    width,
    customStyles: customStyles__props,
    customGroupStyles: customGroupStyles__props,
    customInputStyles: customInputStyles__props,
    customButtonStyles: customButtonStyles__props,
    color,
    colorMode = COLOR_MODE__FILL,
    className,
    style,
  } = props
  let { MinusIcon, PlusIcon } = props

  if (!MinusIcon) MinusIcon = <StepperDefaultMinusIcon color="currentColor" />
  if (!PlusIcon) PlusIcon = <StepperDefaultPlusIcon color="currentColor" />

  const geometryStyle = computeGeometryStyle(props)
  const colorStyle = computeColorStyle(props)
  const stepperInputMarginStyles = computeStepperInputMargins(props)
  const validationStyle = computeValidationStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["stepper--noFocusStyle"]
      : styles["stepper--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing === true ? styles["stepper--offsetFocusRing"] : undefined
  const orientationStyle =
    orientation === ORIENTATION__HORIZONTAL ? styles["stepper__group--horizontal"] : styles["stepper__group--vertical"]
  const computedButtonColorMode = useComputeButtonColorMode(props)
  const computedInputColor = computeStepperInputColor(props)

  const computedGroupColorStyle: CSSProperties = {}
  if (color) {
    if (colorMode === COLOR_MODE__FILL) computedGroupColorStyle.backgroundColor = color
    else if (colorMode === COLOR_MODE__OUTLINE) computedGroupColorStyle.borderColor = color
  }

  const computedButtonRaisedStatus = useMemo(() => (type !== STEPPER_TYPE__COHESIVE ? true : false), [type])
  const computedButtonTransparencyStatus = useMemo(
    () => (type === STEPPER_TYPE__COHESIVE && colorMode === COLOR_MODE__OUTLINE ? true : false),
    [type, colorMode],
  )
  const computedStepperStyles = classNames(stepper, geometryStyle)
  const stepperGroupStyles = classNames(
    stepper__group,
    colorStyle,
    orientationStyle,
    geometryStyle,
    validationStyle,
    focusStyle,
    offsetFocusRingStyle,
  )
  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const stepperStyles = mergeStepperClassNames(computedStepperStyles, className)
  const stepperStyle = computeStepperStyle(customStyles, style)
  const customGroupStyles = Object.assign(
    { height, width },
    { ...computedGroupColorStyle },
    { ...customGroupStyles__props },
  )
  const customInputStyles = Object.assign(
    {
      backgroundColor: "transparent",
      width: "auto",
      minWidth: 25,
      maxWidth: 40,
      borderColor: type === STEPPER_TYPE__COHESIVE ? computedInputColor : undefined,
      color: computedInputColor,
      ...stepperInputMarginStyles,
    },
    { ...customInputStyles__props },
  )
  const computedButtonColor =
    type === STEPPER_TYPE__COHESIVE && computedInputColor !== undefined ? computedInputColor : color
  const customButtonStyles = Object.assign(
    { aspectRatio: 1, color: computedButtonColor },
    { ...customButtonStyles__props },
  )

  return {
    stepperStyles,
    stepperGroupStyles,
    computedButtonColorMode,
    computedButtonTransparencyStatus,
    computedButtonRaisedStatus,
    customStyles,
    stepperStyle,
    customGroupStyles,
    customInputStyles,
    customButtonStyles,
    MinusIcon,
    PlusIcon,
  }
}
