import classNames from "classnames"
import { useCallback, useMemo, type CSSProperties } from "react"

import { ROUND, ROUNDED } from "../../../../tokens/geometry"
import { DEFAULT_PAGINATION_LABELS } from "../../helpers"

import {
  PaginationDefaultChevronLeftIcon,
  PaginationDefaultChevronRightIcon,
  PaginationDefaultDoubleChevronLeftIcon,
  PaginationDefaultDoubleChevronRightIcon,
  PaginationDefaultOverflowIcon,
} from "./DefaultPaginationIcons"
import type { TPrimaryPaginationControlsProps } from "./helpers"
import styles from "./PrimaryPaginationControlsStyles.module.css"

/**
 * Prepares the visibility, labels, customization props, and presentation resources consumed by the primary controls.
 */
export const useCalibratedComponent = (props: TPrimaryPaginationControlsProps) => {
  const {
    color,
    order,
    geometry,
    buttonColorMode,
    disabled,
    rtl = false,
    showFirstPageButtonIcon = true,
    showFirstPageButtonLabel,
    showPrevPageButtonIcon = true,
    showPrevPageButtonLabel,
    showNextPageButtonIcon = true,
    showNextPageButtonLabel,
    showLastPageButtonIcon = true,
    showLastPageButtonLabel,
    firstPageLabel,
    labels,
    showIncrementButtonsWithOnePage = true,
    prevPageLabel,
    nextPageLabel,
    lastPageLabel,
    onPageNumButtonClick,
    currentPage,
    numberOfItems,
    itemsPerPage = 10,
    iconColor,
    internalPaginationItems,
    incrementAllDownIcon = (
      <PaginationDefaultDoubleChevronLeftIcon data-testid="incr-all-down-icon" color={iconColor} size={10} />
    ),
    incrementDownIcon = <PaginationDefaultChevronLeftIcon data-testid="left-icon" color={iconColor} size={15} />,
    incrementUpIcon = <PaginationDefaultChevronRightIcon data-testid="right-icon" color={iconColor} size={15} />,
    incrementAllUpIcon = (
      <PaginationDefaultDoubleChevronRightIcon data-testid="incr-all-up-icon" color={iconColor} size={10} />
    ),
    overflowItemsButtonIcon = <PaginationDefaultOverflowIcon size={15} />,
    customFirstPageButtonClassName,
    customFirstPageButtonStyles,
    customPrevButtonClassName,
    customPrevButtonStyles,
    customNextButtonClassName,
    customNextButtonStyles,
    customLastPageButtonClassName,
    customLastPageButtonStyles,
    customPageNumberButtonClassName,
    customPageNumberButtonStyles,
    customGeneralButtonProps = {},
    customOptionsListClassName,
    customOptionsListStyles,
    customClickPopoverProps = {},
    customClickPopoverTriggerButtonClassName,
    customClickPopoverTriggerButtonStyles,
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
  const {
    className: clickPopoverClassName,
    customClassName: clickPopoverCustomClassName,
    customDialogStyles: clickPopoverDialogStyles,
    customStyles: clickPopoverCustomStyles,
    placement: clickPopoverPlacement = "bottom right",
    raised: clickPopoverRaised = false,
    style: clickPopoverStyle,
    ...restCustomClickPopoverProps
  } = customClickPopoverProps
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
    controls: {
      buildButtonProps,
      buttonColorMode,
      color,
      currentPage,
      customFirstPageButtonClassName,
      customFirstPageButtonStyles,
      customLastPageButtonClassName,
      customLastPageButtonStyles,
      customNextButtonClassName,
      customNextButtonStyles,
      customPrevButtonClassName,
      customPrevButtonStyles,
      disabled,
      geometry,
      numberOfPages,
      onPageNumButtonClick,
      order,
      rtl,
      showFirstPageButtonIcon,
      showFirstPageButtonLabel,
      showIncrementButtonsWithOnePage,
      showLastPageButtonIcon,
      showLastPageButtonLabel,
      showNextPageButtonIcon,
      showNextPageButtonLabel,
      showPrevPageButtonIcon,
      showPrevPageButtonLabel,
    },
    labels: resolvedLabels,
    pages: {
      clickPopoverClassName,
      clickPopoverCustomClassName,
      clickPopoverCustomStyles,
      clickPopoverDialogStyles,
      clickPopoverPlacement,
      clickPopoverRaised,
      clickPopoverStyle,
      customClickPopoverTriggerButtonClassName,
      customClickPopoverTriggerButtonStyles,
      customOptionsListClassName,
      customOptionsListStyles,
      customPageNumberButtonClassName,
      customPageNumberButtonStyles,
      internalPaginationItems,
      restCustomClickPopoverProps,
    },
    presentation: {
      buttonRowStyles: classNames(styles.buttonRow),
      computedFirstPageButtonIcon: showFirstPageButtonIcon
        ? rtl
          ? incrementAllUpIcon
          : incrementAllDownIcon
        : undefined,
      computedLastPageButtonIcon: showLastPageButtonIcon
        ? rtl
          ? incrementAllDownIcon
          : incrementAllUpIcon
        : undefined,
      computedNextButtonIcon: showNextPageButtonIcon ? (rtl ? incrementDownIcon : incrementUpIcon) : undefined,
      computedPrevButtonIcon: showPrevPageButtonIcon ? (rtl ? incrementUpIcon : incrementDownIcon) : undefined,
      overflowItemsButtonIcon,
      overflowItemsListStyles: classNames(styles.paginationItemsList, overflowItemsListGeometryClassName),
      pageNumberButtonRowStyles: classNames(styles.pageNumberButtonRow),
      popoverStyles: classNames(styles.popover),
    },
    visibility,
  }
}
