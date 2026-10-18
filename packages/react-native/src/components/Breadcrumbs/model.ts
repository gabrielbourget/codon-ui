export const NATIVE_BREADCRUMB_CONSOLIDATION_SIDES = ["left", "right"] as const
export type TNativeBreadcrumbConsolidationSide = (typeof NATIVE_BREADCRUMB_CONSOLIDATION_SIDES)[number]
export type TNativeBreadcrumbItem = Readonly<{ id: string; href: string; content: string; disabled: boolean }>
export type TNativeBreadcrumbNode =
  | Readonly<{ kind: "item"; item: TNativeBreadcrumbItem }>
  | Readonly<{ kind: "overflow"; items: readonly TNativeBreadcrumbItem[] }>

export const createNativeBreadcrumbNodes = (
  items: readonly TNativeBreadcrumbItem[],
  maxVisibleItems = 4,
  consolidationPlacement: TNativeBreadcrumbConsolidationSide = "right",
): readonly TNativeBreadcrumbNode[] => {
  if (!Array.isArray(items)) throw new TypeError("Breadcrumbs: items must be an array")
  if (!Number.isInteger(maxVisibleItems) || maxVisibleItems < 3 || maxVisibleItems > 8)
    throw new RangeError("Breadcrumbs: maxVisibleItems must be an integer from 3 through 8")
  if (!NATIVE_BREADCRUMB_CONSOLIDATION_SIDES.includes(consolidationPlacement))
    throw new TypeError("Breadcrumbs: unsupported consolidationPlacement")
  const identities = new Set<string>()
  for (const item of items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.href !== "string" ||
      typeof item.content !== "string" ||
      typeof item.disabled !== "boolean"
    )
      throw new TypeError("Breadcrumbs: each item requires string id/href/content and boolean disabled")
    if (identities.has(item.id)) throw new TypeError("Breadcrumbs: item IDs must be unique")
    identities.add(item.id)
  }
  const node = (item: TNativeBreadcrumbItem): TNativeBreadcrumbNode => ({ kind: "item", item })
  if (items.length <= 3 || items.length <= maxVisibleItems) return items.map(node)
  const remainingVisibleCount = maxVisibleItems - 2
  const middle = items.slice(1, -1)
  const boundary = consolidationPlacement === "right" ? remainingVisibleCount : middle.length - remainingVisibleCount
  const visible = consolidationPlacement === "right" ? middle.slice(0, boundary) : middle.slice(boundary)
  const folded = consolidationPlacement === "right" ? middle.slice(boundary) : middle.slice(0, boundary)
  const overflow: TNativeBreadcrumbNode = { kind: "overflow", items: folded }
  const start = node(items[0])
  const current = node(items[items.length - 1])
  return consolidationPlacement === "right"
    ? [start, ...visible.map(node), overflow, current]
    : [start, overflow, ...visible.map(node), current]
}
