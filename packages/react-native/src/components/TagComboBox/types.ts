import type { ReactNode } from "react"
import type { StyleProp, TextStyle, View } from "react-native"

import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeCollectionComboBoxProps } from "../ComboBox/CollectionComboBox"
import type { TNativeComboBoxProps } from "../ComboBox/types"
import type { TNativeDisplayDimension } from "../displayDimensions"
import type { TNativeGroupedTagProps, TNativeTagGroupProps } from "../TagGroup/types"

export const NATIVE_TAG_COMBOBOX_CHANGE_ACTIONS = ["add", "remove"] as const
export type TNativeTagComboBoxChangeDetails<T> = Readonly<{
  action: (typeof NATIVE_TAG_COMBOBOX_CHANGE_ACTIONS)[number]
  changedItems: T[]
  changedKeys: (string | number)[]
}>
export type TNativeTagComboBoxLabels = {
  groupAriaLabel: string
  tagGroupAriaLabel: string
  comboBox: {
    inputButtonGroupAriaLabel: string
    triggerButtonAriaLabel: string
    emptyListMessage: string
    inputLabel: string
    closeLabel: string
  }
}
export type TNativeTagComboBoxPartialLabels = Partial<Omit<TNativeTagComboBoxLabels, "comboBox">> & {
  comboBox?: Partial<TNativeTagComboBoxLabels["comboBox"]>
}
type TInnerComboProps<T extends object> = Partial<
  Omit<
    TNativeCollectionComboBoxProps<T>,
    | "items"
    | "getKey"
    | "getTextValue"
    | "value"
    | "defaultValue"
    | "onChange"
    | "renderItem"
    | "controlledItems"
    | "renderContent"
    | "popoverIsOpen"
  >
> & {
  labels?: Partial<TNativeTagComboBoxLabels["comboBox"]>
}
export type TNativeTagComboBoxProps<T extends object> = Omit<
  TNativeCollectionComboBoxProps<T>,
  | "items"
  | "controlledItems"
  | "renderContent"
  | "popoverIsOpen"
  | "getKey"
  | "getTextValue"
  | "value"
  | "defaultValue"
  | "onChange"
  | "renderItem"
  | "style"
  | "customStyles"
  | "inputLabel"
  | "closeLabel"
  | "accessibilityLabel"
  | "aria-label"
  | "width"
  | "height"
> & {
  items?: Iterable<T>
  selectedItems: readonly T[]
  onSelectedItemsChange: (items: T[], details: TNativeTagComboBoxChangeDetails<T>) => void
  getItemKey: (item: T) => string | number
  getItemTextValue: (item: T) => string
  children?: ReactNode | ((item: T) => ReactNode)
  renderTagContent?: (item: T) => ReactNode
  accessibilityLabel?: string
  "aria-label"?: string
  inputLabel?: string
  closeLabel?: string
  width?: TNativeDisplayDimension
  height?: TNativeDisplayDimension
  minWidth?: TNativeDisplayDimension
  maxWidth?: TNativeDisplayDimension
  order?: TThemingOrderCode
  labels?: TNativeTagComboBoxPartialLabels
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customTagGroupStyles?: TNativeTagGroupProps<T>["customStyles"]
  customTagGroupProps?: Partial<
    Omit<TNativeTagGroupProps<T>, "children" | "items" | "getKey" | "onRemove" | "selectionMode">
  >
  customTagStyles?: TNativeGroupedTagProps["customStyles"]
  customTagProps?: Partial<Omit<TNativeGroupedTagProps, "children" | "id" | "textValue">>
  customComboBoxStyles?: TNativeComboBoxProps<T>["customStyles"]
  customComboBoxProps?: TInnerComboProps<T>
}
export type TNativeTagComboBoxRef = View
