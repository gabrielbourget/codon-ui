"use client"

import { Fragment, useCallback, useMemo, useState, type FC } from "react"

import { ROUNDED } from "../../tokens/geometry"
import LineSegment from "../LineSegment/LineSegment"

import ItemsPerPage from "./components/ItemsPerPage/ItemsPerPage"
import PageCounter from "./components/PageCounter/PageCounter"
import PageInput from "./components/PageInput/PageInput"
import PrimaryPaginationControls from "./components/PrimaryPaginationControls/PrimaryPaginationControls"
import type { TPaginationSubComponentKeymap } from "./helpers"
import {
  DEFAULT_CHOSEN_PAGINATION_SUBCOMPONENTS,
  initState,
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__PAGE_COUNTER,
  PAGINATION_SUBCOMPONENT__PAGE_INPUT,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
  resolvePaginationLabels,
  useCalibratedComponent,
  type TPaginationProps,
  type TPaginationState,
} from "./helpers"

const Pagination: FC<TPaginationProps> = (props) => {
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
    className: _className,
    // -> General
    currentPage,
    setCurrentPage,
    itemsPerPage: itemsPerPage__props,
    itemsPerPageOptions: _itemsPerPageOptions,
    order,
    color,
    numberOfItems,
    isDisabled = false,
    geometry = ROUNDED,
    buttonColorMode = "fill",
    setItemsPerPage,
    rtl = false,
    chosenPaginationSubcomponents: chosenPaginationSubcomponents__props,
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
    // -> Conditional element visibility
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
    // -> Custom styles and props
    customClassName: _customClassName,
    customComponentStyles: _customComponentStyles,
    customSeparatorClassName,
    customSeparatorStyles,
    style: _style,
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
    ...rest
  } = props
  let chosenPaginationSubcomponents = chosenPaginationSubcomponents__props
  const [state, setState] = useState<TPaginationState>({ ...initState, itemsPerPage: itemsPerPage__props })
  const disabled = isDisabled

  if (!chosenPaginationSubcomponents || chosenPaginationSubcomponents.length === 0) {
    chosenPaginationSubcomponents = DEFAULT_CHOSEN_PAGINATION_SUBCOMPONENTS
  }

  const {
    paginationStyles,
    itemsPerPageOptionsList,
    numberOfPages,
    internalPaginationItems,
    computedPageButtonTextColor,
    iconColor,
    paginationStyle,
  } = useCalibratedComponent(props)

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

  const onPageNumButtonClick = useCallback(
    (pageNum: number) => {
      if (pageNum === currentPage) return
      setCurrentPage(pageNum)
    },
    [currentPage, setCurrentPage],
  )

  const onPageNumberInputChange = (value: number) => setState((prevState) => ({ ...prevState, pageNumInput: value }))

  // -> Handler changes items/page that pagination component works with
  // -> Also calibrates the current page number to what page the first item showing would be on
  //    given the new number of items to show per page and the total number of items that can be shown.
  const onItemsPerPageSelectionChange = useCallback(
    (ID: string | number) => {
      const value = itemsPerPageOptionsList.find((option) => option.id === ID)?.name
      const prevItemsPerPage = state.itemsPerPage as number
      const prevPageFirstItemIndex = (currentPage - 1) * prevItemsPerPage

      const newItemsPerPage = parseInt(value!, 10)
      const newPageZeroBased = Math.floor(prevPageFirstItemIndex / newItemsPerPage)
      const totalPages = Math.ceil(numberOfItems / newItemsPerPage)
      const newPage = Math.min(newPageZeroBased + 1, totalPages)

      setState((prevState) => ({ ...prevState, itemsPerPage: newItemsPerPage }))
      setItemsPerPage(newItemsPerPage)
      setCurrentPage(newPage)
    },
    [setItemsPerPage, setCurrentPage, currentPage, itemsPerPageOptionsList, numberOfItems, state.itemsPerPage],
  )

  const { pageNumInput, itemsPerPage } = state
  const rootAriaLabel = resolvedLabels.root.navigationAriaLabel

  // -> Guards against user specifying they want a sub-component more than once.
  const processedPaginationSubcomponents = useMemo(
    () => new Set(chosenPaginationSubcomponents),
    [chosenPaginationSubcomponents],
  )

  // ---------------- //
  // - Page Counter - //
  // ---------------- //
  const PageCounterComponent = useCallback(
    () => (
      <PageCounter
        currentPage={currentPage}
        numberOfPages={numberOfPages}
        labels={resolvedLabels.pageCounter}
        customPageCounterProps={customPageCounterProps}
        customCounterClassName={customPageCounterClassName}
        customCounterStyles={customPageCounterStyles}
      />
    ),
    [
      currentPage,
      customPageCounterClassName,
      customPageCounterProps,
      customPageCounterStyles,
      numberOfPages,
      resolvedLabels.pageCounter,
    ],
  )

  // -------------- //
  // - Page Input - //
  // -------------- //
  const PageInputComponent = useCallback(
    () => (
      <PageInput
        pageNumInput={pageNumInput as number}
        numberOfPages={numberOfPages}
        color={color}
        order={order}
        geometry={geometry}
        buttonColorMode={buttonColorMode}
        disabled={disabled}
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
    [
      buttonColorMode,
      color,
      customGeneralButtonProps,
      customPageNumberInputFormFieldClassName,
      customPageNumberInputFormFieldProps,
      geometry,
      customPageNumberInputFormFieldStyles,
      customPageNumberInputNavigationButtonClassName,
      customPageNumberInputNavigationButtonStyles,
      customPageNumberInputProps,
      customPageNumberInputStyles,
      disabled,
      numberOfPages,
      onPageNumButtonClick,
      order,
      pageNumInput,
      resolvedLabels.pageInput,
    ],
  )

  // ------------------ //
  // - Items Per Page - //
  // ------------------ //
  const ItemsPerPageComponent = useCallback(
    () => (
      <ItemsPerPage
        itemsPerPage={itemsPerPage}
        itemsPerPageOptionsList={itemsPerPageOptionsList}
        onItemsPerPageSelectionChange={onItemsPerPageSelectionChange}
        geometry={geometry}
        disabled={disabled}
        labels={resolvedLabels.itemsPerPage}
        customItemsPerPageFormFieldClassName={customItemsPerPageFormFieldClassName}
        customItemsPerPageFormFieldStyles={customItemsPerPageFormFieldStyles}
        customItemsPerPageFormFieldProps={customItemsPerPageFormFieldProps}
        customItemsPerPageSelectClassName={customItemsPerPageSelectClassName}
        customItemsPerPageSelectStyles={customItemsPerPageSelectStyles}
        customItemsPerPageSelectProps={customItemsPerPageSelectProps}
      />
    ),
    [
      customItemsPerPageFormFieldClassName,
      customItemsPerPageFormFieldProps,
      customItemsPerPageFormFieldStyles,
      customItemsPerPageSelectProps,
      geometry,
      customItemsPerPageSelectClassName,
      customItemsPerPageSelectStyles,
      disabled,
      itemsPerPage,
      itemsPerPageOptionsList,
      onItemsPerPageSelectionChange,
      resolvedLabels.itemsPerPage,
    ],
  )

  // -------------------- //
  // - Primary Controls - //
  // -------------------- //
  const PrimaryPaginationControlsComponent = useCallback(
    () => (
      <PrimaryPaginationControls
        internalPaginationItems={internalPaginationItems}
        itemsPerPage={itemsPerPage as number}
        numberOfItems={numberOfItems}
        currentPage={currentPage}
        color={color}
        order={order}
        geometry={geometry}
        buttonColorMode={buttonColorMode}
        iconColor={iconColor}
        computedPageButtonTextColor={computedPageButtonTextColor}
        rtl={rtl}
        disabled={disabled}
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
    [
      buttonColorMode,
      color,
      computedPageButtonTextColor,
      currentPage,
      customClickPopoverProps,
      customClickPopoverTriggerButtonClassName,
      customClickPopoverTriggerButtonStyles,
      customFirstPageButtonClassName,
      customFirstPageButtonStyles,
      customGeneralButtonProps,
      customLastPageButtonClassName,
      customLastPageButtonStyles,
      customNextButtonClassName,
      customNextButtonStyles,
      customOptionsListClassName,
      customOptionsListStyles,
      customPageNumberButtonClassName,
      customPageNumberButtonStyles,
      customPrevButtonClassName,
      customPrevButtonStyles,
      disabled,
      geometry,
      iconColor,
      incrementAllDownIcon,
      incrementAllUpIcon,
      incrementDownIcon,
      incrementUpIcon,
      internalPaginationItems,
      itemsPerPage,
      numberOfItems,
      onPageNumButtonClick,
      order,
      overflowItemsButtonIcon,
      resolvedLabels.primaryControls,
      rtl,
      showFirstPageButton,
      showFirstPageButtonIcon,
      showFirstPageButtonLabel,
      showFirstPageButtonOnFirstPage,
      showIncrementButtons,
      showIncrementButtonsWithOnePage,
      showLastPageButton,
      showLastPageButtonIcon,
      showLastPageButtonLabel,
      showLastPageButtonOnLastPage,
      showNextPageButton,
      showNextPageButtonIcon,
      showNextPageButtonLabel,
      showNextPageButtonOnLastPage,
      showPrevPageButton,
      showPrevPageButtonIcon,
      showPrevPageButtonLabel,
      showPrevPageButtonOnFirstPage,
    ],
  )

  // -------------------- //
  // - Component Keymap - //
  // -------------------- //
  const paginationSubComponentKeymap: TPaginationSubComponentKeymap = useMemo(
    () => ({
      [PAGINATION_SUBCOMPONENT__PAGE_COUNTER]: <PageCounterComponent />,
      [PAGINATION_SUBCOMPONENT__PAGE_INPUT]: <PageInputComponent />,
      [PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE]: <ItemsPerPageComponent />,
      [PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS]: <PrimaryPaginationControlsComponent />,
    }),
    [ItemsPerPageComponent, PageCounterComponent, PageInputComponent, PrimaryPaginationControlsComponent],
  )

  return numberOfItems <= (itemsPerPage as number) && showWithOnePage === false ? null : (
    <nav
      {...rest}
      aria-label={rootAriaLabel}
      aria-labelledby={ariaLabelledBy ?? ariaLabelledByAlias}
      aria-describedby={ariaDescribedBy ?? ariaDescribedByAlias}
      aria-details={ariaDetails ?? ariaDetailsAlias}
      className={paginationStyles}
      style={paginationStyle}
      data-disabled={disabled ? "true" : undefined}
      data-testid={dataTestID ?? "pagination"}
    >
      {[...processedPaginationSubcomponents].map((chosenSubComponent: string, index) => (
        <Fragment key={`pagaination-render-fragment-${index}`}>
          {paginationSubComponentKeymap[chosenSubComponent as keyof TPaginationSubComponentKeymap]}

          {index < [...processedPaginationSubcomponents].length - 1 ? (
            <LineSegment
              key={`line-segment-${index + 1}`}
              direction="vertical"
              color="var(--cui-border)"
              customClassName={customSeparatorClassName}
              customStyles={{ height: "100%", width: 0.75, ...customSeparatorStyles }}
            />
          ) : null}
        </Fragment>
      ))}
    </nav>
  )
}

export default Pagination
