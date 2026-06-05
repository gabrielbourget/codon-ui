export type TBreadcrumbsLabels = {
  navAriaLabel: string
  overflowBreadcrumbAriaLabel: string
  overflowButtonAriaLabel: string
  overflowListAriaLabel: string
}

export type TPartialBreadcrumbsLabels = Partial<TBreadcrumbsLabels>

export const DEFAULT_BREADCRUMBS_LABELS: TBreadcrumbsLabels = {
  navAriaLabel: "Breadcrumbs Nav",
  overflowBreadcrumbAriaLabel: "navigational breadcrumbs",
  overflowButtonAriaLabel: "Visually Consolidated Breadcrumbs",
  overflowListAriaLabel: "Consolidated Breadcrumb Items",
}

export const resolveBreadcrumbsLabels = (labels?: TPartialBreadcrumbsLabels): TBreadcrumbsLabels => ({
  ...DEFAULT_BREADCRUMBS_LABELS,
  ...labels,
})
