import classNames from "classnames"
import { useCallback, useMemo, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from "react"

import { ROUNDED } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
} from "../../tokens/theme-order"

import ItemsPerPage from "./components/ItemsPerPage/ItemsPerPage"
import PageCounter from "./components/PageCounter/PageCounter"
import PageInput from "./components/PageInput/PageInput"
import PrimaryPaginationControls from "./components/PrimaryPaginationControls/PrimaryPaginationControls"
import {
  AVAILABLE_ITEMS_PER_PAGE_OPTIONS,
  buildItemsPerPageOptions,
  computeInternalPaginationItems,
  DEFAULT_CHOSEN_PAGINATION_SUBCOMPONENTS,
  initState,
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__PAGE_COUNTER,
  PAGINATION_SUBCOMPONENT__PAGE_INPUT,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
  resolvePaginationLabels,
  type TPaginationProps,
  type TPaginationState,
  type TPaginationSubComponentKeymap,
} from "./helpers"
import styles from "./PaginationStyles.module.css"

type TPaginationNativeProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "color" | "style">

type TCalibratedPaginationComponent = {
  composition: {
    items: {
      key: keyof TPaginationSubComponentKeymap
      node: ReactNode
    }[]
    separator: {
      className: string | undefined
      style: CSSProperties
    }
  }
  root: {
    ariaDescribedBy: string | undefined
    ariaDetails: string | undefined
    ariaLabel: string
    ariaLabelledBy: string | undefined
    className: string
    dataTestID: string
    isDisabled: boolean
    nativeProps: TPaginationNativeProps
    style: CSSProperties
  }
  visibility: {
    isVisible: boolean
  }
}

/**
 * Owns Pagination's internal draft, callbacks, presentation, and subcomponent composition while callers retain the
 * controlled page and page-size state.
 */
export const useCalibratedComponent = (props: TPaginationProps): TCalibratedPaginationComponent => {
  const {
    "aria-describedby": ariaDescribedBy,
    "aria-details": ariaDetails,
    "aria-label": _ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "data-testid": dataTestID,
    ariaDescribedBy: ariaDescribedByAlias,
    ariaDetails: ariaDetailsAlias,
    ariaLabel: _ariaLabelAlias,
    ariaLabelledBy: ariaLabelledByAlias,
    className,
    currentPage,
    setCurrentPage,
    itemsPerPage: itemsPerPageProp,
    itemsPerPageOptions,
    order,
    color,
    numberOfItems,
    isDisabled = false,
    geometry = ROUNDED,
    buttonColorMode = "fill",
    setItemsPerPage,
    rtl = false,
    chosenPaginationSubcomponents: chosenPaginationSubcomponentsProp,
    maxVisiblePages: _maxVisiblePages,
    consolidationPlacement: _consolidationPlacement,
    incrementAllDownIcon,
    incrementDownIcon,
    incrementUpIcon,
    incrementAllUpIcon,
    overflowItemsButtonIcon,
    labels,
    counterText,
    pageInputLabel,
    pageInputSelectionButtonText,
    itemsPerPageLabel,
    itemsPerPageSelectPlaceholder,
    showWithOnePage = false,
    showIncrementButtonsWithOnePage = true,
    showIncrementButtons = true,
    showFirstPageButton = false,
    showFirstPageButtonOnFirstPage = true,
    showFirstPageButtonIcon = true,
    showFirstPageButtonLabel = true,
    showPrevPageButton = true,
    showPrevPageButtonOnFirstPage = true,
    showPrevPageButtonIcon = true,
    showPrevPageButtonLabel = true,
    showNextPageButton = true,
    showNextPageButtonOnLastPage = true,
    showNextPageButtonIcon = true,
    showNextPageButtonLabel = true,
    showLastPageButton = false,
    showLastPageButtonOnLastPage = true,
    showLastPageButtonIcon = true,
    showLastPageButtonLabel = true,
    firstPageLabel,
    prevPageLabel,
    nextPageLabel,
    lastPageLabel,
    customClassName,
    customComponentStyles,
    customSeparatorClassName,
    customSeparatorStyles,
    style,
    customPageNumberInputFormFieldProps = {},
    customPageNumberInputFormFieldClassName,
    customPageNumberInputProps = {},
    customPageNumberInputNavigationButtonClassName,
    customPageNumberInputNavigationButtonStyles,
    customPageCounterClassName,
    customItemsPerPageSelectProps = {},
    customItemsPerPageFormFieldProps = {},
    customItemsPerPageFormFieldClassName,
    customItemsPerPageFormFieldStyles,
    customItemsPerPageSelectClassName,
    customItemsPerPageSelectStyles,
    customPageNumberInputFormFieldStyles,
    customPageNumberInputStyles,
    customPageCounterStyles,
    customPageCounterProps = {},
    customGeneralButtonProps = {},
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
    customOptionsListClassName,
    customOptionsListStyles,
    customClickPopoverProps = {},
    customClickPopoverTriggerButtonClassName,
    customClickPopoverTriggerButtonStyles,
    ...nativeProps
  } = props
  const [state, setState] = useState<TPaginationState>({ ...initState, itemsPerPage: itemsPerPageProp })
  const chosenPaginationSubcomponents =
    chosenPaginationSubcomponentsProp && chosenPaginationSubcomponentsProp.length > 0
      ? chosenPaginationSubcomponentsProp
      : DEFAULT_CHOSEN_PAGINATION_SUBCOMPONENTS
  const processedPaginationSubcomponents = useMemo(
    () => new Set(chosenPaginationSubcomponents),
    [chosenPaginationSubcomponents],
  )
  const itemsPerPageOptionsList = useMemo(
    () =>
      itemsPerPageOptions
        ? buildItemsPerPageOptions(itemsPerPageOptions.map((item) => item.toString()))
        : buildItemsPerPageOptions(AVAILABLE_ITEMS_PER_PAGE_OPTIONS.map((item) => item.toString())),
    [itemsPerPageOptions],
  )
  const resolvedLabels = useMemo(
    () =>
      resolvePaginationLabels({
        labels,
        firstPageLabel,
        prevPageLabel,
        nextPageLabel,
        lastPageLabel,
        counterText,
        pageInputLabel,
        pageInputSelectionButtonText,
        itemsPerPageLabel,
        itemsPerPageSelectPlaceholder,
      }),
    [
      counterText,
      firstPageLabel,
      itemsPerPageLabel,
      itemsPerPageSelectPlaceholder,
      labels,
      lastPageLabel,
      nextPageLabel,
      pageInputLabel,
      pageInputSelectionButtonText,
      prevPageLabel,
    ],
  )
  const numberOfPages = Math.max(Math.ceil(numberOfItems / itemsPerPageProp), 1)
  const internalPaginationItems = computeInternalPaginationItems(props)

  let paginationColor = color && order === undefined ? color : ""
  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      paginationColor = "var(--cui-color-primary-500)"
      break
    case THEME_ORDER_CODE__SECONDARY:
      paginationColor = "var(--cui-color-secondary-500)"
      break
    case THEME_ORDER_CODE__TERTIARY:
      paginationColor = "var(--cui-color-tertiary-500)"
      break
    case THEME_ORDER_CODE__QUATERNARY:
      paginationColor = "var(--cui-color-quaternary-500)"
      break
    case THEME_ORDER_CODE__QUINTENARY:
      paginationColor = "var(--cui-color-quintenary-500)"
      break
    default:
      break
  }

  if (order === undefined) paginationColor = "inherit"

  const iconColor =
    buttonColorMode === "fill"
      ? color || order
        ? "var(--cui-control-selected-foreground)"
        : "currentColor"
      : paginationColor
  const computedPageButtonTextColor = "var(--cui-control-foreground)"
  const onPageNumButtonClick = useCallback(
    (pageNum: number) => {
      if (pageNum !== currentPage) setCurrentPage(pageNum)
    },
    [currentPage, setCurrentPage],
  )
  const onPageNumberInputChange = useCallback(
    (value: number) => setState((previousState) => ({ ...previousState, pageNumInput: value })),
    [],
  )
  const onItemsPerPageSelectionChange = useCallback(
    (ID: string | number) => {
      const value = itemsPerPageOptionsList.find((option) => option.id === ID)?.name
      const previousItemsPerPage = state.itemsPerPage as number
      const previousPageFirstItemIndex = (currentPage - 1) * previousItemsPerPage
      const newItemsPerPage = parseInt(value!, 10)
      const newPageZeroBased = Math.floor(previousPageFirstItemIndex / newItemsPerPage)
      const totalPages = Math.ceil(numberOfItems / newItemsPerPage)
      const newPage = Math.min(newPageZeroBased + 1, totalPages)

      setState((previousState) => ({ ...previousState, itemsPerPage: newItemsPerPage }))
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(newPage)
    },
    [currentPage, itemsPerPageOptionsList, numberOfItems, setCurrentPage, setItemsPerPage, state.itemsPerPage],
  )

  const paginationSubComponentKeymap: TPaginationSubComponentKeymap = {
    [PAGINATION_SUBCOMPONENT__PAGE_COUNTER]: (
      <PageCounter
        currentPage={currentPage}
        numberOfPages={numberOfPages}
        labels={resolvedLabels.pageCounter}
        customPageCounterProps={customPageCounterProps}
        customCounterClassName={customPageCounterClassName}
        customCounterStyles={customPageCounterStyles}
      />
    ),
    [PAGINATION_SUBCOMPONENT__PAGE_INPUT]: (
      <PageInput
        pageNumInput={state.pageNumInput as number}
        numberOfPages={numberOfPages}
        color={color}
        order={order}
        geometry={geometry}
        buttonColorMode={buttonColorMode}
        disabled={isDisabled}
        labels={resolvedLabels.pageInput}
        onPageNumberInputChange={onPageNumberInputChange}
        onPageNumButtonClick={onPageNumButtonClick}
        customGeneralButtonProps={customGeneralButtonProps}
        customPageNumberInputFormFieldProps={customPageNumberInputFormFieldProps}
        customPageNumberInputFormFieldClassName={customPageNumberInputFormFieldClassName}
        customPageNumberInputFormFieldStyles={customPageNumberInputFormFieldStyles}
        customPageNumberInputProps={customPageNumberInputProps}
        customPageNumberInputStyles={customPageNumberInputStyles}
        customPageNumberInputNavigationButtonClassName={customPageNumberInputNavigationButtonClassName}
        customPageNumberInputNavigationButtonStyles={customPageNumberInputNavigationButtonStyles}
      />
    ),
    [PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE]: (
      <ItemsPerPage
        itemsPerPage={state.itemsPerPage}
        itemsPerPageOptionsList={itemsPerPageOptionsList}
        onItemsPerPageSelectionChange={onItemsPerPageSelectionChange}
        geometry={geometry}
        disabled={isDisabled}
        labels={resolvedLabels.itemsPerPage}
        customItemsPerPageFormFieldClassName={customItemsPerPageFormFieldClassName}
        customItemsPerPageFormFieldStyles={customItemsPerPageFormFieldStyles}
        customItemsPerPageFormFieldProps={customItemsPerPageFormFieldProps}
        customItemsPerPageSelectClassName={customItemsPerPageSelectClassName}
        customItemsPerPageSelectStyles={customItemsPerPageSelectStyles}
        customItemsPerPageSelectProps={customItemsPerPageSelectProps}
      />
    ),
    [PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS]: (
      <PrimaryPaginationControls
        internalPaginationItems={internalPaginationItems}
        itemsPerPage={state.itemsPerPage as number}
        numberOfItems={numberOfItems}
        currentPage={currentPage}
        color={color}
        order={order}
        geometry={geometry}
        buttonColorMode={buttonColorMode}
        iconColor={iconColor}
        computedPageButtonTextColor={computedPageButtonTextColor}
        rtl={rtl}
        disabled={isDisabled}
        labels={resolvedLabels.primaryControls}
        incrementAllDownIcon={incrementAllDownIcon}
        incrementDownIcon={incrementDownIcon}
        incrementUpIcon={incrementUpIcon}
        incrementAllUpIcon={incrementAllUpIcon}
        overflowItemsButtonIcon={overflowItemsButtonIcon}
        onPageNumButtonClick={onPageNumButtonClick}
        showIncrementButtons={showIncrementButtons}
        showPrevPageButton={showPrevPageButton}
        showPrevPageButtonIcon={showPrevPageButtonIcon}
        showPrevPageButtonLabel={showPrevPageButtonLabel}
        showPrevPageButtonOnFirstPage={showPrevPageButtonOnFirstPage}
        showNextPageButton={showNextPageButton}
        showNextPageButtonOnLastPage={showNextPageButtonOnLastPage}
        showNextPageButtonIcon={showNextPageButtonIcon}
        showNextPageButtonLabel={showNextPageButtonLabel}
        showFirstPageButton={showFirstPageButton}
        showFirstPageButtonIcon={showFirstPageButtonIcon}
        showFirstPageButtonLabel={showFirstPageButtonLabel}
        showFirstPageButtonOnFirstPage={showFirstPageButtonOnFirstPage}
        showLastPageButton={showLastPageButton}
        showLastPageButtonIcon={showLastPageButtonIcon}
        showLastPageButtonLabel={showLastPageButtonLabel}
        showLastPageButtonOnLastPage={showLastPageButtonOnLastPage}
        showIncrementButtonsWithOnePage={showIncrementButtonsWithOnePage}
        customGeneralButtonProps={customGeneralButtonProps}
        customFirstPageButtonClassName={customFirstPageButtonClassName}
        customFirstPageButtonStyles={customFirstPageButtonStyles}
        customPrevButtonClassName={customPrevButtonClassName}
        customPrevButtonStyles={customPrevButtonStyles}
        customNextButtonClassName={customNextButtonClassName}
        customNextButtonStyles={customNextButtonStyles}
        customLastPageButtonClassName={customLastPageButtonClassName}
        customLastPageButtonStyles={customLastPageButtonStyles}
        customPageNumberButtonClassName={customPageNumberButtonClassName}
        customPageNumberButtonStyles={customPageNumberButtonStyles}
        customOptionsListClassName={customOptionsListClassName}
        customOptionsListStyles={customOptionsListStyles}
        customClickPopoverProps={customClickPopoverProps}
        customClickPopoverTriggerButtonClassName={customClickPopoverTriggerButtonClassName}
        customClickPopoverTriggerButtonStyles={customClickPopoverTriggerButtonStyles}
      />
    ),
  }

  return {
    composition: {
      items: [...processedPaginationSubcomponents].map((key) => ({ key, node: paginationSubComponentKeymap[key] })),
      separator: {
        className: customSeparatorClassName,
        style: { height: "100%", width: 0.75, ...customSeparatorStyles },
      },
    },
    root: {
      ariaDescribedBy: ariaDescribedBy ?? ariaDescribedByAlias,
      ariaDetails: ariaDetails ?? ariaDetailsAlias,
      ariaLabel: resolvedLabels.root.navigationAriaLabel,
      ariaLabelledBy: ariaLabelledBy ?? ariaLabelledByAlias,
      className: classNames(styles.pagination, rtl ? styles["pagination--rtl"] : null, customClassName, className),
      dataTestID: dataTestID ?? "pagination",
      isDisabled,
      nativeProps,
      style: { ...customComponentStyles, ...style },
    },
    visibility: {
      isVisible: numberOfItems > (state.itemsPerPage as number) || showWithOnePage,
    },
  }
}
