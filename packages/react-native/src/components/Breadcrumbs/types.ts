import type { ColorValue, StyleProp, TextStyle, View, ViewProps } from "react-native"

import type { TCornerGeometry } from "../../tokens/geometry"
import type { TThemingOrderCode } from "../../tokens/theme-order"
import type { TNativeClickPopoverProps } from "../ClickPopover/types"
import type { TNativeLinkProps } from "../Link/types"

import type { TNativeBreadcrumbConsolidationSide, TNativeBreadcrumbItem } from "./model"

export type TNativeBreadcrumbsRef = View
export type TNativeBreadcrumbNavigateDetails = Readonly<{ href: string; item: TNativeBreadcrumbItem; target: string }>
export const DEFAULT_NATIVE_BREADCRUMBS_LABELS = {
  navAriaLabel: "Breadcrumbs Nav",
  navigationRoleDescription: "Navigation",
  currentPageValue: "Current page",
  overflowBreadcrumbAriaLabel: "navigational breadcrumbs",
  overflowButtonAriaLabel: "Visually Consolidated Breadcrumbs",
  overflowListAriaLabel: "Consolidated Breadcrumb Items",
  descriptionLabel: "Description",
  detailsLabel: "Details",
} as const
export type TNativeBreadcrumbsLabels = { [K in keyof typeof DEFAULT_NATIVE_BREADCRUMBS_LABELS]: string }
export type TNativePartialBreadcrumbsLabels = Partial<TNativeBreadcrumbsLabels>
export type TNativeBreadcrumbsProps = Omit<ViewProps, "children" | "style" | "role" | "accessibilityRole"> & {
  items: readonly TNativeBreadcrumbItem[]
  color?: ColorValue
  order?: TThemingOrderCode
  geometry?: TCornerGeometry
  maxVisibleItems?: 3 | 4 | 5 | 6 | 7 | 8
  consolidationPlacement?: TNativeBreadcrumbConsolidationSide
  isDisabled?: boolean
  linkTarget?: string
  onNavigate?: (details: TNativeBreadcrumbNavigateDetails) => void
  onNavigationError?: TNativeLinkProps["onNavigationError"]
  labels?: Partial<TNativeBreadcrumbsLabels>
  customStyles?: StyleProp<TextStyle>
  style?: StyleProp<TextStyle>
  customBreadcrumbStyles?: StyleProp<TextStyle>
  customPopoverStyles?: StyleProp<TextStyle>
  customOptionsListStyles?: StyleProp<TextStyle>
  customOverflowItemsPopoverButtonStyles?: StyleProp<TextStyle>
  customBreadcrumbLinkProps?: Partial<TNativeLinkProps>
  customClickPopoverProps?: Partial<TNativeClickPopoverProps>
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  ariaDetails?: string
  "aria-describedby"?: string
  "aria-details"?: string
  "data-testid"?: string
}
