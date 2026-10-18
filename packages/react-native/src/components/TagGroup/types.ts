import type { ReactNode } from "react"
import type { View } from "react-native"

import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeButtonProps } from "../Button/types"

import type {
  TNativeTagGroupKey,
  TNativeTagGroupSelection,
  TNativeTagGroupSelectionBehavior,
  TNativeTagGroupSelectionMode,
} from "./model"
import type { TNativeGroupedTagState, TNativeGroupedTagVisualProps, TNativeTagGroupVisualProps } from "./visualTypes"

export type TNativeTagGroupSnapshot = Readonly<{
  keys: readonly TNativeTagGroupKey[]
  selectedKeys: TNativeTagGroupSelection
  focusedKey: TNativeTagGroupKey | null
  selectionMode: TNativeTagGroupSelectionMode
  selectionBehavior: TNativeTagGroupSelectionBehavior
}>
export type TNativeTagGroupEmptyState = Readonly<{
  isEmpty: boolean
  isFocused: boolean
  isFocusVisible: boolean
  state: TNativeTagGroupSnapshot
}>
export type TNativeTagGroupLabels = Readonly<{
  removeButtonAriaLabel?: string | ((textValue: string, key: TNativeTagGroupKey) => string)
  removeDescription?: string
}>
export type TNativeTagGroupProps<T extends object = object> = Omit<
  TNativeFocusViewProps,
  "children" | "style" | "role" | "accessibilityRole" | "accessible"
> &
  TNativeTagGroupVisualProps & {
    children?: ReactNode | ((item: T) => ReactNode)
    items?: Iterable<T>
    getKey?: (item: T) => TNativeTagGroupKey
    selectionMode?: TNativeTagGroupSelectionMode
    selectionBehavior?: TNativeTagGroupSelectionBehavior
    selectedKeys?: "all" | Iterable<TNativeTagGroupKey>
    defaultSelectedKeys?: "all" | Iterable<TNativeTagGroupKey>
    disabledKeys?: Iterable<TNativeTagGroupKey>
    onSelectionChange?: (keys: "all" | Set<TNativeTagGroupKey>) => void
    onRemove?: (keys: Set<TNativeTagGroupKey>) => void
    onAction?: (key: TNativeTagGroupKey) => void
    disallowEmptySelection?: boolean
    shouldSelectOnPressUp?: boolean
    escapeKeyBehavior?: "clearSelection" | "none"
    emptyListMessage?: string
    renderEmptyState?: (state: TNativeTagGroupEmptyState) => ReactNode
    labels?: TNativeTagGroupLabels
    "data-testid"?: string
  }
export type TNativeGroupedTagProps = Omit<
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
  | "accessibilityState"
  | "aria-selected"
  | "aria-checked"
  | "aria-expanded"
> &
  TNativeGroupedTagVisualProps & {
    id?: TNativeTagGroupKey
    textValue?: string
    children?: ReactNode | ((state: TNativeGroupedTagState) => ReactNode)
    closeIcon?: ReactNode
    onAction?: () => void
    href?: string
    onNavigate?: (href: string) => void
    onNavigationError?: (error: unknown, href: string) => void
    accessibilityState?: Omit<
      NonNullable<TNativeButtonProps["accessibilityState"]>,
      "selected" | "checked" | "expanded"
    > & { selected?: never; checked?: never; expanded?: never }
  }
export type TNativeTagGroupRef = View
export type TNativeGroupedTagRef = View
