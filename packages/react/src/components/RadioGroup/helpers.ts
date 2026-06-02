import classNames from "classnames"
import type { CSSProperties } from "react"
import type { RadioGroupProps, RadioGroupRenderProps } from "react-aria-components"

import styles from "./RadioGroupStyles.module.css"

export const ORIENTATION__HORIZONTAL = "horizontal"
export const ORIENTATION__VERTICAL = "vertical"
export const RADIO_GROUP_ORIENTATIONS = [ORIENTATION__HORIZONTAL, ORIENTATION__VERTICAL]
export type TRadioGroupOrientations = (typeof RADIO_GROUP_ORIENTATIONS)[number]

export type TRadioGroupProps = RadioGroupProps & {
  "data-testid"?: string
  orientation?: TRadioGroupOrientations
  customClassName?: string
  customStyles?: CSSProperties
}

type TRadioGroupClassNameRenderProps = RadioGroupRenderProps & {
  defaultClassName: string | undefined
}

type TRadioGroupStyleRenderProps = RadioGroupRenderProps & {
  defaultStyle: CSSProperties
}

type TRadioGroupCalibration = {
  radioGroupStyles: TRadioGroupProps["className"]
  radioGroupStyle: TRadioGroupProps["style"]
  customStyles: CSSProperties
}

const mergeRadioGroupClassNames = (
  computedClassName: string,
  classNameProp: RadioGroupProps["className"],
): RadioGroupProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TRadioGroupClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeRadioGroupStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeRadioGroupStyle = (
  computedStyles: CSSProperties,
  styleProp: RadioGroupProps["style"],
): RadioGroupProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TRadioGroupStyleRenderProps) => mergeRadioGroupStyles(computedStyles, styleProp(styleProps))
  }

  return mergeRadioGroupStyles(computedStyles, styleProp)
}

export const calibrateComponent = (props: TRadioGroupProps): TRadioGroupCalibration => {
  const {
    className,
    customClassName,
    customStyles: customStyles__props,
    orientation = ORIENTATION__VERTICAL,
    style,
  } = props
  const { radioGroup } = styles

  const orientationStyle =
    orientation === ORIENTATION__HORIZONTAL ? styles["radioGroup--horizontal"] : styles["radioGroup--vertical"]
  const computedRadioGroupStyles = classNames(radioGroup, orientationStyle, customClassName)
  const radioGroupStyles = mergeRadioGroupClassNames(computedRadioGroupStyles, className)
  const customStyles = { ...customStyles__props }
  const radioGroupStyle = computeRadioGroupStyle(customStyles, style)

  return { radioGroupStyles, radioGroupStyle, customStyles }
}
