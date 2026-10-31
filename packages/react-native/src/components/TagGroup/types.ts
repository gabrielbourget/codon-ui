import type { ReactElement, ReactNode, RefAttributes } from "react"
import type { View, StyleProp, TextStyle } from "react-native"

import type { TNativeSlotProps } from "../../collection/context"
import type { TNativeListState as ListState } from "../../collection/state"
import type { TNativeFocusViewProps } from "../../input/types"
import type { TNativeButtonProps } from "../Button/types"

import type { TNativeTagGroupKey, TNativeTagGroupSelectionBehavior, TNativeTagGroupSelectionMode } from "./model"
import type { TNativeGroupedTagState, TNativeGroupedTagVisualProps, TNativeTagGroupVisualProps } from "./visualTypes"

export type TNativeTagGroupSnapshot = ListState<object>
export type TNativeTagGroupEmptyState = Readonly<{
  isEmpty: boolean
  isFocused: boolean
  isFocusVisible: boolean
  state: TNativeTagGroupSnapshot
}>
type TNativeTagListItemRenderer<T> = { render(item: T): ReactNode }["render"]
export type TNativeTagListProps<T extends object = object> = Omit<TNativeFocusViewProps, "children" | "style"> &
  TNativeSlotProps & {
    items?: Iterable<T>
    children?: ReactNode | TNativeTagListItemRenderer<T>
    dependencies?: readonly unknown[]
    idScope?: TNativeTagGroupKey
    renderEmptyState?: (state: TNativeTagGroupEmptyState) => ReactNode
    style?:
      | StyleProp<TextStyle>
      | ((state: TNativeTagGroupEmptyState & { defaultStyle: TextStyle }) => StyleProp<TextStyle>)
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: TNativeTagGroupEmptyState) => ReactElement
  }
export type TNativeTagGroupLabels = Readonly<{
  removeButtonAriaLabel?: string | ((textValue: string, key: TNativeTagGroupKey) => string)
  removeDescription?: string
  descriptionLabel?: string
  detailsLabel?: string
  selectedItem?: (textValue: string) => string
  deselectedItem?: (textValue: string) => string
  selectedCount?: (count: number) => string
  selectedAll?: string
}>
export type TNativeTagGroupProps<T extends object = object> = Omit<
  TNativeFocusViewProps,
  "children" | "style" | "role" | "accessibilityRole" | "accessible"
> &
  TNativeTagGroupVisualProps & {
    slot?: TNativeSlotProps["slot"]
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: undefined) => ReactElement
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
    ariaDescribedBy?: string | readonly string[]
    ariaDetails?: string | readonly string[]
    "aria-describedby"?: string
    "aria-details"?: string
    "data-testid"?: string
  }
export type TNativeGroupedTagProps = Omit<
  TNativeButtonProps,
  | "render"
  | "children"
  | "slot"
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
    autoFocus?: boolean
    render?: (props: TNativeFocusViewProps & RefAttributes<View>, state: TNativeGroupedTagState) => ReactElement
    onAction?: () => void
    href?: string
    onNavigate?: (href: string) => void
    onNavigationError?: (error: unknown, href: string) => void
    // Explicit never prevents JSX from accepting omitted hyphenated aliases.
    "aria-selected"?: never
    "aria-checked"?: never
    "aria-expanded"?: never
    "aria-disabled"?: never
    "aria-busy"?: never
    accessibilityState?: Omit<
      NonNullable<TNativeButtonProps["accessibilityState"]>,
      "selected" | "checked" | "expanded"
    > & { selected?: never; checked?: never; expanded?: never }
  }
export type TNativeTagGroupRef = View
export type TNativeGroupedTagRef = View
