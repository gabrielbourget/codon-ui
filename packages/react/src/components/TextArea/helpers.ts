import classNames from "classnames"
import type { CSSProperties } from "react"
import type { InputRenderProps, TextAreaProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import textStyles from "../Text/TextStyles.module.css"

import styles from "./TextAreaStyles.module.css"

export const TEXTAREA_SIZE__SM = "small"
export const TEXTAREA_SIZE__MD = "medium"
export const TEXTAREA_SIZE__LG = "large"

export const AVAILABLE_TEXTAREA_SIZES = [TEXTAREA_SIZE__SM, TEXTAREA_SIZE__MD, TEXTAREA_SIZE__LG]
type TAvailableTextAreaSizes = (typeof AVAILABLE_TEXTAREA_SIZES)[number]

export const TEXTAREA_RESIZE__NONE = "none"
export const TEXTAREA_RESIZE__VERTICAL = "vertical"
export const TEXTAREA_RESIZE__HORIZONTAL = "horizontal"
export const TEXTAREA_RESIZE__BOTH = "both"

export const AVAILABLE_TEXTAREA_RESIZE_OPTIONS = [
  TEXTAREA_RESIZE__NONE,
  TEXTAREA_RESIZE__VERTICAL,
  TEXTAREA_RESIZE__HORIZONTAL,
  TEXTAREA_RESIZE__BOTH,
] as const
type TResizeOption = (typeof AVAILABLE_TEXTAREA_RESIZE_OPTIONS)[number]

export type TTextAreaProps = Omit<TextAreaProps, "disabled"> & {
  "data-testid"?: string
  height?: number
  width?: number
  textSize?: TAvailableTextAreaSizes
  resize?: TResizeOption
  geometry?: TCornerGeometry
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  isDisabled?: boolean
  customStyles?: CSSProperties
}

type TTextAreaClassNameRenderProps = InputRenderProps & {
  defaultClassName: string | undefined
}

type TTextAreaCalibration = {
  textAreaStyles: TTextAreaProps["className"]
  textAreaStyle: TTextAreaProps["style"]
  customStyles: CSSProperties
}

type TTextAreaStyleRenderProps = InputRenderProps & {
  defaultStyle: CSSProperties
}

const mergeTextAreaClassNames = (
  computedClassName: string,
  classNameProp: TextAreaProps["className"],
): TextAreaProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TTextAreaClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeTextAreaStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeTextAreaStyle = (
  computedStyles: CSSProperties,
  styleProp: TextAreaProps["style"],
): TextAreaProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TTextAreaStyleRenderProps) => mergeTextAreaStyles(computedStyles, styleProp(styleProps))
  }

  return mergeTextAreaStyles(computedStyles, styleProp)
}

const computeGeometryStyle = (props: TTextAreaProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["textArea--rounded"]
    case ROUND:
      return styles["textArea--round"]
    default:
      return undefined
  }
}

const computeTextSizeStyle = (props: TTextAreaProps) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case TEXTAREA_SIZE__SM:
      textSizeStyle = b11
      break
    case TEXTAREA_SIZE__MD:
      textSizeStyle = b10
      break
    case TEXTAREA_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeResizeStyle = (props: TTextAreaProps) => {
  const { resize } = props
  let resizeStyle: string | undefined = undefined

  switch (resize) {
    case TEXTAREA_RESIZE__NONE:
      resizeStyle = styles["textArea--resizeNone"]
      break
    case TEXTAREA_RESIZE__VERTICAL:
      resizeStyle = styles["textArea--resizeVertical"]
      break
    case TEXTAREA_RESIZE__HORIZONTAL:
      resizeStyle = styles["textArea--resizeHorizontal"]
      break
    case TEXTAREA_RESIZE__BOTH:
      resizeStyle = styles["textArea--resizeBoth"]
      break
    default:
      resizeStyle = styles["textArea--resizeVertical"]
      break
  }

  return resizeStyle
}

const computeValidationStyle = (props: TTextAreaProps) => {
  const { errorState, warningState, successState } = props

  if (errorState) return styles["textArea--errorState"]
  if (warningState) return styles["textArea--warningState"]
  if (successState) return styles["textArea--successState"]

  return undefined
}

export const calibrateComponent = (props: TTextAreaProps): TTextAreaCalibration => {
  const { textArea } = styles
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
  const resizeStyle = computeResizeStyle(props)
  const validationStyle = computeValidationStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["textArea--noFocusStyle"]
      : styles["textArea--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["textArea--offsetFocusRing"] : undefined

  const computedTextAreaStyles = classNames(
    textArea,
    textSizeStyle,
    resizeStyle,
    geometryStyle,
    validationStyle,
    textStyles["fw-regular"],
    focusStyle,
    offsetFocusRingStyle,
  )

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const textAreaStyles = mergeTextAreaClassNames(computedTextAreaStyles, className)
  const textAreaStyle = computeTextAreaStyle(customStyles, style)

  return { textAreaStyles, textAreaStyle, customStyles }
}
