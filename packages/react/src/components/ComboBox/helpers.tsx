import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { ComboBoxProps, ComboBoxRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"

import styles from "./ComboBoxStyles.module.css"
import ComboBoxDefaultChevronDownIcon from "./DefaultChevronDownIcon"
import type { TPartialComboBoxLabels } from "./labels"

export const COMBOBOX_SIZE__SM = "small"
export const COMBOBOX_SIZE__MD = "medium"
export const COMBOBOX_SIZE__LG = "large"

export const AVAILABLE_COMBOBOX_SIZES = [COMBOBOX_SIZE__SM, COMBOBOX_SIZE__MD, COMBOBOX_SIZE__LG]
export type TAvailableComboBoxSizes = (typeof AVAILABLE_COMBOBOX_SIZES)[number]

export type TComboBoxProps<T extends object = object> = Omit<
  ComboBoxProps<T>,
  "children" | "items" | "selectedKey" | "defaultSelectedKey" | "onSelectionChange"
> & {
  "data-testid"?: string
  items?: Iterable<T>
  isOpen?: boolean
  height?: string | number
  width?: string | number
  color?: string
  geometry?: TCornerGeometry
  textSize?: TAvailableComboBoxSizes
  placement?: TAvailablePopoverPlacementPositions
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  emptyListMessage?: string
  labels?: TPartialComboBoxLabels
  shouldFocusWrap?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
  customInputButtonGroupStyles?: CSSProperties
  customOptionsListStyles?: CSSProperties
  customStyles?: CSSProperties
  children: ReactNode | ((item: T) => ReactNode)
}

type TComboBoxClassNameRenderProps = ComboBoxRenderProps & {
  defaultClassName: string | undefined
}

type TComboBoxStyleRenderProps = ComboBoxRenderProps & {
  defaultStyle: CSSProperties
}

type TComboBoxCalibration<T extends object> = {
  comboBoxStyles: TComboBoxProps<T>["className"]
  comboBoxStyle: TComboBoxProps<T>["style"]
  popoverStyles: string
  optionsListStyles: string
  inputButtonGroupStyles: string
  customStyles: CSSProperties
  customInputButtonGroupStyles: CSSProperties
  customTriggerButtonStyles: CSSProperties
  customInputStyles: CSSProperties
  ComponentIcon: ReactNode
}

const mergeComboBoxClassNames = <T extends object>(
  computedClassName: string,
  classNameProp: ComboBoxProps<T>["className"],
): ComboBoxProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TComboBoxClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeComboBoxStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeComboBoxStyle = <T extends object>(
  computedStyles: CSSProperties,
  styleProp: ComboBoxProps<T>["style"],
): ComboBoxProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TComboBoxStyleRenderProps) => mergeComboBoxStyles(computedStyles, styleProp(styleProps))
  }

  return mergeComboBoxStyles(computedStyles, styleProp)
}

const computeGeometryStyle = <T extends object>(props: TComboBoxProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["inputButtonGroup--rounded"]
    case ROUND:
      return styles["inputButtonGroup--round"]
    default:
      return undefined
  }
}

const computeComboBoxBorderStyle = <T extends object>(props: TComboBoxProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle: string | undefined = undefined

  if (errorState) {
    borderStyle = styles["inputButtonGroup--errorState"]
    return borderStyle
  }

  if (warningState) {
    borderStyle = styles["inputButtonGroup--warningState"]
    return borderStyle
  }

  if (successState) {
    borderStyle = styles["inputButtonGroup--successState"]
    return borderStyle
  }

  return borderStyle
}

export const calibrateComponent = <T extends object>(props: TComboBoxProps<T>): TComboBoxCalibration<T> => {
  const { comboBox, optionsList, popover, inputButtonGroup, comboBox__iconColor } = styles
  const {
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    height,
    width,
    color,
    className,
    customStyles: customStyles__props,
    customInputStyles: customInputStyles__props,
    customInputButtonGroupStyles: customInputButtonGroupStyles__props,
    customButtonStyles,
    style,
  } = props
  let { ComponentIcon } = props

  if (!ComponentIcon) ComponentIcon = <ComboBoxDefaultChevronDownIcon size={15} customClassName={comboBox__iconColor} />

  const geometryStyle = computeGeometryStyle(props)
  const comboBoxBorderStyle = computeComboBoxBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["inputButtonGroup--noFocusStyle"]
      : styles["inputButtonGroup--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["inputButtonGroup--offsetFocusRing"] : undefined

  const computedComboBoxStyles = classNames(comboBox)
  const optionsListStyles = classNames(optionsList)
  const popoverStyles = classNames(popover)
  const inputButtonGroupStyles = classNames(
    inputButtonGroup,
    comboBoxBorderStyle,
    geometryStyle,
    focusStyle,
    offsetFocusRingStyle,
  )

  const customStyles = Object.assign({ height, width, color }, { ...customStyles__props })
  const comboBoxStyles = mergeComboBoxClassNames(computedComboBoxStyles, className)
  const comboBoxStyle = computeComboBoxStyle(customStyles, style)

  const customInputButtonGroupStyles = Object.assign(
    { height, width, color },
    { ...customInputButtonGroupStyles__props },
  )

  const customInputStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color },
    { ...customInputStyles__props },
  )

  const customTriggerButtonStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color },
    { ...customButtonStyles },
  )

  return {
    comboBoxStyles,
    comboBoxStyle,
    popoverStyles,
    optionsListStyles,
    inputButtonGroupStyles,
    customStyles,
    customInputButtonGroupStyles,
    customTriggerButtonStyles,
    customInputStyles,
    ComponentIcon,
  }
}
