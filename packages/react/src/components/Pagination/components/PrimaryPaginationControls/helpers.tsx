import classNames from "classnames"
import { useCallback, useMemo, type CSSProperties, type ReactNode } from "react"

import { ROUND, ROUNDED, type TCornerGeometry } from "../../../../tokens/geometry"
import type { TThemingOrderCode } from "../../../../tokens/theme-order"
import type { TAvailableColorModes, TButtonProps } from "../../../Button/helpers"
import type { TClickPopoverProps } from "../../../ClickPopover/helpers"
import {
  DEFAULT_PAGINATION_LABELS,
  type TInternalPaginationItem,
  type TPaginationPrimaryControlsLabels,
} from "../../helpers"

import {
  PaginationDefaultChevronLeftIcon,
  PaginationDefaultChevronRightIcon,
  PaginationDefaultDoubleChevronLeftIcon,
  PaginationDefaultDoubleChevronRightIcon,
  PaginationDefaultOverflowIcon,
} from "./DefaultPaginationIcons"
import styles from "./PrimaryPaginationControlsStyles.module.css"

const { paginationItemsList: paginationItemsListClassName } = styles

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

type TCalibratedPrimaryPaginationControlsComponent = {
  buildButtonProps: (args: {
    customClassName?: string
    customStyles?: CSSProperties
    defaultStyles: CSSProperties
  }) => Partial<TButtonProps>
  numberOfPages: number
  resolvedLabels: TPaginationPrimaryControlsLabels
  computedFirstPageButtonIcon: ReactNode
  computedLastPageButtonIcon: ReactNode
  computedNextButtonIcon: ReactNode
  computedPrevButtonIcon: ReactNode
  overflowItemsButtonIcon: ReactNode
  overflowItemsListStyles: string
  visibility: {
    showFirstPageButton: boolean
    showLastPageButton: boolean
    showNextPageButton: boolean
    showPrevPageButton: boolean
  }
}

/**
 * Prepares the visibility, labels, customization props, and presentation resources consumed by the primary controls.
 */
export const useCalibratedComponent = (
  props: TPrimaryPaginationControlsProps,
): TCalibratedPrimaryPaginationControlsComponent => {
  const {
    geometry,
    rtl = false,
    showFirstPageButtonIcon = true,
    showPrevPageButtonIcon = true,
    showNextPageButtonIcon = true,
    showLastPageButtonIcon = true,
    firstPageLabel,
    labels,
    showIncrementButtonsWithOnePage = true,
    prevPageLabel,
    nextPageLabel,
    lastPageLabel,
    currentPage,
    numberOfItems,
    itemsPerPage = 10,
    iconColor,
    incrementAllDownIcon = (
      <PaginationDefaultDoubleChevronLeftIcon data-testid="incr-all-down-icon" color={iconColor} size={10} />
    ),
    incrementDownIcon = <PaginationDefaultChevronLeftIcon data-testid="left-icon" color={iconColor} size={15} />,
    incrementUpIcon = <PaginationDefaultChevronRightIcon data-testid="right-icon" color={iconColor} size={15} />,
    incrementAllUpIcon = (
      <PaginationDefaultDoubleChevronRightIcon data-testid="incr-all-up-icon" color={iconColor} size={10} />
    ),
    overflowItemsButtonIcon = <PaginationDefaultOverflowIcon size={15} />,
    customGeneralButtonProps = {},
    showFirstPageButton: showFirstPageButtonProp = true,
    showPrevPageButton: showPrevPageButtonProp = true,
    showNextPageButton: showNextPageButtonProp = true,
    showLastPageButton: showLastPageButtonProp = true,
    showIncrementButtons = true,
    showFirstPageButtonOnFirstPage = true,
    showPrevPageButtonOnFirstPage = true,
    showNextPageButtonOnLastPage = true,
    showLastPageButtonOnLastPage = true,
  } = props
  const {
    className: customGeneralButtonNativeClassNameProp,
    customClassName: customGeneralButtonClassName,
    customStyles: customGeneralButtonStyles,
    ...restCustomGeneralButtonProps
  } = customGeneralButtonProps
  const customGeneralButtonNativeClassName =
    typeof customGeneralButtonNativeClassNameProp === "string" ? customGeneralButtonNativeClassNameProp : undefined
  const buildButtonProps = useCallback(
    ({
      customClassName,
      customStyles,
      defaultStyles,
    }: {
      customClassName?: string
      customStyles?: CSSProperties
      defaultStyles: CSSProperties
    }) => ({
      ...restCustomGeneralButtonProps,
      customClassName: classNames(customGeneralButtonClassName, customGeneralButtonNativeClassName, customClassName),
      customStyles: {
        ...defaultStyles,
        ...customGeneralButtonStyles,
        ...customStyles,
      },
    }),
    [
      customGeneralButtonClassName,
      customGeneralButtonNativeClassName,
      customGeneralButtonStyles,
      restCustomGeneralButtonProps,
    ],
  )
  const numberOfPages = Math.max(Math.ceil(numberOfItems / itemsPerPage), 1)
  const visibility = useMemo(() => {
    const hideForSinglePage = showIncrementButtonsWithOnePage === false && numberOfPages === 1

    return {
      showFirstPageButton:
        showIncrementButtons &&
        showFirstPageButtonProp &&
        !(showFirstPageButtonOnFirstPage === false && currentPage === 1) &&
        !hideForSinglePage,
      showPrevPageButton:
        showIncrementButtons &&
        showPrevPageButtonProp &&
        !(showPrevPageButtonOnFirstPage === false && currentPage === 1) &&
        !hideForSinglePage,
      showNextPageButton:
        showIncrementButtons &&
        showNextPageButtonProp &&
        !(showNextPageButtonOnLastPage === false && currentPage === numberOfPages) &&
        !hideForSinglePage,
      showLastPageButton:
        showIncrementButtons &&
        showLastPageButtonProp &&
        !(showLastPageButtonOnLastPage === false && currentPage === numberOfPages) &&
        !hideForSinglePage,
    }
  }, [
    currentPage,
    numberOfPages,
    showFirstPageButtonOnFirstPage,
    showFirstPageButtonProp,
    showIncrementButtons,
    showIncrementButtonsWithOnePage,
    showLastPageButtonOnLastPage,
    showLastPageButtonProp,
    showNextPageButtonOnLastPage,
    showNextPageButtonProp,
    showPrevPageButtonOnFirstPage,
    showPrevPageButtonProp,
  ])
  const resolvedLabels = useMemo(
    () => ({
      ...DEFAULT_PAGINATION_LABELS.primaryControls,
      firstPageButton: firstPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.firstPageButton,
      previousPageButton: prevPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.previousPageButton,
      nextPageButton: nextPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.nextPageButton,
      lastPageButton: lastPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.lastPageButton,
      ...labels,
    }),
    [firstPageLabel, labels, lastPageLabel, nextPageLabel, prevPageLabel],
  )
  const resolvedGeometry = geometry ?? ROUNDED
  const overflowItemsListGeometryClassName =
    resolvedGeometry === ROUNDED || resolvedGeometry === ROUND ? styles["paginationItemsList--rounded"] : undefined

  return {
    buildButtonProps,
    numberOfPages,
    resolvedLabels,
    computedFirstPageButtonIcon: showFirstPageButtonIcon
      ? rtl
        ? incrementAllUpIcon
        : incrementAllDownIcon
      : undefined,
    computedLastPageButtonIcon: showLastPageButtonIcon ? (rtl ? incrementAllDownIcon : incrementAllUpIcon) : undefined,
    computedNextButtonIcon: showNextPageButtonIcon ? (rtl ? incrementDownIcon : incrementUpIcon) : undefined,
    computedPrevButtonIcon: showPrevPageButtonIcon ? (rtl ? incrementUpIcon : incrementDownIcon) : undefined,
    overflowItemsButtonIcon,
    overflowItemsListStyles: classNames(paginationItemsListClassName, overflowItemsListGeometryClassName),
    visibility,
  }
}
