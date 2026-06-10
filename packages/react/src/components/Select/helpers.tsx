import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { SelectProps, SelectRenderProps } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"
import textStyles from "../Text/TextStyles.module.css"

import SelectDefaultChevronDownIcon from "./DefaultChevronDownIcon"
import styles from "./SelectStyles.module.css"

export const SELECT_SIZE__SM = "small"
export const SELECT_SIZE__MD = "medium"
export const SELECT_SIZE__LG = "large"

export const AVAILABLE_SELECT_SIZES = [SELECT_SIZE__SM, SELECT_SIZE__MD, SELECT_SIZE__LG]
type TAvailableSelectSizes = (typeof AVAILABLE_SELECT_SIZES)[number]

export type TSelectProps<T extends object = object> = Omit<
  SelectProps<T>,
  "children" | "items" | "selectedKey" | "defaultSelectedKey" | "onSelectionChange"
> & {
  "data-testid"?: string
  items?: Iterable<T>
  isOpen?: boolean
  isDisabled?: boolean
  emptyListMessage?: string
  shouldFocusWrap?: boolean
  children: ReactNode | ((item: T) => ReactNode)
  height?: string | number
  width?: string | number
  textSize?: TAvailableSelectSizes
  geometry?: TCornerGeometry
  placement?: TAvailablePopoverPlacementPositions
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  ComponentIcon?: ReactNode
  customStyles?: CSSProperties
  customClassName?: string
  customSelectedItemStyles?: CSSProperties
  customSelectedItemTextStyles?: CSSProperties
  customOptionsListStyles?: CSSProperties
}

type TSelectClassNameRenderProps = SelectRenderProps & {
  defaultClassName: string | undefined
}

type TSelectStyleRenderProps = SelectRenderProps & {
  defaultStyle: CSSProperties
}

type TSelectCalibration<T extends object> = {
  selectStyles: TSelectProps<T>["className"]
  selectStyle: TSelectProps<T>["style"]
  selectedItemTextStyles: string
  popoverStyles: string
  optionsListStyles: string
  customSelectedItemStyles: CSSProperties
  customStyles: CSSProperties
  ComponentIcon: ReactNode
}

const mergeSelectClassNames = <T extends object>(
  computedClassName: string,
  customClassName: string | undefined,
  classNameProp: SelectProps<T>["className"],
): SelectProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TSelectClassNameRenderProps) =>
      classNames(computedClassName, customClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, customClassName, classNameProp)
}

const mergeSelectStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeSelectStyle = <T extends object>(
  computedStyles: CSSProperties,
  styleProp: SelectProps<T>["style"],
): SelectProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TSelectStyleRenderProps) => mergeSelectStyles(computedStyles, styleProp(styleProps))
  }

  return mergeSelectStyles(computedStyles, styleProp)
}

const computeButtonTextSizeStyle = <T extends object>(props: TSelectProps<T>) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle = ""

  switch (textSize) {
    case SELECT_SIZE__SM:
      textSizeStyle = b11
      break
    case SELECT_SIZE__MD:
      textSizeStyle = b10
      break
    case SELECT_SIZE__LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

const computeButtonBorderStyle = <T extends object>(props: TSelectProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle = "1px solid var(--cui-control-border)"

  if (errorState) {
    borderStyle = "1px solid var(--cui-validation-error-border)"
    return borderStyle
  }

  if (warningState) {
    borderStyle = "1px solid var(--cui-validation-warning-border)"
    return borderStyle
  }

  if (successState) {
    borderStyle = "1px solid var(--cui-validation-success-border)"
    return borderStyle
  }

  return borderStyle
}

const computeGeometryStyle = <T extends object>(props: TSelectProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["select--rounded"]
    case ROUND:
      return styles["select--round"]
    default:
      return undefined
  }
}

export const calibrateComponent = <T extends object>(props: TSelectProps<T>): TSelectCalibration<T> => {
  const { select, optionsList, popover, selectedItem, select__iconColor } = styles
  const {
    customStyles: customStyles__props,
    customSelectedItemStyles: customSelectedItemStyles__props,
    className,
    customClassName,
    height,
    style,
    width,
  } = props
  let { ComponentIcon } = props

  if (!ComponentIcon) ComponentIcon = <SelectDefaultChevronDownIcon size={15} customClassName={select__iconColor} />

  const textSizeStyle = computeButtonTextSizeStyle(props)
  const geometryStyle = computeGeometryStyle(props)
  const buttonBorderStyle = computeButtonBorderStyle(props)

  const computedSelectStyles = classNames(select, geometryStyle)
  const selectedItemTextStyles = classNames(selectedItem, textSizeStyle, textStyles["fw-regular"])
  const popoverStyles = classNames(popover)
  const optionsListStyles = classNames(optionsList)
  const customStyles = Object.assign({ height, width }, { ...customStyles__props })
  const selectStyles = mergeSelectClassNames(computedSelectStyles, customClassName, className)
  const selectStyle = computeSelectStyle(customStyles, style)

  const customSelectedItemStyles = Object.assign(
    {
      border: buttonBorderStyle,
      height: "100%",
      width: "100%",
      justifyContent: "space-between",
    },
    { ...customSelectedItemStyles__props },
  )

  return {
    selectStyles,
    selectStyle,
    selectedItemTextStyles,
    popoverStyles,
    optionsListStyles,
    customSelectedItemStyles,
    customStyles,
    ComponentIcon,
  }
}
