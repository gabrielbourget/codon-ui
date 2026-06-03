import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { NumberFieldProps, NumberFieldRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"

import DefaultDecrementIcon from "./DefaultDecrementIcon"
import DefaultIncrementIcon from "./DefaultIncrementIcon"
import type { TPartialNumberInputLabels } from "./labels"
import styles from "./NumberInputStyles.module.css"

export const INPUT_SIZE__SM = "small"
export const INPUT_SIZE__MD = "medium"
export const INPUT_SIZE__LG = "large"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AVAILABLE_INPUT_SIZES = [INPUT_SIZE__SM, INPUT_SIZE__MD, INPUT_SIZE__LG]
export type TAvailableInputSizes = (typeof AVAILABLE_INPUT_SIZES)[number]

export type TNumberInputProps = NumberFieldProps & {
  "data-testid"?: string
  height?: number
  width?: number
  textSize?: TAvailableInputSizes
  geometry?: TCornerGeometry
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  placeholder?: string
  IncrementIcon?: ReactNode
  DecrementIcon?: ReactNode
  labels?: TPartialNumberInputLabels
  customStyles?: CSSProperties
  customGroupStyles?: CSSProperties
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
}

type TNumberInputClassNameRenderProps = NumberFieldRenderProps & {
  defaultClassName: string | undefined
}

type TNumberInputStyleRenderProps = NumberFieldRenderProps & {
  defaultStyle: CSSProperties
}

type TNumberInputCalibration = {
  numberInputStyles: TNumberInputProps["className"]
  numberInputStyle: TNumberInputProps["style"]
  numberInputGroupStyles: string
  buttonColumnStyles: string
  customStyles: CSSProperties
  customInputStyles: CSSProperties
  customButtonStyles: CSSProperties
  IncrementIcon: ReactNode
  DecrementIcon: ReactNode
}

const mergeNumberInputClassNames = (
  computedClassName: string,
  classNameProp: NumberFieldProps["className"],
): NumberFieldProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TNumberInputClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeNumberInputStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeNumberInputStyle = (
  computedStyles: CSSProperties,
  styleProp: NumberFieldProps["style"],
): NumberFieldProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TNumberInputStyleRenderProps) => mergeNumberInputStyles(computedStyles, styleProp(styleProps))
  }

  return mergeNumberInputStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TNumberInputProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["numberInput--rounded"]
    case ROUND:
      return styles["numberInput--round"]
    default:
      return undefined
  }
}

const computeValidationStyle = (props: TNumberInputProps) => {
  const { errorState, warningState, successState } = props

  if (errorState) return styles["numberInput--errorState"]
  if (warningState) return styles["numberInput--warningState"]
  if (successState) return styles["numberInput--successState"]

  return undefined
}

export const calibrateComponent = (props: TNumberInputProps): TNumberInputCalibration => {
  const { numberInput, numberInput__group, numberInput__buttonColumn, numberInput__icon } = styles
  const {
    customInputStyles: customInputStyles__props,
    customButtonStyles: customButtonStyles__props,
    enableFocusStyle,
    offsetFocusRing = true,
    customStyles: customStyles__props,
    height,
    width,
    className,
    style,
  } = props
  let { IncrementIcon, DecrementIcon } = props

  if (!IncrementIcon) IncrementIcon = <DefaultIncrementIcon size={15} customClassName={numberInput__icon} />
  if (!DecrementIcon) DecrementIcon = <DefaultDecrementIcon size={15} customClassName={numberInput__icon} />

  const geometryStyle = computeGeometryStyle(props)
  const validationStyle = computeValidationStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["numberInput--noFocusStyle"]
      : styles["numberInput--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing === true ? styles["numberInput--offsetFocusRing"] : undefined

  const computedNumberInputStyles = classNames(numberInput, geometryStyle)
  const numberInputGroupStyles = classNames(numberInput__group, validationStyle, focusStyle, offsetFocusRingStyle)
  const buttonColumnStyles = classNames(numberInput__buttonColumn)

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const numberInputStyles = mergeNumberInputClassNames(computedNumberInputStyles, className)
  const numberInputStyle = computeNumberInputStyle(customStyles, style)

  const customInputStyles = Object.assign(
    {
      border: "none",
      backgroundColor: "transparent",
    },
    { ...customInputStyles__props },
  )

  const customButtonStyles = Object.assign(
    {
      border: "none",
      backgroundColor: "transparent",
      padding: 0,
    },
    { ...customButtonStyles__props },
  )

  return {
    numberInputStyles,
    numberInputGroupStyles,
    buttonColumnStyles,
    customStyles,
    numberInputStyle,
    customInputStyles,
    customButtonStyles,
    IncrementIcon,
    DecrementIcon,
  }
}
