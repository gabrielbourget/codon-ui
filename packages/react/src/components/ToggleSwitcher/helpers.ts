import classNames from "classnames"
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./ToggleSwitcherStyles.module.css"

export type TToggleSwitcherFontWeight =
  | "lighter"
  | "light"
  | "regular"
  | "normal"
  | "medium"
  | "semibold"
  | "bold"
  | "extrabold"
  | "bolder"

export type TToggleSwitcherItem = {
  id: string
  label: ReactNode
  disabled?: boolean
}

export type TToggleSwitcherProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange"> & {
  "data-testid"?: string
  items: TToggleSwitcherItem[]
  selectedKey?: string
  defaultSelectedKey?: string
  onSelectionChange?: (key: string) => void
  isDisabled?: boolean
  isReadOnly?: boolean
  height?: number | string
  width?: number | string
  color?: string
  geometry?: TCornerGeometry
  order?: TThemingOrderCode
  raised?: boolean
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  uppercase?: boolean
  fontSize?: number | string
  optionFontWeight?: TToggleSwitcherFontWeight
  selectedOptionFontWeight?: TToggleSwitcherFontWeight
  customStyles?: CSSProperties
  customOptionStyles?: CSSProperties
  customSelectedOptionStyles?: CSSProperties
  customClassName?: string
  customOptionClassName?: string
  customSelectedOptionClassName?: string
}

type TToggleSwitcherCalibration = {
  toggleSwitcherStyles: string
  optionStyles: string
  selectedOptionStyles: string
  selectedOptionLabelStyles: string
  selectedOptionSurfaceStyles: string
  customStyles: CSSProperties
  customOptionStyles: CSSProperties
  customSelectedOptionStyles: CSSProperties
}

const computeToggleSwitcherGeometryStyle = (props: TToggleSwitcherProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["toggleSwitcher--rounded"]
    case ROUND:
      return styles["toggleSwitcher--round"]
    default:
      return undefined
  }
}

const computeToggleSwitcherOptionGeometryStyle = (props: TToggleSwitcherProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["toggleSwitcher__option--rounded"]
    case ROUND:
      return styles["toggleSwitcher__option--round"]
    default:
      return undefined
  }
}

const computeToggleSwitcherOptionColorStyle = (props: TToggleSwitcherProps) => {
  const { color, order } = props
  if (color) return styles["toggleSwitcher__option--custom"]

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      return styles["toggleSwitcher__option--primary"]
    case THEME_ORDER_CODE__SECONDARY:
      return styles["toggleSwitcher__option--secondary"]
    case THEME_ORDER_CODE__TERTIARY:
      return styles["toggleSwitcher__option--tertiary"]
    case THEME_ORDER_CODE__QUATERNARY:
      return styles["toggleSwitcher__option--quaternary"]
    case THEME_ORDER_CODE__QUINTENARY:
      return styles["toggleSwitcher__option--quintenary"]
    default:
      return styles["toggleSwitcher__option--default"]
  }
}

export const calibrateComponent = (props: TToggleSwitcherProps): TToggleSwitcherCalibration => {
  const {
    color,
    className,
    customClassName,
    customOptionClassName,
    customOptionStyles: customOptionStyles__props,
    customSelectedOptionClassName,
    customSelectedOptionStyles: customSelectedOptionStyles__props,
    customStyles: customStyles__props,
    enableFocusStyle,
    fontSize = 12,
    height,
    offsetFocusRing: offsetFocusRing__props = true,
    optionFontWeight,
    raised = false,
    selectedOptionFontWeight,
    style,
    uppercase = false,
    width,
  } = props

  const toggleSwitcherGeometryStyle = computeToggleSwitcherGeometryStyle(props)
  const optionGeometryStyle = computeToggleSwitcherOptionGeometryStyle(props)
  const optionColorStyle = computeToggleSwitcherOptionColorStyle(props)
  const raisedStyle = raised ? styles["toggleSwitcher--raised"] : undefined
  const uppercaseStyle = uppercase ? styles["toggleSwitcher__option--uppercase"] : undefined
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["toggleSwitcher__option--noFocusStyle"]
      : styles["toggleSwitcher__option--applyFocusStyle"]
  const offsetFocusRingStyle =
    offsetFocusRing__props === true ? styles["toggleSwitcher__option--offsetFocusRing"] : undefined

  const toggleSwitcherStyles = classNames(
    styles.toggleSwitcher,
    toggleSwitcherGeometryStyle,
    raisedStyle,
    customClassName,
    className,
  )
  const optionStyles = classNames(
    styles.toggleSwitcher__option,
    optionGeometryStyle,
    optionColorStyle,
    uppercaseStyle,
    focusStyle,
    offsetFocusRingStyle,
    customOptionClassName,
  )
  const selectedOptionStyles = classNames(styles["toggleSwitcher__option--selected"], customSelectedOptionClassName)
  const selectedOptionLabelStyles = styles.toggleSwitcher__optionLabel
  const selectedOptionSurfaceStyles = styles.toggleSwitcher__selectedSurface

  const customStyles = Object.assign(
    {
      height,
      width,
      ["--toggle-switcher-selected-color" as string]: color,
    },
    { ...customStyles__props },
    { ...style },
  ) as CSSProperties
  const customOptionStyles = Object.assign(
    {
      fontSize,
      ["--toggle-switcher-option-font-weight" as string]: optionFontWeight,
    },
    { ...customOptionStyles__props },
  ) as CSSProperties
  const customSelectedOptionStyles = Object.assign(
    {
      ["--toggle-switcher-selected-option-font-weight" as string]: selectedOptionFontWeight,
    },
    { ...customSelectedOptionStyles__props },
  ) as CSSProperties

  return {
    toggleSwitcherStyles,
    optionStyles,
    selectedOptionStyles,
    selectedOptionLabelStyles,
    selectedOptionSurfaceStyles,
    customStyles,
    customOptionStyles,
    customSelectedOptionStyles,
  }
}
