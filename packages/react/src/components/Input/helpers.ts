import classNames from "classnames"
import type { CSSProperties } from "react"
import type { InputProps, InputRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import textStyles from "../Text/TextStyles.module.css"

import styles from "./InputStyles.module.css"

export const INPUT_SIZE__SM = "small"
export const INPUT_SIZE__MD = "medium"
export const INPUT_SIZE__LG = "large"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AVAILABLE_INPUT_SIZES = [INPUT_SIZE__SM, INPUT_SIZE__MD, INPUT_SIZE__LG]
export type TAvailableInputSizes = (typeof AVAILABLE_INPUT_SIZES)[number]

export type TInputProps = Omit<InputProps, "disabled"> & {
  "data-testid"?: string
  height?: number
  width?: number
  textSize?: TAvailableInputSizes
  geometry?: TCornerGeometry
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  customStyles?: CSSProperties
}

type TInputClassNameRenderProps = InputRenderProps & {
  defaultClassName: string | undefined
}

type TInputCalibration = {
  inputStyles: TInputProps["className"]
  inputStyle: TInputProps["style"]
  customStyles: CSSProperties
}

type TInputStyleRenderProps = InputRenderProps & {
  defaultStyle: CSSProperties
}

const mergeInputClassNames = (
  computedClassName: string,
  classNameProp: InputProps["className"],
): InputProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TInputClassNameRenderProps) => classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeInputStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeInputStyle = (computedStyles: CSSProperties, styleProp: InputProps["style"]): InputProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TInputStyleRenderProps) => mergeInputStyles(computedStyles, styleProp(styleProps))
  }

  return mergeInputStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TInputProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["input--rounded"]
    case ROUND:
      return styles["input--round"]
    default:
      return undefined
  }
}

const computeTextSizeStyle = (props: TInputProps) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case INPUT_SIZE__SM:
      textSizeStyle = b11
      break
    case INPUT_SIZE__MD:
      textSizeStyle = b10
      break
    case INPUT_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeValidationStyle = (props: TInputProps) => {
  const { errorState, warningState, successState } = props

  if (errorState) return styles["input--errorState"]
  if (warningState) return styles["input--warningState"]
  if (successState) return styles["input--successState"]

  return undefined
}

export const calibrateComponent = (props: TInputProps): TInputCalibration => {
  const { input } = styles
  const {
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    customStyles: customStyles__props,
    height,
    width,
    className,
    style,
  } = props

  const geometryStyle = computeGeometryStyle(props)
  const textSizeStyle = computeTextSizeStyle(props)
  const validationStyle = computeValidationStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["input--noFocusStyle"]
      : styles["input--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["input--offsetFocusRing"] : undefined

  const computedInputStyles = classNames(
    input,
    geometryStyle,
    textSizeStyle,
    validationStyle,
    focusStyle,
    offsetFocusRingStyle,
    textStyles["fw-regular"],
  )

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const inputStyles = mergeInputClassNames(computedInputStyles, className)
  const inputStyle = computeInputStyle(customStyles, style)

  return { inputStyles, inputStyle, customStyles }
}
