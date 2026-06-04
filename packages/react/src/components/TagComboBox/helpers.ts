import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { Key } from "react-aria-components"

import { ORTHOGONAL, ROUND, ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import type { TAvailablePopoverPlacementPositions } from "../../tokens/placement"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TComboBoxProps } from "../ComboBox/helpers"
import type { TTagProps } from "../TagGroup/AdobeTag/helpers"
import type { TTagGroupProps } from "../TagGroup/helpers"
import { FONT_VARIANT__BODY_9, FONT_VARIANT__BODY_10, FONT_VARIANT__BODY_11 } from "../Text/constants"
import type { TAvailableFontVariants } from "../Text/types"

import type { TPartialTagComboBoxLabels } from "./labels"
import styles from "./TagComboBoxStyles.module.css"

export const TAGCOMBOBOX_SIZE__SM = "small"
export const TAGCOMBOBOX_SIZE__MD = "medium"
export const TAGCOMBOBOX_SIZE__LG = "large"

export const SELECTION_MODE__NONE = "none"
export const SELECTION_MODE__SINGLE = "single"
export const SELECTION_MODE__MULTIPLE = "multiple"
export const AVAILABLE_SELECTION_MODES = [
  SELECTION_MODE__NONE,
  SELECTION_MODE__SINGLE,
  SELECTION_MODE__MULTIPLE,
] as const
export type TSelectionMode = (typeof AVAILABLE_SELECTION_MODES)[number]

export const AVAILABLE_TAGCOMBOBOX_SIZES = [TAGCOMBOBOX_SIZE__SM, TAGCOMBOBOX_SIZE__MD, TAGCOMBOBOX_SIZE__LG] as const
export type TTagComboBoxSize = (typeof AVAILABLE_TAGCOMBOBOX_SIZES)[number]

export const TAG_COMBOBOX_CHANGE_ACTION__ADD = "add"
export const TAG_COMBOBOX_CHANGE_ACTION__REMOVE = "remove"
export const AVAILABLE_TAG_COMBOBOX_CHANGE_ACTIONS = [
  TAG_COMBOBOX_CHANGE_ACTION__ADD,
  TAG_COMBOBOX_CHANGE_ACTION__REMOVE,
] as const
export type TTagComboBoxChangeAction = (typeof AVAILABLE_TAG_COMBOBOX_CHANGE_ACTIONS)[number]

export type TTagComboBoxChangeDetails<T extends object> = {
  action: TTagComboBoxChangeAction
  changedItems: T[]
  changedKeys: Key[]
}

export type TTagComboBoxProps<T extends object = object> = Omit<
  TComboBoxProps<T>,
  | "children"
  | "className"
  | "customStyles"
  | "defaultInputValue"
  | "defaultValue"
  | "inputValue"
  | "items"
  | "onChange"
  | "onInputChange"
  | "style"
  | "value"
> & {
  "data-testid"?: string
  items?: Iterable<T>
  selectedItems: T[]
  onSelectedItemsChange: (nextSelectedItems: T[], details: TTagComboBoxChangeDetails<T>) => void
  getItemKey: (item: T) => Key
  getItemTextValue: (item: T) => string
  children: ReactNode | ((item: T) => ReactNode)
  renderTagContent?: (item: T) => ReactNode
  inputValue?: string
  defaultInputValue?: string
  onInputChange?: (value: string) => void
  height?: string | number
  width?: string | number
  minWidth?: string | number
  maxWidth?: string | number
  color?: string
  order?: TThemingOrderCode
  geometry?: TCornerGeometry
  textSize?: TTagComboBoxSize
  className?: string
  style?: CSSProperties
  placement?: TAvailablePopoverPlacementPositions
  enableFocusStyle?: boolean
  offsetFocusRing?: boolean
  isDisabled?: boolean
  isOpen?: boolean
  labels?: TPartialTagComboBoxLabels
  shouldFocusWrap?: boolean
  errorState?: boolean
  warningState?: boolean
  successState?: boolean
  customStyles?: CSSProperties
  customTagGroupStyles?: CSSProperties
  customTagGroupProps?: Partial<Omit<TTagGroupProps<T>, "children" | "items" | "onRemove" | "selectionMode">>
  customTagStyles?: CSSProperties
  customTagProps?: Partial<Omit<TTagProps, "children" | "id" | "textValue">>
  customComboBoxStyles?: CSSProperties
  customComboBoxProps?: Partial<Omit<TComboBoxProps<T>, "children" | "defaultValue" | "items" | "onChange" | "value">>
}

const normalizeDimensionValue = (value?: string | number) => {
  if (value === undefined) return undefined
  if (typeof value === "number") return `${value}px`
  if (/^\d+(\.\d+)?$/.test(value)) return `${value}px`
  return value
}

const computeGeometryStyle = <T extends object>(props: TTagComboBoxProps<T>) => {
  const { geometry = ROUNDED } = props

  switch (geometry) {
    case ORTHOGONAL:
      return undefined
    case ROUNDED:
      return styles["tagComboBox--rounded"]
    case ROUND:
      return styles["tagComboBox--round"]
    default:
      return undefined
  }
}

const computeTagComboBoxBorderStyle = <T extends object>(props: TTagComboBoxProps<T>) => {
  const { errorState, warningState, successState } = props
  let borderStyle: string | undefined = undefined

  if (errorState) {
    borderStyle = styles["tagComboBox--errorState"]
    return borderStyle
  }

  if (warningState) {
    borderStyle = styles["tagComboBox--warningState"]
    return borderStyle
  }

  if (successState) {
    borderStyle = styles["tagComboBox--successState"]
    return borderStyle
  }

  return borderStyle
}

const computeTagTextSize = <T extends object>(props: TTagComboBoxProps<T>): TAvailableFontVariants => {
  const { textSize } = props

  switch (textSize) {
    case TAGCOMBOBOX_SIZE__SM:
      return FONT_VARIANT__BODY_11
    case TAGCOMBOBOX_SIZE__MD:
      return FONT_VARIANT__BODY_10
    case TAGCOMBOBOX_SIZE__LG:
      return FONT_VARIANT__BODY_9
    default:
      return FONT_VARIANT__BODY_10
  }
}

export const calibrateComponent = <T extends object>(props: TTagComboBoxProps<T>) => {
  const { tagComboBox } = styles
  const {
    enableFocusStyle,
    offsetFocusRing: offsetFocusRing__props = true,
    height,
    width,
    className,
    customStyles: customStyles__props,
    style,
  } = props

  const geometryStyle = computeGeometryStyle(props)

  const tagComboBoxBorderStyle = computeTagComboBoxBorderStyle(props)
  const focusStyle =
    enableFocusStyle !== undefined && enableFocusStyle === false
      ? styles["tagComboBox--noFocusStyle"]
      : styles["tagComboBox--applyFocusStyle"]
  const offsetFocusRingStyle = offsetFocusRing__props === true ? styles["tagComboBox--offsetFocusRing"] : undefined
  const computedTextSizeVariant = computeTagTextSize(props)

  const tagComboBoxStyles = classNames(
    tagComboBox,
    geometryStyle,
    tagComboBoxBorderStyle,
    focusStyle,
    offsetFocusRingStyle,
    className,
  )

  const customStyles = Object.assign({ height, width }, { ...customStyles__props })

  const computedMinWidth = normalizeDimensionValue(props.minWidth)
  const computedMaxWidth = normalizeDimensionValue(props.maxWidth)
  const tagComboBoxStyle = {
    "--min-width": computedMinWidth,
    "--max-width": computedMaxWidth,
    ...customStyles,
    ...style,
  } as CSSProperties

  return { tagComboBoxStyles, computedTextSizeVariant, tagComboBoxStyle }
}
