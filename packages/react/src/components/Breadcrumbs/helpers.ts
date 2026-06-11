import classNames from "classnames"
import type { CSSProperties, HTMLAttributes } from "react"

import type { TAriaLabelingProps } from "../../tokens/a11y"
import type { TCornerGeometry } from "../../tokens/geometry"
import {
  THEME_ORDER_CODE__PRIMARY,
  THEME_ORDER_CODE__QUATERNARY,
  THEME_ORDER_CODE__QUINTENARY,
  THEME_ORDER_CODE__SECONDARY,
  THEME_ORDER_CODE__TERTIARY,
  type TThemingOrderCode,
} from "../../tokens/theme-order"
import type { TClickPopoverProps } from "../ClickPopover/helpers"
import type { TLinkProps } from "../Link/helpers"

import styles from "./BreadcrumbsStyles.module.css"
import type { TPartialBreadcrumbsLabels } from "./labels"

type TEnumerate<N extends number, Acc extends number[] = []> = Acc["length"] extends N
  ? Acc[number]
  : TEnumerate<N, [...Acc, Acc["length"]]>
type TIntRange<F extends number, T extends number> = Exclude<TEnumerate<T>, TEnumerate<F>>

export const MIN_VISIBLE_BREADCRUMB_ITEMS = 3
export const MAX_VISIBLE_BREADCRUMB_ITEMS = 8
export const DEFAULT_MAX_VISIBLE_BREADCRUMB_ITEMS = 4
export const MIN_BREADCRUMBS_BEFORE_CONSOLIDATION = 3

export const CONSOLIDATION_PLACEMENT_SIDE__LEFT = "left"
export const CONSOLIDATION_PLACEMENT_SIDE__RIGHT = "right"
export const AVAILABLE_CONSOLIDATION_PLACEMENT_SIDES = [
  CONSOLIDATION_PLACEMENT_SIDE__LEFT,
  CONSOLIDATION_PLACEMENT_SIDE__RIGHT,
] as const

export type TAvailableConsolidationPlacementSides = (typeof AVAILABLE_CONSOLIDATION_PLACEMENT_SIDES)[number]

type TBreadcrumbsNativeProps = Omit<HTMLAttributes<HTMLOListElement>, "children" | "className" | "color" | "style">

export type TBreadcrumbsProps = TBreadcrumbsNativeProps &
  TAriaLabelingProps & {
    "data-testid"?: string
    color?: string
    order?: TThemingOrderCode
    geometry?: TCornerGeometry
    items: TBreadcrumbItemData[]
    labels?: TPartialBreadcrumbsLabels
    maxVisibleItems?: TIntRange<3, 9> // -> Interval boundaries are (inclusive, exclusive]
    consolidationPlacement?: TAvailableConsolidationPlacementSides
    isDisabled?: boolean
    linkTarget?: string
    onNavigate?: (details: TBreadcrumbNavigateDetails) => void
    className?: string
    style?: CSSProperties
    customClassName?: string
    customStyles?: CSSProperties
    customBreadcrumbClassName?: string
    customBreadcrumbStyles?: CSSProperties
    customPopoverClassName?: string
    customOverflowItemsPopoverButtonClassName?: string
    customOverflowItemsPopoverButtonStyles?: CSSProperties
    customOptionsListClassName?: string
    customOptionsListStyles?: CSSProperties
    customBreadcrumbLinkProps?: Partial<TLinkProps>
    customClickPopoverProps?: Partial<TClickPopoverProps>
  }

export type TBreadcrumbItemData = {
  id: string
  href: string
  disabled: boolean
  content: string
}

export type TBreadcrumbNavigateDetails = {
  href: string
  item: TBreadcrumbItemData
  target: string
}

export type TInternalBreadcrumbItem = TBreadcrumbItemData | TBreadcrumbItemData[]

type TBreadcrumbsCalibration = {
  breadcrumbsStyles: string
  popoverStyles: string
  breadcrumbsListStyles: string
  breadcrumbStyles: string
  internalBreadcrumbItems: TInternalBreadcrumbItem[]
  breadcrumbsColor: string
  customStyles: CSSProperties
  customBreadcrumbStyles: CSSProperties
}

export const mockBreadcrumbItems: TBreadcrumbItemData[] = [
  {
    id: "bdd0c445-455e-4811-ba8e-34ab5f12324a",
    href: "#levelA",
    content: "Level A",
    disabled: false,
  },
  {
    id: "2aaf6c45-77f5-4bf4-87b8-1ec35490da75",
    href: "#levelB",
    content: "Level B",
    disabled: false,
  },
  {
    id: "c46fbbac-2e7b-4e93-a7fc-d7b7c1ff4dd7",
    href: "#levelC",
    content: "Level C",
    disabled: false,
  },
  {
    id: "36b6354e-deea-4a66-919e-f4014a9bfa92",
    href: "#levelD",
    content: "Level D",
    disabled: false,
  },
  {
    id: "c778c5a4-74f6-4570-9f2e-9896905a102a",
    href: "#levelE",
    content: "Level E",
    disabled: false,
  },
  {
    id: "4856b675-f133-4e5d-b280-a28999ef5b37",
    href: "#levelF",
    content: "Level F",
    disabled: false,
  },
]

export const computeInternalBreadcrumbItems = (props: TBreadcrumbsProps) => {
  const {
    items,
    maxVisibleItems = DEFAULT_MAX_VISIBLE_BREADCRUMB_ITEMS,
    consolidationPlacement = CONSOLIDATION_PLACEMENT_SIDE__RIGHT,
  } = props
  let internalBreadcrumbItems: TInternalBreadcrumbItem[]

  if (items.length > MIN_BREADCRUMBS_BEFORE_CONSOLIDATION && items.length > maxVisibleItems) {
    // -> The component is designed to always show at least the first and last breadcrumb.
    //   -> The rest of these operations determine which breadcrumbs will still be visible
    //      and which will be consolidated into a click popover list.
    const itemsLeftToAnalyze = [...items].slice(1, -1)
    let remainingVisibleItems: TBreadcrumbItemData[]
    let itemsToConsolidate: TBreadcrumbItemData[]
    const numDisplayableItemsRemaining = maxVisibleItems - 2

    if (consolidationPlacement === "right") {
      remainingVisibleItems =
        numDisplayableItemsRemaining === 0 ? [] : itemsLeftToAnalyze.slice(0, numDisplayableItemsRemaining)
      itemsToConsolidate = itemsLeftToAnalyze.slice(numDisplayableItemsRemaining)

      internalBreadcrumbItems = [items[0], ...remainingVisibleItems, itemsToConsolidate, items[items.length - 1]]
    } else {
      remainingVisibleItems =
        numDisplayableItemsRemaining === 0
          ? []
          : itemsLeftToAnalyze.slice(itemsLeftToAnalyze.length - numDisplayableItemsRemaining)
      itemsToConsolidate = itemsLeftToAnalyze.slice(0, itemsLeftToAnalyze.length - numDisplayableItemsRemaining)

      internalBreadcrumbItems = [items[0], itemsToConsolidate, ...remainingVisibleItems, items[items.length - 1]]
    }
  } else internalBreadcrumbItems = items

  return internalBreadcrumbItems
}

const computeBreadcrumbsColor = (props: TBreadcrumbsProps) => {
  const { color, order } = props
  let breadcrumbsColor = ""

  if (color && order === undefined) breadcrumbsColor = color ?? "inherit"

  switch (order) {
    case THEME_ORDER_CODE__PRIMARY:
      breadcrumbsColor = "var(--cui-color-primary-500)"
      break
    case THEME_ORDER_CODE__SECONDARY:
      breadcrumbsColor = "var(--cui-color-secondary-500)"
      break
    case THEME_ORDER_CODE__TERTIARY:
      breadcrumbsColor = "var(--cui-color-tertiary-500)"
      break
    case THEME_ORDER_CODE__QUATERNARY:
      breadcrumbsColor = "var(--cui-color-quaternary-500)"
      break
    case THEME_ORDER_CODE__QUINTENARY:
      breadcrumbsColor = "var(--cui-color-quintenary-500)"
      break
    default:
      break
  }

  return breadcrumbsColor
}

export const calibrateComponent = (props: TBreadcrumbsProps): TBreadcrumbsCalibration => {
  const {
    className,
    customBreadcrumbClassName,
    customBreadcrumbStyles: customBreadcrumbStyles__props,
    customClassName,
    customOptionsListClassName,
    customPopoverClassName,
    customStyles: customStyles__props,
    style,
  } = props
  const { breadcrumbs, breadcrumb, popover, breadcrumbsList } = styles

  const internalBreadcrumbItems = computeInternalBreadcrumbItems(props)
  const breadcrumbsColor = computeBreadcrumbsColor(props)

  const breadcrumbsStyles = classNames(breadcrumbs, customClassName, className)
  const popoverStyles = classNames(popover, customPopoverClassName)
  const breadcrumbsListStyles = classNames(breadcrumbsList, customOptionsListClassName)
  const breadcrumbStyles = classNames(breadcrumb, customBreadcrumbClassName)

  const customStyles: CSSProperties = Object.assign(
    { color: breadcrumbsColor },
    { ...customStyles__props },
    { ...style },
  )
  const customBreadcrumbStyles: CSSProperties = Object.assign(
    { color: breadcrumbsColor },
    { ...customBreadcrumbStyles__props },
  )

  return {
    breadcrumbsStyles,
    popoverStyles,
    breadcrumbsListStyles,
    breadcrumbStyles,
    internalBreadcrumbItems,
    breadcrumbsColor,
    customStyles,
    customBreadcrumbStyles,
  }
}
