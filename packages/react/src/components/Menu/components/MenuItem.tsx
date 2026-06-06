"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { MenuItem as AdobeMenuItem } from "react-aria-components"

import { calibrateMenuItem, type TMenuItemProps } from "../helpers"
import styles from "../MenuStyles.module.css"

type TMenuItemComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<TMenuItemProps>> & RefAttributes<HTMLDivElement>
>

const MenuItem: TMenuItemComponent = forwardRef<HTMLDivElement, PropsWithChildren<TMenuItemProps>>(
  (props, forwardedRef) => {
    const {
      "data-testid": dataTestID,
      children,
      className,
      customClassName: _customClassName,
      customStyles: _customStyles,
      icon,
      style,
      variant,
      ...rest
    } = props

    const { menuItemStyles, customStyles } = calibrateMenuItem(props)

    return (
      <AdobeMenuItem
        {...rest}
        className={menuItemStyles}
        style={customStyles}
        ref={forwardedRef}
        data-testid={dataTestID ?? "menu-item"}
      >
        {icon !== undefined && (
          <span className={styles.menuItem__icon} data-testid="menu-item-icon">
            {icon}
          </span>
        )}
        {children}
      </AdobeMenuItem>
    )
  },
)

MenuItem.displayName = "MenuItem"

export default MenuItem
