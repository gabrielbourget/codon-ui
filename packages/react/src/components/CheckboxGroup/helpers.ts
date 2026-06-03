import classNames from "classnames"
import type { CSSProperties } from "react"
import type { CheckboxGroupProps, CheckboxGroupRenderProps } from "react-aria-components"

import styles from "./CheckboxGroupStyles.module.css"

export const ORIENTATION__HORIZONTAL = "horizontal"
export const ORIENTATION__VERTICAL = "vertical"
export const CHECKBOX_GROUP_ORIENTATIONS = [ORIENTATION__HORIZONTAL, ORIENTATION__VERTICAL] as const
export type TCheckboxGroupOrientations = (typeof CHECKBOX_GROUP_ORIENTATIONS)[number]

export type TCheckboxGroupProps = CheckboxGroupProps & {
  "data-testid"?: string
  orientation?: TCheckboxGroupOrientations
  customClassName?: string
  customStyles?: CSSProperties
}

type TCheckboxGroupClassNameRenderProps = CheckboxGroupRenderProps & {
  defaultClassName: string | undefined
}

type TCheckboxGroupStyleRenderProps = CheckboxGroupRenderProps & {
  defaultStyle: CSSProperties
}

type TCheckboxGroupCalibration = {
  checkboxGroupStyles: TCheckboxGroupProps["className"]
  checkboxGroupStyle: TCheckboxGroupProps["style"]
  customStyles: CSSProperties
}

const mergeCheckboxGroupClassNames = (
  computedClassName: string,
  classNameProp: CheckboxGroupProps["className"],
): CheckboxGroupProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TCheckboxGroupClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeCheckboxGroupStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeCheckboxGroupStyle = (
  computedStyles: CSSProperties,
  styleProp: CheckboxGroupProps["style"],
): CheckboxGroupProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TCheckboxGroupStyleRenderProps) =>
      mergeCheckboxGroupStyles(computedStyles, styleProp(styleProps))
  }

  return mergeCheckboxGroupStyles(computedStyles, styleProp)
}

export const calibrateComponent = (props: TCheckboxGroupProps): TCheckboxGroupCalibration => {
  const {
    className,
    customClassName,
    customStyles: customStyles__props,
    orientation = ORIENTATION__VERTICAL,
    style,
  } = props
  const { checkboxGroup } = styles

  const orientationStyle =
    orientation === ORIENTATION__HORIZONTAL ? styles["checkboxGroup--horizontal"] : styles["checkboxGroup--vertical"]
  const computedCheckboxGroupStyles = classNames(checkboxGroup, orientationStyle, customClassName)
  const checkboxGroupStyles = mergeCheckboxGroupClassNames(computedCheckboxGroupStyles, className)
  const customStyles = { ...customStyles__props }
  const checkboxGroupStyle = computeCheckboxGroupStyle(customStyles, style)

  return { checkboxGroupStyles, checkboxGroupStyle, customStyles }
}
