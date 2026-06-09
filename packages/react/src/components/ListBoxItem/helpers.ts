import classNames from "classnames"
import type { CSSProperties } from "react"
import {
  type ListBoxItemProps as AdobeListBoxItemProps,
  type ListBoxItemRenderProps,
  type Key,
} from "react-aria-components"

import textStyles from "../Text/TextStyles.module.css"

import styles from "./ListBoxItemStyles.module.css"

export const LISTBOX_ITEM__SIZE_SM = "small"
export const LISTBOX_ITEM__SIZE_MD = "medium"
export const LISTBOX_ITEM__SIZE_LG = "large"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const AVAILABLE_SELECT_ITEM_SIZES = [LISTBOX_ITEM__SIZE_SM, LISTBOX_ITEM__SIZE_MD, LISTBOX_ITEM__SIZE_LG]
type TAvailableSelectItemSizes = (typeof AVAILABLE_SELECT_ITEM_SIZES)[number]

type RequiresID = { id: Key; textValue?: string }

export type TListBoxItemProps<T extends object> = AdobeListBoxItemProps<T> &
  RequiresID & {
    "data-testid"?: string
    textSize?: TAvailableSelectItemSizes
    customStyles?: CSSProperties
  }

type TListBoxItemClassNameRenderProps = ListBoxItemRenderProps & {
  defaultClassName: string | undefined
}

type TListBoxItemStyleRenderProps = ListBoxItemRenderProps & {
  defaultStyle: CSSProperties
}

type TListBoxItemCalibration = {
  listBoxItemStyles: TListBoxItemProps<object>["className"]
  listBoxItemStyle: TListBoxItemProps<object>["style"]
  customStyles: CSSProperties
}

const mergeListBoxItemClassNames = (
  computedClassName: string,
  classNameProp: AdobeListBoxItemProps<object>["className"],
): AdobeListBoxItemProps<object>["className"] => {
  if (typeof classNameProp === "function") {
    return (classNameProps: TListBoxItemClassNameRenderProps) =>
      classNames(computedClassName, classNameProp(classNameProps))
  }

  return classNames(computedClassName, classNameProp)
}

const mergeListBoxItemStyles = (
  computedStyles: CSSProperties,
  styleProp: CSSProperties | undefined,
): CSSProperties => ({
  ...computedStyles,
  ...styleProp,
})

const computeListBoxItemStyle = (
  computedStyles: CSSProperties,
  styleProp: AdobeListBoxItemProps<object>["style"],
): AdobeListBoxItemProps<object>["style"] => {
  if (typeof styleProp === "function") {
    return (styleProps: TListBoxItemStyleRenderProps) => mergeListBoxItemStyles(computedStyles, styleProp(styleProps))
  }

  return mergeListBoxItemStyles(computedStyles, styleProp)
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

export const calibrateComponent = (props: TListBoxItemProps<object>): TListBoxItemCalibration => {
  const { listBoxItem } = styles
  const { className, customStyles: customStyles__props, style } = props
  const textSizeStyle = computeSelectItemTextSizeStyle(props)
  const computedListBoxItemStyles = classNames(listBoxItem, textSizeStyle, textStyles["fw-regular"])
  const customStyles = { ...customStyles__props }
  const listBoxItemStyles = mergeListBoxItemClassNames(computedListBoxItemStyles, className)
  const listBoxItemStyle = computeListBoxItemStyle(customStyles, style)

  return { listBoxItemStyles, listBoxItemStyle, customStyles }
}
