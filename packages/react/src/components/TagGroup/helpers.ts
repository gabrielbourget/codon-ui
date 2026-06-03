import classNames from "classnames"
import type { CSSProperties, ReactNode } from "react"
import type { TagGroupProps, TagListProps, TagListRenderProps } from "react-aria-components"

import styles from "./TagGroupStyles.module.css"

type TAvailableSelectionBehaviors = "toggle" | "replace"
type TAvailableSelectionModes = "none" | "single" | "multiple"

export const ORIENTATION__HORIZONTAL = "horizontal"
export const ORIENTATION__VERTICAL = "vertical"
export type TTagGroupOrientations = typeof ORIENTATION__HORIZONTAL | typeof ORIENTATION__VERTICAL

export type TTagGroupProps<T extends object> = Omit<TagGroupProps, "children" | "className" | "style"> &
  Pick<TagListProps<T>, "items" | "children" | "renderEmptyState"> & {
    "data-testid"?: string
    height?: number | string
    width?: number | string
    orientation?: TTagGroupOrientations
    selectionBehavior?: TAvailableSelectionBehaviors
    selectionMode?: TAvailableSelectionModes
    emptyListMessage?: string
    renderEmptyState?: (props: TagListRenderProps) => ReactNode
    className?: string
    style?: CSSProperties
    customClassName?: string
    customStyles?: CSSProperties
    customTagListClassName?: string
    customTagListStyles?: CSSProperties
  }

type TTagGroupCalibration = {
  tagGroupStyles: string
  tagListStyles: string
  customStyles: CSSProperties
  customTagListStyles: CSSProperties
}

export const calibrateComponent = <T extends object>(props: TTagGroupProps<T>): TTagGroupCalibration => {
  const {
    height,
    width,
    orientation = ORIENTATION__HORIZONTAL,
    className,
    style,
    customClassName,
    customTagListClassName,
    customStyles: customStyles__props,
    customTagListStyles: customTagListStyles__props,
  } = props
  const { tagGroup, tagList } = styles

  const orientationStyle =
    orientation === ORIENTATION__HORIZONTAL ? styles["tagList--horizontal"] : styles["tagList--vertical"]

  const tagGroupStyles = classNames(tagGroup, customClassName, className)
  const tagListStyles = classNames(tagList, orientationStyle, customTagListClassName)

  const customStyles = Object.assign({ height, width }, { ...customStyles__props }, { ...style })
  const customTagListStyles = Object.assign({ height, width }, { ...customTagListStyles__props })

  return { tagGroupStyles, tagListStyles, customStyles, customTagListStyles }
}
