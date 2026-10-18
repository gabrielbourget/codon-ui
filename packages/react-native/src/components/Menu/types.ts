import type { ReactNode } from "react"
import type { StyleProp, TextStyle, View, ViewProps, ViewStyle } from "react-native"

import type { TNativeButtonProps } from "../Button/types"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"

import type { TNativeMenuKey, TNativeMenuSelectionMode } from "./model"

export const NATIVE_MENU_ITEM_VARIANTS = ["default", "destructive"] as const
export type TNativeMenuItemVariant = (typeof NATIVE_MENU_ITEM_VARIANTS)[number]
export type TNativeMenuProps = Omit<
  TNativeClickPopoverProps,
  "children" | "childIsDialog" | "showOverlayArrow" | "customDialogStyles"
> & {
  children?: ReactNode
  menuAriaLabel?: string
  selectionMode?: TNativeMenuSelectionMode
  selectedKeys?: "all" | Iterable<TNativeMenuKey>
  onSelectionChange?: (keys: "all" | Set<TNativeMenuKey>) => void
  disabledKeys?: Iterable<TNativeMenuKey>
  onAction?: (key: TNativeMenuKey) => void
  shouldCloseOnSelect?: boolean
  customMenuStyles?: StyleProp<TextStyle>
}
export type TNativeMenuItemState = Readonly<{
  isSelected: boolean
  isDisabled: boolean
  isHovered: boolean
  isPressed: boolean
  isFocused: boolean
  isFocusVisible: boolean
  selectionMode: TNativeMenuSelectionMode
  selectionBehavior: "toggle"
  hasSubmenu: boolean
  isOpen: boolean
}>
export type TNativeMenuItemProps = Omit<
  TNativeButtonProps,
  | "children"
  | "style"
  | "customStyles"
  | "id"
  | "color"
  | "hoverColor"
  | "colorMode"
  | "geometry"
  | "order"
  | "width"
  | "height"
  | "transparent"
  | "raised"
  | "raisedOnHover"
  | "isPending"
  | "enableFocusStyle"
  | "offsetFocusRing"
> & {
  id?: TNativeMenuKey
  children?: ReactNode
  textValue?: string
  icon?: ReactNode
  variant?: TNativeMenuItemVariant
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle> | ((state: TNativeMenuItemState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
  onAction?: () => void
  shouldCloseOnSelect?: boolean
  href?: string
  onNavigate?: (href: string) => void
  onNavigationError?: (error: unknown, href: string) => void
}
export type TNativeMenuSeparatorProps = Omit<
  ViewProps,
  "children" | "style" | "role" | "accessibilityRole" | "accessible"
> & {
  customStyles?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  "data-testid"?: string
}
export type TNativeMenuRef = View
export type TNativeMenuItemRef = View
