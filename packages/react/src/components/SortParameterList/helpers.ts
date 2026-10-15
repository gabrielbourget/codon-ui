import type { CSSProperties, HTMLAttributes } from "react"

import type { TAriaLabelingProps } from "../../tokens/a11y"

import type { TSortParameter } from "./SortParameterListItem/helpers"

type TSortParameterListNativeProps = Omit<HTMLAttributes<HTMLDivElement>, "children">

export type TSortParameterListProps = TSortParameterListNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    sortParameterList: TSortParameter[]
    onSortParameterListChange?: (sortParameterList: TSortParameter[]) => void
    customClassName?: string
    customStyles?: CSSProperties
    customItemClassName?: string
    customItemStyles?: CSSProperties
    customItemIconClassName?: string
    customItemIconStyles?: CSSProperties
    customItemTextClassName?: string
    customItemTextStyles?: CSSProperties
  }

export type TSortParameterListState = {
  draggedID: string | null
  sortParameterList: TSortParameter[]
}

export const initState: TSortParameterListState = {
  draggedID: null,
  sortParameterList: [],
}

export const reorderSortParameterList = (
  sortParameterList: TSortParameter[],
  draggedID: string | null,
  targetID: string,
) => {
  if (!draggedID || draggedID === targetID) return sortParameterList

  const draggedIndex = sortParameterList.findIndex((item) => item.ID === draggedID)
  const targetIndex = sortParameterList.findIndex((item) => item.ID === targetID)

  if (draggedIndex < 0 || targetIndex < 0) return sortParameterList

  const updatedSortItems = [...sortParameterList]
  const [movedItem] = updatedSortItems.splice(draggedIndex, 1)
  updatedSortItems.splice(targetIndex, 0, movedItem)

  return updatedSortItems
}
