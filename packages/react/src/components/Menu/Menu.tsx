"use client"

import {
  forwardRef,
  type ForwardRefExoticComponent,
  type PropsWithChildren,
  type PropsWithoutRef,
  type RefAttributes,
} from "react"
import { Menu as AdobeMenu, Popover } from "react-aria-components"

import { calibrateComponent, type TMenuProps } from "./helpers"

type TMenuComponent = ForwardRefExoticComponent<
  PropsWithoutRef<PropsWithChildren<TMenuProps>> & RefAttributes<HTMLDivElement>
>

const Menu: TMenuComponent = forwardRef<HTMLDivElement, PropsWithChildren<TMenuProps>>((props, forwardedRef) => {
  const {
    "data-testid": dataTestID,
    children,
    className,
    color,
    customClassName,
    customMenuClassName: _customMenuClassName,
    customMenuStyles,
    customStyles: customStyles__props,
    disabledKeys,
    geometry,
    menuAriaLabel,
    onAction,
    onSelectionChange,
    order,
    raised,
    selectedKeys,
    selectionMode,
    shouldCloseOnSelect = true,
    style,
    width,
    ...popoverProps
  } = props

  const { popoverStyles, menuListStyles, customStyles } = calibrateComponent(props)

  return (
    <Popover
      {...popoverProps}
      className={popoverStyles}
      style={customStyles}
      ref={forwardedRef}
      data-testid={dataTestID ?? "menu"}
    >
      <AdobeMenu
        onAction={onAction}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        disabledKeys={disabledKeys}
        shouldCloseOnSelect={shouldCloseOnSelect}
        aria-label={menuAriaLabel}
        className={menuListStyles}
        style={customMenuStyles}
        data-testid="menu-list"
      >
        {children}
      </AdobeMenu>
    </Popover>
  )
})

Menu.displayName = "Menu"

export default Menu
