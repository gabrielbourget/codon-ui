import classNames from "classnames"
import type { CSSProperties } from "react"
import type { ListBoxItemProps } from "react-aria-components"

import textStyles from "../../../../../Text/TextStyles.module.css"

import styles from "./AnimatedListBoxItemStyles.module.css"

export const LISTBOX_ITEM__SIZE_SM = "small"
export const LISTBOX_ITEM__SIZE_MD = "medium"
export const LISTBOX_ITEM__SIZE_LG = "large"

type TAvailableSelectItemSizes =
  | typeof LISTBOX_ITEM__SIZE_SM
  | typeof LISTBOX_ITEM__SIZE_MD
  | typeof LISTBOX_ITEM__SIZE_LG

export type TListBoxItemProps<T> = ListBoxItemProps<T> & {
  item?: T
  textSize?: TAvailableSelectItemSizes
  customStyles?: CSSProperties
}

const computeSelectItemTextSizeStyle = <T extends object>(props: TListBoxItemProps<T>) => {
  const { textSize } = props
  const { b9, b10, b11 } = textStyles
  let textSizeStyle: string | undefined = undefined

  switch (textSize) {
    case LISTBOX_ITEM__SIZE_SM:
      textSizeStyle = b11
      break
    case LISTBOX_ITEM__SIZE_MD:
      textSizeStyle = b10
      break
    case LISTBOX_ITEM__SIZE_LG:
      textSizeStyle = b9
      break
    default:
      textSizeStyle = b10
      break
  }

  return textSizeStyle
}

export const calibrateComponent = (props: TListBoxItemProps<object>) => {
  const { listBoxItem } = styles
  const textSizeStyle = computeSelectItemTextSizeStyle(props)
  const listBoxItemStyles = classNames(listBoxItem, textSizeStyle, textStyles["fw-regular"])

  return listBoxItemStyles
}
