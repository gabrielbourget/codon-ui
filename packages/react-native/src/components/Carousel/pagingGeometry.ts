import type { LayoutRectangle } from "react-native"

export type TNativeCarouselPagingGeometry = Readonly<{
  itemOffsets: readonly number[]
  snapOffsets: readonly number[]
  maximumOffset: number
}>

export const measureNativeCarouselPages = ({
  items,
  viewport,
  container,
  content,
  axis,
  align,
  isRTL,
}: {
  items: readonly LayoutRectangle[]
  viewport: LayoutRectangle
  container: LayoutRectangle
  content: Readonly<{ width: number; height: number }>
  axis: "x" | "y"
  align: "start" | "center" | "end"
  isRTL: boolean
}): TNativeCarouselPagingGeometry | null => {
  const horizontal = axis === "x"
  const extent = horizontal ? viewport.width : viewport.height
  const contentExtent = horizontal ? content.width : content.height
  if (!Number.isFinite(extent) || extent <= 0 || !Number.isFinite(contentExtent) || contentExtent <= 0) return null
  const maximumOffset = Math.max(0, contentExtent - extent)
  const origin = horizontal ? container.x : container.y
  if (!Number.isFinite(origin)) return null
  const itemOffsets: number[] = []
  for (const item of items) {
    const start = origin + (horizontal ? item.x : item.y)
    const size = horizontal ? item.width : item.height
    if (!Number.isFinite(start) || !Number.isFinite(size) || size < 0) return null
    const factor = align === "center" ? 0.5 : (align === "end") !== (horizontal && isRTL) ? 1 : 0
    itemOffsets.push(Math.max(0, Math.min(maximumOffset, start + (size - extent) * factor)))
  }
  return { itemOffsets, snapOffsets: [...new Set(itemOffsets)].sort((left, right) => left - right), maximumOffset }
}

export const nativeCarouselIndex = (index: number, count: number) =>
  Math.max(0, Math.min(Math.max(0, count - 1), Number.isFinite(index) ? Math.trunc(index) : 0))

export const nearestNativeCarouselPage = (
  geometry: TNativeCarouselPagingGeometry,
  offset: number,
  preferredIndex: number,
) => {
  let nearest = nativeCarouselIndex(preferredIndex, geometry.itemOffsets.length)
  let distance = Math.abs((geometry.itemOffsets[nearest] ?? 0) - offset)
  geometry.itemOffsets.forEach((candidate, index) => {
    const nextDistance = Math.abs(candidate - offset)
    if (nextDistance < distance - 0.5) {
      nearest = index
      distance = nextDistance
    }
  })
  return nearest
}
