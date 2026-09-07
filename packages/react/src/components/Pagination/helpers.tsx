import {
  useCallback,
  useMemo,
  type CSSProperties,
  type Dispatch,
  type HTMLAttributes,
  type ReactNode,
  type SetStateAction,
} from "react"

import { ROUNDED, type TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"
import type { TAvailableColorModes, TButtonProps } from "../Button/helpers"
import type { TClickPopoverProps } from "../ClickPopover/helpers"
import type { TCounterProps } from "../Counter/helpers"
import type { TFormFieldProps } from "../FormField/helpers"
import type { TNumberInputProps } from "../NumberInput/helpers"
import type { TPartialNumberInputLabels } from "../NumberInput/labels"
import type { TSelectProps } from "../Select/helpers"

import ItemsPerPage from "./components/ItemsPerPage/ItemsPerPage"
import PageCounter from "./components/PageCounter/PageCounter"
import PageInput from "./components/PageInput/PageInput"
import PrimaryPaginationControls from "./components/PrimaryPaginationControls/PrimaryPaginationControls"

export const MIN_VISIBLE_PAGINATION_ITEMS = 3
export const DEFAULT_MAX_VISIBLE_PAGINATION_ITEMS = 10
export const MAX_VISIBLE_PAGINATION_ITEMS = 21
export const MIN_PAGINATION_ITEMS_BEFORE_CONSOLIDATION = 3
export const AVAILABLE_ITEMS_PER_PAGE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
export const DEFAULT_ITEMS_PER_PAGE = 10

type TEnumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : TEnumerate<N, [...Acc, Acc["length"]]>
type TIntRange<F extends number, T extends number> = Exclude<TEnumerate<T>, TEnumerate<F>>
type TAriaLabelingProps = {
  "aria-label"?: string
  ariaLabel?: string
  "aria-labelledby"?: string
  ariaLabelledBy?: string
  "aria-describedby"?: string
  ariaDescribedBy?: string
  "aria-details"?: string
  ariaDetails?: string
}

export const buildItemsPerPageOptions = <T extends readonly string[]>(items: T) => {
  return items.map((item) => ({
    id: item,
    name: item,
  })) as { id: T[number]; name: T[number] }[]
}

export const PAGINATION_SUBCOMPONENT__PAGE_COUNTER = "page-counter"
export const PAGINATION_SUBCOMPONENT__PAGE_INPUT = "page-input"
export const PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE = "items-per-page"
export const PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS = "primary-controls"
export const AVAILABLE_PAGINATION_SUBCOMPONENTS = [
  PAGINATION_SUBCOMPONENT__PAGE_COUNTER,
  PAGINATION_SUBCOMPONENT__PAGE_INPUT,
  PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE,
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
] as const
export type TPaginationSubComponent = (typeof AVAILABLE_PAGINATION_SUBCOMPONENTS)[number]

export const DEFAULT_CHOSEN_PAGINATION_SUBCOMPONENTS = [
  PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS,
] as (keyof TPaginationSubComponentKeymap)[]

export type TPaginationRootLabels = {
  navigationAriaLabel: string
}

export type TPaginationPrimaryControlsLabels = {
  firstPageButton: string
  firstPageButtonAriaLabel: string
  previousPageButton: string
  previousPageButtonAriaLabel: string
  nextPageButton: string
  nextPageButtonAriaLabel: string
  lastPageButton: string
  lastPageButtonAriaLabel: string
  pageButtonAriaLabel: (pageNum: number) => string
  overflowButtonAriaLabel: string
  overflowListAriaLabel: (position: number) => string
}

export type TPaginationPageCounterLabels = {
  counterText: string
  ariaLabel: string
}

export type TPaginationPageInputLabels = {
  label: string
  placeholder: string
  submitButtonText: string
  submitButtonAriaLabel: string
  numberInput: TPartialNumberInputLabels
}

export type TPaginationItemsPerPageLabels = {
  label: string
  placeholder: string
}

export type TPaginationLabels = {
  root: TPaginationRootLabels
  primaryControls: TPaginationPrimaryControlsLabels
  pageCounter: TPaginationPageCounterLabels
  pageInput: TPaginationPageInputLabels
  itemsPerPage: TPaginationItemsPerPageLabels
}

export type TPartialPaginationLabels = {
  root?: Partial<TPaginationRootLabels>
  primaryControls?: Partial<TPaginationPrimaryControlsLabels>
  pageCounter?: Partial<TPaginationPageCounterLabels>
  pageInput?: Partial<TPaginationPageInputLabels>
  itemsPerPage?: Partial<TPaginationItemsPerPageLabels>
}

export const DEFAULT_PAGINATION_LABELS: TPaginationLabels = {
  root: {
    navigationAriaLabel: "Pagination Navigation",
  },
  primaryControls: {
    firstPageButton: "First",
    firstPageButtonAriaLabel: "First Page",
    previousPageButton: "Prev",
    previousPageButtonAriaLabel: "Previous Page",
    nextPageButton: "Next",
    nextPageButtonAriaLabel: "Next Page",
    lastPageButton: "Last",
    lastPageButtonAriaLabel: "Last Page",
    pageButtonAriaLabel: (pageNum: number) => `Go To Page ${pageNum}`,
    overflowButtonAriaLabel: "Visually Consolidated Pagination Items",
    overflowListAriaLabel: (position: number) => `Consolidated pages at position ${position}`,
  },
  pageCounter: {
    counterText: "Pages",
    ariaLabel: "Page Number Counter",
  },
  pageInput: {
    label: "Go To Page",
    placeholder: "Page #",
    submitButtonText: "Go",
    submitButtonAriaLabel: "Navigate to Selected Page",
    numberInput: {
      inputButtonGroupAriaLabel: "Pagination Page Input Button Group",
    },
  },
  itemsPerPage: {
    label: "Items Per Page",
    placeholder: "#/Page",
  },
}

export const CONSOLIDATION_PLACEMENT_SIDE__LEFT = "left"
export const CONSOLIDATION_PLACEMENT_SIDE__RIGHT = "right"
export const AVAILABLE_CONSOLIDATION_PLACEMENT_SIDES = [
  CONSOLIDATION_PLACEMENT_SIDE__LEFT,
  CONSOLIDATION_PLACEMENT_SIDE__RIGHT,
] as const

export type TAvailableConsolidationPlacementSides = (typeof AVAILABLE_CONSOLIDATION_PLACEMENT_SIDES)[number]

type TPaginationNativeProps = Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "color" | "style">

export type TPaginationProps = TPaginationNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    // ↓ Mandatory //

    currentPage: number
    setCurrentPage: (pageNumber: number) => void
    itemsPerPage: number
    setItemsPerPage: (itemsPerPage: number) => void
    numberOfItems: number

    // ↓ Optional //

    // -> General
    chosenPaginationSubcomponents?: (keyof TPaginationSubComponentKeymap)[]
    itemsPerPageOptions?: number[]
    color?: string
    order?: TThemingOrderCode
    // -> Interval boundary is inclusive for the minimum and exclusive for the maximum
    maxVisiblePages?: TIntRange<typeof MIN_VISIBLE_PAGINATION_ITEMS, typeof MAX_VISIBLE_PAGINATION_ITEMS>
    consolidationPlacement?: TAvailableConsolidationPlacementSides
    geometry?: TCornerGeometry
    buttonColorMode?: TAvailableColorModes
    rtl?: boolean
    isDisabled?: boolean
    labels?: TPartialPaginationLabels
    // -> Custom icons and text
    firstPageLabel?: string
    incrementAllDownIcon?: ReactNode
    prevPageLabel?: string
    incrementDownIcon?: ReactNode
    nextPageLabel?: string
    incrementUpIcon?: ReactNode
    lastPageLabel?: string
    incrementAllUpIcon?: ReactNode
    overflowItemsButtonIcon?: ReactNode
    counterText?: string
    pageInputLabel?: string
    pageInputSelectionButtonText?: string
    itemsPerPageLabel?: string
    itemsPerPageSelectPlaceholder?: string
    // -> Conditional element visibility
    showWithOnePage?: boolean
    showIncrementButtons?: boolean
    showIncrementButtonsWithOnePage?: boolean
    showLastPageButton?: boolean
    showLastPageButtonIcon?: boolean
    showLastPageButtonLabel?: boolean
    showLastPageButtonOnLastPage?: boolean
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
    // -> Custom styles and props
    className?: string
    style?: CSSProperties
    customClassName?: string
    customComponentStyles?: CSSProperties
    customSeparatorClassName?: string
    customSeparatorStyles?: CSSProperties
    customGeneralButtonProps?: Partial<TButtonProps> // -> Props one would like applied consistently to all <Button />s in the component
    // ---> Primary Controls
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
    // ---> Page Counter
    customPageCounterClassName?: string
    customPageCounterStyles?: CSSProperties
    customPageCounterProps?: Partial<TCounterProps>
    // ---> Page Number Input
    customPageNumberInputFormFieldProps?: Partial<TFormFieldProps>
    customPageNumberInputFormFieldClassName?: string
    customPageNumberInputFormFieldStyles?: CSSProperties
    customPageNumberInputProps?: Partial<TNumberInputProps>
    customPageNumberInputStyles?: CSSProperties
    customPageNumberInputNavigationButtonClassName?: string
    customPageNumberInputNavigationButtonStyles?: CSSProperties
    // ---> Items Per Page Select
    customItemsPerPageFormFieldClassName?: string
    customItemsPerPageFormFieldStyles?: CSSProperties
    customItemsPerPageFormFieldProps?: Partial<TFormFieldProps>
    customItemsPerPageSelectClassName?: string
    customItemsPerPageSelectStyles?: CSSProperties
    customItemsPerPageSelectProps?: Partial<TSelectProps<{ id: string; name: string }>>
    // ---> Consolidated Items List
    customOptionsListClassName?: string
    customOptionsListStyles?: CSSProperties
    customClickPopoverProps?: Partial<TClickPopoverProps>
    customClickPopoverTriggerButtonClassName?: string
    customClickPopoverTriggerButtonStyles?: CSSProperties
  }

type TResolvePaginationLabelsArgs = Pick<
  TPaginationProps,
  | "labels"
  | "firstPageLabel"
  | "prevPageLabel"
  | "nextPageLabel"
  | "lastPageLabel"
  | "counterText"
  | "pageInputLabel"
  | "pageInputSelectionButtonText"
  | "itemsPerPageLabel"
  | "itemsPerPageSelectPlaceholder"
>

export const resolvePaginationLabels = (args: TResolvePaginationLabelsArgs): TPaginationLabels => {
  const {
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
  } = args

  return {
    root: {
      ...DEFAULT_PAGINATION_LABELS.root,
      ...labels?.root,
    },
    primaryControls: {
      ...DEFAULT_PAGINATION_LABELS.primaryControls,
      firstPageButton: firstPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.firstPageButton,
      previousPageButton: prevPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.previousPageButton,
      nextPageButton: nextPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.nextPageButton,
      lastPageButton: lastPageLabel ?? DEFAULT_PAGINATION_LABELS.primaryControls.lastPageButton,
      ...labels?.primaryControls,
    },
    pageCounter: {
      ...DEFAULT_PAGINATION_LABELS.pageCounter,
      counterText: counterText ? counterText : DEFAULT_PAGINATION_LABELS.pageCounter.counterText,
      ...labels?.pageCounter,
    },
    pageInput: {
      ...DEFAULT_PAGINATION_LABELS.pageInput,
      label: pageInputLabel ?? DEFAULT_PAGINATION_LABELS.pageInput.label,
      submitButtonText: pageInputSelectionButtonText ?? DEFAULT_PAGINATION_LABELS.pageInput.submitButtonText,
      ...labels?.pageInput,
      numberInput: {
        ...DEFAULT_PAGINATION_LABELS.pageInput.numberInput,
        ...labels?.pageInput?.numberInput,
      },
    },
    itemsPerPage: {
      ...DEFAULT_PAGINATION_LABELS.itemsPerPage,
      label: itemsPerPageLabel ?? DEFAULT_PAGINATION_LABELS.itemsPerPage.label,
      placeholder: itemsPerPageSelectPlaceholder ?? DEFAULT_PAGINATION_LABELS.itemsPerPage.placeholder,
      ...labels?.itemsPerPage,
    },
  }
}

export type TPaginationState = {
  chosenPaginationSubcomponents: (keyof TPaginationSubComponentKeymap)[]
  processedPaginationSubcomponents: (keyof TPaginationSubComponentKeymap)[]
  pageNumInput: number | string
  itemsPerPage: number | string
  numberOfPages: number
  itemsPerPageOptionsList: { id: string; name: string }[]
}

export const initState: TPaginationState = {
  chosenPaginationSubcomponents: [],
  processedPaginationSubcomponents: [],
  pageNumInput: 1,
  itemsPerPage: 10,
  itemsPerPageOptionsList: [],
  numberOfPages: 1,
}

export type TPaginationSubComponentKeymap = {
  [PAGINATION_SUBCOMPONENT__PAGE_COUNTER]: ReactNode
  [PAGINATION_SUBCOMPONENT__PAGE_INPUT]: ReactNode
  [PAGINATION_SUBCOMPONENT__ITEMS_PER_PAGE]: ReactNode
  [PAGINATION_SUBCOMPONENT__PRIMARY_PAGINATION_CONTROLS]: ReactNode
}

export type TInternalPaginationItem = number | number[]

const generatePageNumbersArray = (numberOfPages: number, rtl: boolean): number[] => {
  const pages = Array.from({ length: numberOfPages }, (_, i) => i + 1)
  return rtl ? pages.reverse() : pages
}

type ConsolidationRequiredArgs = {
  numberOfPages: number
  minPagesBeforeConsolidation: number
  maxVisiblePages: number
}

type ConsolidateBetweenFirstAndLastPagesArgs = {
  middlePages: number[]
  consolidationPlacement: TAvailableConsolidationPlacementSides
  maxVisiblePages: number
  rtl: boolean
  firstPage: number
  lastPage: number
}

type ConsolidateBetweenFirstAndLastPagesReturn = {
  visiblePagesBeforeCurrentPage: number[]
  visiblePagesAfterCurrentPage: number[]
  consolidatedPagesBeforeCurrentPage: number[]
  consolidatedPagesAfterCurrentPage: number[]
}

const consolidationRequired = ({
  numberOfPages,
  minPagesBeforeConsolidation,
  maxVisiblePages,
}: ConsolidationRequiredArgs): boolean => numberOfPages > minPagesBeforeConsolidation && numberOfPages > maxVisiblePages

// -> Consolidate pages when current page is first or last, by collapsing the middle pages.
const consolidateBetweenFirstAndLastPages = ({
  middlePages,
  consolidationPlacement,
  maxVisiblePages,
  rtl,
  firstPage,
  lastPage,
}: ConsolidateBetweenFirstAndLastPagesArgs): TInternalPaginationItem[] => {
  const visiblePageSlots = maxVisiblePages - 2
  let visiblePages: number[]
  let consolidatedPages: number[]

  // -> Decide which middle pages remain visible vs get consolidated.
  if (consolidationPlacement === "right") {
    visiblePages = middlePages.slice(0, visiblePageSlots)
    consolidatedPages = middlePages.slice(visiblePageSlots)
  } else {
    visiblePages = middlePages.slice(-visiblePageSlots)
    consolidatedPages = middlePages.slice(0, -visiblePageSlots)
  }

  if (rtl && consolidatedPages.length) consolidatedPages = consolidatedPages.reverse()

  // -> Build items array so the overflow control is physically placed on the requested side.
  const internalPaginationItems: TInternalPaginationItem[] = [firstPage]

  if (consolidationPlacement === "left") {
    // e.g. 1, [...consolidated], 18,19,20
    if (consolidatedPages.length) internalPaginationItems.push(consolidatedPages)
    internalPaginationItems.push(...visiblePages)
  } else {
    // e.g. 1, 2,3,4, [...consolidated], 20
    internalPaginationItems.push(...visiblePages)
    if (consolidatedPages.length) internalPaginationItems.push(consolidatedPages)
  }

  internalPaginationItems.push(lastPage)
  return internalPaginationItems
}

// -> Consolidate pages around the current page, returning both visible and consolidated pages.
const consolidateAroundCurrentPage = (
  pagesBeforeCurrentPage: number[],
  pagesAfterCurrentPage: number[],
  visiblePageSlots: number,
  consolidationSide: TAvailableConsolidationPlacementSides,
): ConsolidateBetweenFirstAndLastPagesReturn => {
  let showBeforeCurrentPageCount = 0
  let showAfterCurrentPageCount = 0

  if (visiblePageSlots > 0) {
    if (consolidationSide === CONSOLIDATION_PLACEMENT_SIDE__RIGHT) {
      showBeforeCurrentPageCount = Math.min(pagesBeforeCurrentPage.length, visiblePageSlots)
      showAfterCurrentPageCount = Math.min(pagesAfterCurrentPage.length, visiblePageSlots - showBeforeCurrentPageCount)
    } else {
      showAfterCurrentPageCount = Math.min(pagesAfterCurrentPage.length, visiblePageSlots)
      showBeforeCurrentPageCount = Math.min(pagesBeforeCurrentPage.length, visiblePageSlots - showAfterCurrentPageCount)
    }
  }

  const visiblePagesBeforeCurrentPage = pagesBeforeCurrentPage.slice(
    pagesBeforeCurrentPage.length - showBeforeCurrentPageCount,
  )
  const consolidatedPagesBeforeCurrentPage = pagesBeforeCurrentPage.slice(
    0,
    pagesBeforeCurrentPage.length - showBeforeCurrentPageCount,
  )

  const visiblePagesAfterCurrentPage = pagesAfterCurrentPage.slice(0, showAfterCurrentPageCount)
  const consolidatedPagesAfterCurrentPage = pagesAfterCurrentPage.slice(showAfterCurrentPageCount)

  return {
    visiblePagesBeforeCurrentPage,
    visiblePagesAfterCurrentPage,
    consolidatedPagesBeforeCurrentPage,
    consolidatedPagesAfterCurrentPage,
  }
}

// ---------------------------------------- //
// - Internal Pagination Item Computation - //
// ---------------------------------------- //
// Goal:
// -> Determine if there are more pages to account for than are allowed to be
//    visually displayed. Based on a number of factors, determine which of the
//    pages will be displayed as page number buttons and which will be
//    consolidated into dropdown lists.
// Preconditions:
// -> The component is designed to always show at least the first, last, and currently selected page button.
// -> Depending on factors such as a minimum number of buttons to show before consolidation, the max number
//    of visible buttons allowed specified, and number of pages to show, overflow buttons are consolidated
//    into dropdown lists.
export const computeInternalPaginationItems = (props: TPaginationProps): TInternalPaginationItem[] => {
  const {
    numberOfItems,
    itemsPerPage,
    currentPage,
    maxVisiblePages = DEFAULT_MAX_VISIBLE_PAGINATION_ITEMS,
    consolidationPlacement = CONSOLIDATION_PLACEMENT_SIDE__LEFT,
    rtl = false,
  } = props

  const numberOfPages = Math.max(Math.ceil(numberOfItems / itemsPerPage), 1)
  const pageNumbersToIterateOver = generatePageNumbersArray(numberOfPages, rtl)

  // -> Early return if no consolidation is needed.
  if (
    !consolidationRequired({
      numberOfPages,
      minPagesBeforeConsolidation: MIN_PAGINATION_ITEMS_BEFORE_CONSOLIDATION,
      maxVisiblePages,
    })
  ) {
    return pageNumbersToIterateOver
  }

  const middlePages = pageNumbersToIterateOver.slice(1, -1)
  const firstPage = pageNumbersToIterateOver[0]
  const lastPage = pageNumbersToIterateOver.at(-1)!
  const currentPageIndex = pageNumbersToIterateOver.findIndex((n) => n === currentPage)

  // -> Current page is first or last page
  if (currentPageIndex === 0 || currentPageIndex === pageNumbersToIterateOver.length - 1) {
    return consolidateBetweenFirstAndLastPages({
      middlePages,
      consolidationPlacement,
      maxVisiblePages,
      rtl,
      firstPage,
      lastPage,
    })
  }

  // -> Current page is between first and last page if logic gets past last condition
  // NOTE: `currentPageIndex` is relative to the full pages array (including first/last),
  // whereas `middlePages` excludes those two anchors. Convert to middle-space indexing.
  const currentPageIndexInMiddlePages = currentPageIndex - 1
  const pagesBeforeCurrentPage = middlePages.slice(0, currentPageIndexInMiddlePages)
  const pagesAfterCurrentPage = middlePages.slice(currentPageIndexInMiddlePages + 1)
  const visiblePageSlots = maxVisiblePages - 3

  const {
    visiblePagesBeforeCurrentPage,
    visiblePagesAfterCurrentPage,
    consolidatedPagesBeforeCurrentPage,
    consolidatedPagesAfterCurrentPage,
  } = consolidateAroundCurrentPage(
    pagesBeforeCurrentPage,
    pagesAfterCurrentPage,
    visiblePageSlots,
    consolidationPlacement,
  )

  // -> Compute and return final internal pagination items array
  const internalPaginationItems: TInternalPaginationItem[] = [firstPage]
  if (consolidatedPagesBeforeCurrentPage.length) internalPaginationItems.push(consolidatedPagesBeforeCurrentPage)
  internalPaginationItems.push(...visiblePagesBeforeCurrentPage)
  internalPaginationItems.push(currentPage)
  internalPaginationItems.push(...visiblePagesAfterCurrentPage)
  if (consolidatedPagesAfterCurrentPage.length) internalPaginationItems.push(consolidatedPagesAfterCurrentPage)
  internalPaginationItems.push(lastPage)

  return internalPaginationItems
}

type TCalibratedPaginationComponent = {
  items: { key: keyof TPaginationSubComponentKeymap; node: ReactNode }[]
  navigationAriaLabel: string
  nativeProps: Omit<HTMLAttributes<HTMLElement>, "children" | "className" | "color" | "style">
}

/**
 * Prepares Pagination's subcomponent composition and page-size coordination from visible component state.
 * Callers retain controlled page and page-size ownership; native props are filtered from the large composition API.
 */
export const useCalibratedComponent = ({
  props,
  state,
  setState,
  onPageNumberInputChange,
}: {
  props: TPaginationProps
  state: TPaginationState
  setState: Dispatch<SetStateAction<TPaginationState>>
  onPageNumberInputChange: (value: number) => void
}): TCalibratedPaginationComponent => {
  const {
    "aria-describedby": _ariaDescribedBy,
    "aria-details": _ariaDetails,
    "aria-label": _ariaLabel,
    "aria-labelledby": _ariaLabelledBy,
    "data-testid": _dataTestID,
    ariaDescribedBy: _ariaDescribedByAlias,
    ariaDetails: _ariaDetailsAlias,
    ariaLabel: _ariaLabelAlias,
    ariaLabelledBy: _ariaLabelledByAlias,
    className: _className,
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
    showWithOnePage: _showWithOnePage,
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
    customClassName: _customClassName,
    customComponentStyles: _customComponentStyles,
    customSeparatorClassName: _customSeparatorClassName,
    customSeparatorStyles: _customSeparatorStyles,
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
    ...nativeProps
  } = props
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
    [
      currentPage,
      itemsPerPageOptionsList,
      numberOfItems,
      setCurrentPage,
      setItemsPerPage,
      setState,
      state.itemsPerPage,
    ],
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
    items: [...processedPaginationSubcomponents].map((key) => ({ key, node: paginationSubComponentKeymap[key] })),
    navigationAriaLabel: resolvedLabels.root.navigationAriaLabel,
    nativeProps,
  }
}
