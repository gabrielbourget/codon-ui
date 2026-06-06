import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { MenuItemProps, MenuItemRenderProps, MenuProps, PopoverProps, SeparatorProps } from "react-aria-components"

import { ORTHOGONAL, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"

import styles from "./MenuStyles.module.css"

export type TMenuMenuProps = Pick<
  MenuProps<object>,
  "onAction" | "selectionMode" | "selectedKeys" | "onSelectionChange" | "disabledKeys"
> & {
  shouldCloseOnSelect?: boolean
  menuAriaLabel?: string
  customMenuStyles?: CSSProperties
  customMenuClassName?: string
}

type TMenuPopoverProps = Omit<PopoverProps, "children" | "className" | "style">

type TMenuCalibration = {
  popoverStyles: string
  menuListStyles: string
  customStyles: CSSProperties
}

export type TMenuProps = TMenuPopoverProps &
  TMenuMenuProps & {
    "data-testid"?: string
    className?: string
    style?: CSSProperties
    raised?: boolean
    geometry?: Exclude<TCornerGeometry, "round">
    order?: TThemingOrderCode
    color?: string
    width?: number | string
    customStyles?: CSSProperties
    customClassName?: string
  }

const computeMenuColorStyles = (props: TMenuProps) => {
  const { order, color } = props

  let menuColorStyle: string | undefined = undefined

  if (color || !order) return {}

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      menuColorStyle = styles["menu--primary"]
      break
    case THEME_ORDER_CODE__SECONDARY:
      menuColorStyle = styles["menu--secondary"]
      break
    case THEME_ORDER_CODE__TERTIARY:
      menuColorStyle = styles["menu--tertiary"]
      break
    case THEME_ORDER_CODE__QUATERNARY:
      menuColorStyle = styles["menu--quaternary"]
      break
    case THEME_ORDER_CODE__QUINTENARY:
      menuColorStyle = styles["menu--quintenary"]
      break
    default:
      menuColorStyle = styles["menu--primary"]
      break
  }

  return { menuColorStyle }
}

const computeMenuGeometryStyle = (props: TMenuProps) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["menu--rounded"]
    default:
      return undefined
  }
}

export const calibrateComponent = (props: TMenuProps): TMenuCalibration => {
  const {
    raised = true,
    color,
    width,
    className,
    style,
    customStyles: customStyles__props,
    customClassName,
    customMenuClassName,
  } = props

  const geometryStyle = computeMenuGeometryStyle(props)
  const { menuColorStyle } = computeMenuColorStyles(props)
  const raisedStyle = raised ? styles["menu--raised"] : undefined

  const popoverStyles = classNames(styles.menu, geometryStyle, menuColorStyle, raisedStyle, customClassName, className)

  const menuListStyles = classNames(styles.menu__menuList, customMenuClassName)

  const customStyles = Object.assign({ color, width }, { ...customStyles__props }, { ...style })

  return { popoverStyles, menuListStyles, customStyles }
}

export const MENU_ITEM_VARIANT__DEFAULT = "default"
export const MENU_ITEM_VARIANT__DESTRUCTIVE = "destructive"
export const AVAILABLE_MENU_ITEM_VARIANTS = [MENU_ITEM_VARIANT__DEFAULT, MENU_ITEM_VARIANT__DESTRUCTIVE] as const
export type TMenuItemVariant = (typeof AVAILABLE_MENU_ITEM_VARIANTS)[number]

export type TMenuItemProps = Omit<MenuItemProps, "children" | "className" | "style"> & {
  "data-testid"?: string
  className?: MenuItemProps["className"]
  style?: MenuItemProps["style"]
  icon?: ReactNode
  variant?: TMenuItemVariant
  customStyles?: CSSProperties
  customClassName?: string
}

type TMenuItemCalibration = {
  menuItemStyles: MenuItemProps["className"]
  customStyles: MenuItemProps["style"]
}

type TMenuItemClassNameRenderProps = MenuItemRenderProps & {
  defaultClassName: string | undefined
}

type TMenuItemStyleRenderProps = MenuItemRenderProps & {
  defaultStyle: CSSProperties
}

const mergeMenuItemClassNames = (
  computedClassName: string,
  classNameProp: MenuItemProps["className"],
): MenuItemProps["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TMenuItemClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeMenuItemStyles = (computedStyles: CSSProperties, styleProp: CSSProperties | undefined): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeMenuItemStyle = (
  computedStyles: CSSProperties,
  styleProp: MenuItemProps["style"],
): MenuItemProps["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TMenuItemStyleRenderProps) => mergeMenuItemStyles(computedStyles, styleProp(styleProps))
  }

  return mergeMenuItemStyles(computedStyles, styleProp)
}

export const calibrateMenuItem = (props: TMenuItemProps): TMenuItemCalibration => {
  const {
    variant = MENU_ITEM_VARIANT__DEFAULT,
    className,
    style,
    customClassName,
    customStyles: customStyles__props,
  } = props

  const destructiveStyle = variant === MENU_ITEM_VARIANT__DESTRUCTIVE ? styles["menuItem--destructive"] : undefined

  const computedMenuItemStyles = classNames(styles.menuItem, destructiveStyle, customClassName)

  const menuItemStyles = mergeMenuItemClassNames(computedMenuItemStyles, className)
  const customStyles = computeMenuItemStyle({ ...customStyles__props }, style)

  return { menuItemStyles, customStyles }
}

export type TMenuSeparatorProps = Omit<SeparatorProps, "className" | "style"> & {
  "data-testid"?: string
  className?: string
  style?: CSSProperties
  customStyles?: CSSProperties
  customClassName?: string
}

type TMenuSeparatorCalibration = {
  separatorStyles: string
  customStyles: CSSProperties
}

export const calibrateSeparator = (props: TMenuSeparatorProps): TMenuSeparatorCalibration => {
  const { className, style, customClassName, customStyles: customStyles__props } = props

  const separatorStyles = classNames(styles.menuSeparator, customClassName, className)
  const customStyles = { ...customStyles__props, ...style }

  return { separatorStyles, customStyles }
}
