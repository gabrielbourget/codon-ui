export const NATIVE_PAGINATION_CONSOLIDATION_SIDES = ["left", "right"] as const
export type TNativePaginationConsolidationSide = (typeof NATIVE_PAGINATION_CONSOLIDATION_SIDES)[number]
export const NATIVE_PAGINATION_SUBCOMPONENTS = [
  "page-counter",
  "page-input",
  "items-per-page",
  "primary-controls",
] as const
export type TNativePaginationSubcomponent = (typeof NATIVE_PAGINATION_SUBCOMPONENTS)[number]
export type TNativePaginationWindowItem = number | readonly number[]
export type TNativePaginationNumbers = Readonly<{ currentPage: number; itemsPerPage: number; numberOfItems: number }>
type TWindowProps = TNativePaginationNumbers & {
  maxVisiblePages?: number
  consolidationPlacement?: TNativePaginationConsolidationSide
  rtl?: boolean
}

const integer = (value: number, minimum: number, name: string) => {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new TypeError(`Pagination: ${name} must be a safe integer >= ${minimum}`)
}
export const getNativePaginationPageCount = (props: TNativePaginationNumbers) => {
  integer(props.currentPage, 1, "currentPage")
  integer(props.itemsPerPage, 1, "itemsPerPage")
  integer(props.numberOfItems, 0, "numberOfItems")
  return Math.max(1, Math.ceil(props.numberOfItems / props.itemsPerPage))
}

export const getNativePaginationWindow = (props: TWindowProps): readonly TNativePaginationWindowItem[] => {
  const count = getNativePaginationPageCount(props)
  const { maxVisiblePages: maximum = 10, consolidationPlacement: side = "left", rtl = false } = props
  if (!Number.isInteger(maximum) || maximum < 3 || maximum > 20)
    throw new TypeError("Pagination: maxVisiblePages must be an integer from 3 to 20")
  if (!NATIVE_PAGINATION_CONSOLIDATION_SIDES.includes(side))
    throw new TypeError("Pagination: unsupported consolidationPlacement")
  const pages = Array.from({ length: count }, (_, index) => (rtl ? count - index : index + 1))
  if (count <= maximum || count <= 3) return pages
  const current = Math.min(props.currentPage, count)
  const index = pages.indexOf(current)
  const middle = pages.slice(1, -1)
  const first = pages[0],
    last = pages[pages.length - 1]
  if (index === 0 || index === count - 1) {
    const slots = maximum - 2
    const visible = side === "right" ? middle.slice(0, slots) : middle.slice(-slots)
    let collapsed = side === "right" ? middle.slice(slots) : middle.slice(0, -slots)
    if (rtl) collapsed = collapsed.reverse()
    return side === "left" ? [first, collapsed, ...visible, last] : [first, ...visible, collapsed, last]
  }
  const before = middle.slice(0, index - 1)
  const after = middle.slice(index)
  const slots = maximum - 3
  const beforeCount =
    side === "right" ? Math.min(before.length, slots) : Math.min(before.length, slots - Math.min(after.length, slots))
  const afterCount = Math.min(after.length, slots - beforeCount)
  const result: TNativePaginationWindowItem[] = [first]
  const collapsedBefore = before.slice(0, before.length - beforeCount)
  if (collapsedBefore.length) result.push(collapsedBefore)
  result.push(...before.slice(before.length - beforeCount), current, ...after.slice(0, afterCount))
  const collapsedAfter = after.slice(afterCount)
  if (collapsedAfter.length) result.push(collapsedAfter)
  result.push(last)
  return result
}

export const getNativePaginationPageForSize = (props: TNativePaginationNumbers, nextSize: number) => {
  getNativePaginationPageCount(props)
  integer(nextSize, 1, "requested itemsPerPage")
  const count = Math.max(1, Math.ceil(props.numberOfItems / nextSize))
  const firstItem = Math.min((props.currentPage - 1) * props.itemsPerPage, Math.max(0, props.numberOfItems - 1))
  return Math.min(count, Math.floor(firstItem / nextSize) + 1)
}

export const getNativePaginationGroups = (chosen?: readonly TNativePaginationSubcomponent[]) => {
  const groups = chosen?.length ? [...new Set(chosen)] : ["primary-controls" as const]
  if (groups.some((group) => !NATIVE_PAGINATION_SUBCOMPONENTS.includes(group)))
    throw new TypeError("Pagination: unsupported subcomponent")
  return groups
}
