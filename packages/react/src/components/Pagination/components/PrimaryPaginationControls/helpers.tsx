import classNames from "classnames"
import { useMemo, type CSSProperties, type ReactNode } from "react"

import { ROUND, ROUNDED, type TCornerGeometry } from "../../../../tokens/geometry"
import type { TThemingOrderCode } from "../../../../tokens/theme-order"
import type { TAvailableColorModes, TButtonProps } from "../../../Button/helpers"
import type { TClickPopoverProps } from "../../../ClickPopover/helpers"
import type { TInternalPaginationItem, TPaginationPrimaryControlsLabels } from "../../helpers"

import {
  PaginationDefaultChevronLeftIcon,
  PaginationDefaultChevronRightIcon,
  PaginationDefaultDoubleChevronLeftIcon,
  PaginationDefaultDoubleChevronRightIcon,
  PaginationDefaultOverflowIcon,
} from "./DefaultPaginationIcons"
import styles from "./PrimaryPaginationControlsStyles.module.css"

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

export type TExtraCalibrationInfo = {
  iconColor: string
  computedPageButtonTextColor: string
}

export const useMemoizedProperties = (props: TPrimaryPaginationControlsProps) => {
  const {
    showFirstPageButton: showFirstPageButton__props = true,
    showPrevPageButton: showPrevPageButton__props = true,
    showNextPageButton: showNextPageButton__props = true,
    showLastPageButton: showLastPageButton__props = true,
    showIncrementButtons = true,
    itemsPerPage: itemsPerPage__props = 10,
    numberOfItems,
    currentPage,
    showIncrementButtonsWithOnePage = true,
    showFirstPageButtonOnFirstPage = true,
    showPrevPageButtonOnFirstPage = true,
    showNextPageButtonOnLastPage = true,
    showLastPageButtonOnLastPage = true,
  } = props

  const { showFirstPageButton, showPrevPageButton, showNextPageButton, showLastPageButton } = useMemo(() => {
    const numberOfPages = Math.max(Math.ceil(numberOfItems / itemsPerPage__props), 1)
    const pageNumbers: number[] = []
    for (let i = 1; i <= numberOfPages; i++) pageNumbers.push(i)

    const showFirstPageButton =
      showIncrementButtons &&
      showFirstPageButton__props &&
      (showFirstPageButtonOnFirstPage === false && currentPage === 1) === false &&
      (showIncrementButtonsWithOnePage === false && numberOfPages === 1) === false

    const showPrevPageButton =
      showIncrementButtons &&
      showPrevPageButton__props &&
      (showPrevPageButtonOnFirstPage === false && currentPage === 1) === false &&
      (showIncrementButtonsWithOnePage === false && numberOfPages === 1) === false

    const showNextPageButton =
      showIncrementButtons &&
      showNextPageButton__props &&
      (showNextPageButtonOnLastPage === false && currentPage === pageNumbers.length) === false &&
      (showIncrementButtonsWithOnePage === false && numberOfPages === 1) === false

    const showLastPageButton =
      showIncrementButtons &&
      showLastPageButton__props &&
      (showLastPageButtonOnLastPage === false && currentPage === pageNumbers.length) === false &&
      (showIncrementButtonsWithOnePage === false && numberOfPages === 1) === false

    return {
      numberOfPages,
      showFirstPageButton,
      showPrevPageButton,
      showNextPageButton,
      showLastPageButton,
    }
  }, [
    numberOfItems,
    itemsPerPage__props,
    showIncrementButtons,
    showFirstPageButton__props,
    showFirstPageButtonOnFirstPage,
    currentPage,
    showIncrementButtonsWithOnePage,
    showPrevPageButton__props,
    showPrevPageButtonOnFirstPage,
    showNextPageButton__props,
    showNextPageButtonOnLastPage,
    showLastPageButton__props,
    showLastPageButtonOnLastPage,
  ])

  return { showFirstPageButton, showPrevPageButton, showNextPageButton, showLastPageButton }
}

export const calibrateComponent = (props: TPrimaryPaginationControlsProps, extraInfo: TExtraCalibrationInfo) => {
  const { iconColor } = extraInfo
  const { buttonRow, pageNumberButtonRow, popover, paginationItemsList } = styles
  const {
    showPrevPageButtonIcon = true,
    showNextPageButtonIcon = true,
    rtl = false,
    geometry = ROUNDED,
    showFirstPageButtonIcon = true,
    showLastPageButtonIcon = true,
    incrementAllDownIcon = (
      <PaginationDefaultDoubleChevronLeftIcon data-testid="incr-all-down-icon" color={iconColor} size={10} />
    ),
    incrementDownIcon = <PaginationDefaultChevronLeftIcon data-testid="left-icon" color={iconColor} size={15} />,
    incrementUpIcon = <PaginationDefaultChevronRightIcon data-testid="right-icon" color={iconColor} size={15} />,
    incrementAllUpIcon = (
      <PaginationDefaultDoubleChevronRightIcon data-testid="incr-all-up-icon" color={iconColor} size={10} />
    ),
    overflowItemsButtonIcon = <PaginationDefaultOverflowIcon size={15} />,
  } = props

  const overflowITemsListGeometryStyle =
    geometry === ROUNDED || geometry === ROUND ? styles["paginationItemsList--rounded"] : undefined

  const buttonRowStyles = classNames(buttonRow)
  const pageNumberButtonRowStyles = classNames(pageNumberButtonRow)
  const popoverStyles = classNames(popover)
  const overflowItemsListStyles = classNames(paginationItemsList, overflowITemsListGeometryStyle)

  const computedFirstPageButtonIcon = showFirstPageButtonIcon
    ? rtl
      ? incrementAllUpIcon
      : incrementAllDownIcon
    : undefined
  const computedPrevButtonIcon = showPrevPageButtonIcon ? (rtl ? incrementUpIcon : incrementDownIcon) : undefined
  const computedNextButtonIcon = showNextPageButtonIcon ? (rtl ? incrementDownIcon : incrementUpIcon) : undefined
  const computedLastPageButtonIcon = showLastPageButtonIcon
    ? rtl
      ? incrementAllDownIcon
      : incrementAllUpIcon
    : undefined

  return {
    computedFirstPageButtonIcon,
    computedPrevButtonIcon,
    computedNextButtonIcon,
    computedLastPageButtonIcon,
    overflowItemsButtonIcon,
    popoverStyles,
    overflowItemsListStyles,
    buttonRowStyles,
    pageNumberButtonRowStyles,
  }
}
