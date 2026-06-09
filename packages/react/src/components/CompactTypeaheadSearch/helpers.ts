import classNames from "classnames"
import { createElement, type CSSProperties, type ReactNode } from "react"
import type { ComboBoxProps, ComboBoxRenderProps, Key } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"

import styles from "./CompactTypeaheadSearchStyles.module.css"
import CompactTypeaheadSearchDefaultLoadingIndicator from "./DefaultLoadingIndicator"
import CompactTypeaheadSearchDefaultSearchIcon from "./DefaultSearchIcon"
import type { TPartialCompactTypeaheadSearchLabels } from "./labels"

export const TYPE_AHEAD_SEARCH_SIZE__SM = "small"
export const TYPE_AHEAD_SEARCH_SIZE__MD = "medium"
export const TYPE_AHEAD_SEARCH_SIZE__LG = "large"

export const AVAILABLE_TYPE_AHEAD_SEARCH_SIZES = [
  TYPE_AHEAD_SEARCH_SIZE__SM,
  TYPE_AHEAD_SEARCH_SIZE__MD,
  TYPE_AHEAD_SEARCH_SIZE__LG,
] as const
export type TAvailableCompactTypeaheadSearchSizes = (typeof AVAILABLE_TYPE_AHEAD_SEARCH_SIZES)[number]

export type TCompactTypeaheadSearchRenderItemArgs = {
  query: string
  textValue: string
  itemKey: Key
}

export type TCompactTypeaheadSearchState = {
  internalInputValue: string
  isOpen: boolean
  suppressMinimumQueryState: boolean
}

type TCompactTypeaheadSearchSharedProps<T extends object> = Omit<
  ComboBoxProps<T>,
  | "children"
  | "defaultInputValue"
  | "inputValue"
  | "items"
  | "onInputChange"
  | "selectedKey"
  | "defaultSelectedKey"
  | "onSelectionChange"
> & {
  "data-testid"?: string
  items?: Iterable<T>
  isLoading?: boolean
  isOpen?: boolean
  placeholder?: string
  inputValue?: string
  defaultInputValue?: string
  onInputChange?: (value: string) => void
  height?: string | number
  width?: string | number
  color?: string
  geometry?: TCornerGeometry
  textSize?: TAvailableCompactTypeaheadSearchSizes
  placement?: TAvailablePopoverPlacementPositions
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  emptyListMessage?: string
  loadingMessage?: string
  minimumInputLength?: number
  minimumInputLengthMessage?: string
  labels?: TPartialCompactTypeaheadSearchLabels
  shouldFocusWrap?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  rtl?: boolean
  SearchIcon?: ReactNode
  LoadingIndicator?: ReactNode
  getItemKey?: (item: T) => Key
  getItemTextValue?: (item: T) => string
  renderItem?: (item: T, args: TCompactTypeaheadSearchRenderItemArgs) => ReactNode
  customInputStyles?: CSSProperties
  customButtonStyles?: CSSProperties
  customInputButtonGroupStyles?: CSSProperties
  customOptionsListStyles?: CSSProperties
  customStyles?: CSSProperties
}

export type TCompactTypeaheadSearchProps<T extends object> = TCompactTypeaheadSearchSharedProps<T>

type TCompactTypeaheadSearchClassNameRenderProps = ComboBoxRenderProps & {
  defaultClassName: string | undefined
}

type TCompactTypeaheadSearchStyleRenderProps = ComboBoxRenderProps & {
  defaultStyle: CSSProperties
}

type TCompactTypeaheadSearchCalibration<T extends object> = {
  typeAheadSearchStyles: TCompactTypeaheadSearchProps<T>["className"]
  typeAheadSearchStyle: TCompactTypeaheadSearchProps<T>["style"]
  popoverStyles: string
  optionsListStyles: string
  inputButtonGroupStyles: string
  customStyles: CSSProperties
  customInputButtonGroupStyles: CSSProperties
  customButtonStyles: CSSProperties
  customInputStyles: CSSProperties
  SearchIcon: ReactNode
  LoadingIndicator: ReactNode
}

const mergeCompactTypeaheadSearchClassNames = <T extends object>(
  computedClassName: string,
  classNameProp: ComboBoxProps<T>["className"],
): ComboBoxProps<T>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TCompactTypeaheadSearchClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeCompactTypeaheadSearchStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeCompactTypeaheadSearchStyle = <T extends object>(
  computedStyles: CSSProperties,
  styleProp: ComboBoxProps<T>["style"],
): ComboBoxProps<T>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TCompactTypeaheadSearchStyleRenderProps) =>
      mergeCompactTypeaheadSearchStyles(computedStyles, styleProp(styleProps))
  }

  return mergeCompactTypeaheadSearchStyles(computedStyles, styleProp)
}

const computeGeometryStyle = <T extends object>(props: TCompactTypeaheadSearchProps<T>) => {
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

const computeCompactTypeaheadSearchBorderStyle = <T extends object>(props: TCompactTypeaheadSearchProps<T>) => {
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

export const calibrateComponent = <T extends object>(
  props: TCompactTypeaheadSearchProps<T>,
): TCompactTypeaheadSearchCalibration<T> => {
  const { typeAheadSearch, popover, optionsList, inputButtonGroup, typeAheadSearch__iconColor } = styles
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
    customButtonStyles: customButtonStyles__props,
    rtl = false,
    style,
  } = props
  let { SearchIcon, LoadingIndicator } = props

  if (!SearchIcon)
    SearchIcon = createElement(CompactTypeaheadSearchDefaultSearchIcon, {
      size: 15,
      customClassName: typeAheadSearch__iconColor,
      "data-testid": "type-ahead-search-default-search-icon",
    })
  if (!LoadingIndicator) {
    LoadingIndicator = createElement(CompactTypeaheadSearchDefaultLoadingIndicator, {
      size: 18,
      spinnerTrackWidth: 2.5,
      spinnerTrackIsTransparent: true,
      testID: "type-ahead-search-default-loading-indicator",
    })
  }

  const geometryStyle = computeGeometryStyle(props)
  const typeAheadSearchBorderStyle = computeCompactTypeaheadSearchBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["inputButtonGroup--noFocusStyle"]
      : styles["inputButtonGroup--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["inputButtonGroup--offsetFocusRing"] : undefined
  const rtlStyle = rtl ? styles["inputButtonGroup--rtl"] : undefined

  const computedTypeAheadSearchStyles = classNames(typeAheadSearch)
  const optionsListStyles = classNames(optionsList)
  const popoverStyles = classNames(popover)
  const inputButtonGroupStyles = classNames(
    inputButtonGroup,
    typeAheadSearchBorderStyle,
    geometryStyle,
    focusStyle,
    offsetFocusRingStyle,
    rtlStyle,
  )

  const customStyles = Object.assign({ height, width: width ?? "100%", color }, { ...customStyles__props })
  const typeAheadSearchStyles = mergeCompactTypeaheadSearchClassNames(computedTypeAheadSearchStyles, className)
  const typeAheadSearchStyle = computeCompactTypeaheadSearchStyle(customStyles, style)

  const customInputButtonGroupStyles = Object.assign(
    { height, width: width ?? "100%", color },
    { ...customInputButtonGroupStyles__props },
  )

  const customInputStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color },
    { ...customInputStyles__props },
  )

  const customButtonStyles = Object.assign(
    { border: "none", backgroundColor: "transparent", color, height: "100%" },
    { ...customButtonStyles__props },
  )

  return {
    typeAheadSearchStyles,
    typeAheadSearchStyle,
    popoverStyles,
    optionsListStyles,
    inputButtonGroupStyles,
    customStyles,
    customInputButtonGroupStyles,
    customButtonStyles,
    customInputStyles,
    SearchIcon,
    LoadingIndicator,
  }
}
