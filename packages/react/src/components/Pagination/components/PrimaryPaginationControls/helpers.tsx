import type { CSSProperties, ReactNode } from "react"

import type { TCornerGeometry } from "../../../../tokens/geometry"
import type { TThemingOrderCode } from "../../../../tokens/theme-order"
import type { TAvailableColorModes, TButtonProps } from "../../../Button/helpers"
import type { TClickPopoverProps } from "../../../ClickPopover/helpers"
import type { TInternalPaginationItem, TPaginationPrimaryControlsLabels } from "../../helpers"

export type TPrimaryPaginationControlsProps = {
  internalPaginationItems: TInternalPaginationItem[]
  itemsPerPage: number
  numberOfItems: number
  currentPage: number
  color?: string
  order?: TThemingOrderCode
  geometry?: TCornerGeometry
  buttonColorMode?: TAvailableColorModes
  iconColor: string
  computedPageButtonTextColor: string
  rtl?: boolean
  disabled?: boolean
  labels?: TPaginationPrimaryControlsLabels
  firstPageLabel?: string
  incrementAllDownIcon?: ReactNode
  prevPageLabel?: string
  incrementDownIcon?: ReactNode
  nextPageLabel?: string
  incrementUpIcon?: ReactNode
  lastPageLabel?: string
  incrementAllUpIcon?: ReactNode
  overflowItemsButtonIcon?: ReactNode
  onPageNumButtonClick: (pageNum: number) => void
  // ---> Conditional element visibility
  showIncrementButtons?: boolean
  showPrevPageButton?: boolean
  showPrevPageButtonIcon?: boolean
  showPrevPageButtonLabel?: boolean
  showPrevPageButtonOnFirstPage?: boolean
  showNextPageButton?: boolean
  showNextPageButtonOnLastPage?: boolean
  showNextPageButtonIcon?: boolean
  showNextPageButtonLabel?: boolean
  showFirstPageButton?: boolean
  showFirstPageButtonIcon?: boolean
  showFirstPageButtonLabel?: boolean
  showFirstPageButtonOnFirstPage?: boolean
  showLastPageButton?: boolean
  showLastPageButtonIcon?: boolean
  showLastPageButtonLabel?: boolean
  showLastPageButtonOnLastPage?: boolean
  showIncrementButtonsWithOnePage?: boolean
  // -> Custom styles and props
  customGeneralButtonProps?: Partial<TButtonProps>
  customFirstPageButtonClassName?: string
  customFirstPageButtonStyles?: CSSProperties
  customPrevButtonClassName?: string
  customPrevButtonStyles?: CSSProperties
  customNextButtonClassName?: string
  customNextButtonStyles?: CSSProperties
  customLastPageButtonClassName?: string
  customLastPageButtonStyles?: CSSProperties
  customPageNumberButtonClassName?: string
  customPageNumberButtonStyles?: CSSProperties
  customOptionsListClassName?: string
  customOptionsListStyles?: CSSProperties
  customClickPopoverProps?: Partial<TClickPopoverProps>
  customClickPopoverTriggerButtonClassName?: string
  customClickPopoverTriggerButtonStyles?: CSSProperties
}
