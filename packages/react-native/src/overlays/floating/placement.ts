export const NATIVE_FLOATING_PLACEMENTS = [
  "bottom",
  "bottom left",
  "bottom right",
  "bottom start",
  "bottom end",
  "top",
  "top left",
  "top right",
  "top start",
  "top end",
  "left",
  "left top",
  "left bottom",
  "start",
  "start top",
  "start bottom",
  "right",
  "right top",
  "right bottom",
  "end",
  "end top",
  "end bottom",
] as const
export type TNativeFloatingPlacement = (typeof NATIVE_FLOATING_PLACEMENTS)[number]
export type TNativeFloatingRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type TNativeFloatingPlacementInput = Readonly<{
  anchor: TNativeFloatingRect
  host: TNativeFloatingRect
  visibleBoundary?: TNativeFloatingRect
  content: Readonly<{ width: number; height: number }>
  placement?: TNativeFloatingPlacement
  direction?: "ltr" | "rtl"
  offset?: number
  crossOffset?: number
  containerPadding?: number
  shouldFlip?: boolean
  maxHeight?: number
  arrowSize?: number
  arrowBoundaryOffset?: number
}>

const bounded = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value))
const validRect = (rect: TNativeFloatingRect) =>
  [rect.x, rect.y, rect.width, rect.height, rect.x + rect.width, rect.y + rect.height].every(Number.isFinite) &&
  rect.width >= 0 &&
  rect.height >= 0

export const intersectNativeFloatingRects = (first: TNativeFloatingRect, second: TNativeFloatingRect) => {
  const x = Math.max(first.x, second.x)
  const y = Math.max(first.y, second.y)
  return {
    x,
    y,
    width: Math.max(0, Math.min(first.x + first.width, second.x + second.width) - x),
    height: Math.max(0, Math.min(first.y + first.height, second.y + second.height) - y),
  }
}

// Pure geometry only. Native host, measurement generations, focus and renderer admission are separate owners.
export const getNativeFloatingPlacement = (input: TNativeFloatingPlacementInput) => {
  const {
    anchor,
    host,
    content,
    placement = "bottom",
    direction = "ltr",
    offset = 8,
    crossOffset = 0,
    containerPadding = 12,
    shouldFlip = true,
    maxHeight,
    arrowSize = 0,
    arrowBoundaryOffset = 0,
  } = input
  if (!NATIVE_FLOATING_PLACEMENTS.includes(placement)) throw new TypeError("Floating layer: unsupported placement")
  if (
    ![offset, crossOffset, containerPadding, arrowSize, arrowBoundaryOffset].every(Number.isFinite) ||
    containerPadding < 0 ||
    arrowSize < 0 ||
    arrowBoundaryOffset < 0 ||
    (maxHeight !== undefined && (!Number.isFinite(maxHeight) || maxHeight < 0))
  )
    throw new TypeError("Floating layer: offsets and constraints must be finite, with nonnegative size constraints")
  if (
    !validRect(anchor) ||
    !validRect(host) ||
    (input.visibleBoundary && !validRect(input.visibleBoundary)) ||
    ![content.width, content.height].every(Number.isFinite) ||
    content.width < 0 ||
    content.height < 0
  )
    return null
  const boundary = input.visibleBoundary ? intersectNativeFloatingRects(host, input.visibleBoundary) : host
  const left = boundary.x + containerPadding
  const right = Math.max(left, boundary.x + boundary.width - containerPadding)
  const top = boundary.y + containerPadding
  const bottom = Math.max(top, boundary.y + boundary.height - containerPadding)
  if (![left, right, top, bottom].every(Number.isFinite)) return null
  const [requestedSide, alignment] = placement.split(" ")
  const physicalSide =
    requestedSide === "start"
      ? direction === "rtl"
        ? "right"
        : "left"
      : requestedSide === "end"
        ? direction === "rtl"
          ? "left"
          : "right"
        : requestedSide
  let side = physicalSide as "top" | "bottom" | "left" | "right"
  const room = {
    top: anchor.y - offset - top,
    bottom: bottom - anchor.y - anchor.height - offset,
    left: anchor.x - offset - left,
    right: right - anchor.x - anchor.width - offset,
  }
  if (!Object.values(room).every(Number.isFinite)) return null
  const opposite = { top: "bottom", bottom: "top", left: "right", right: "left" } as const
  const vertical = side === "top" || side === "bottom"
  const mainSize = vertical ? content.height : content.width
  if (shouldFlip && mainSize > room[side] && room[opposite[side]] > room[side]) side = opposite[side]
  const crossAlignment =
    alignment === "start"
      ? direction === "rtl"
        ? "right"
        : "left"
      : alignment === "end"
        ? direction === "rtl"
          ? "left"
          : "right"
        : alignment
  const anchorCross = vertical ? anchor.x : anchor.y
  const anchorCrossSize = vertical ? anchor.width : anchor.height
  const clampToInterval = (value: number, minimum: number, maximum: number) =>
    Math.min(Math.max(value, minimum), maximum)
  const positionForHeight = (height: number) => {
    const crossSize = vertical ? content.width : height
    const leading = vertical ? "left" : "top"
    const trailing = vertical ? "right" : "bottom"
    const preferred =
      crossAlignment === leading
        ? anchorCross
        : crossAlignment === trailing
          ? anchorCross + anchorCrossSize - crossSize
          : anchorCross + (anchorCrossSize - crossSize) / 2
    const anchored = clampToInterval(
      preferred + crossOffset,
      anchorCross - crossSize + arrowSize + arrowBoundaryOffset,
      anchorCross + anchorCrossSize - arrowSize - arrowBoundaryOffset,
    )
    const cross = bounded(anchored, vertical ? left : top, (vertical ? right : bottom) - crossSize)
    if (vertical) {
      const y =
        side === "top"
          ? host.y + host.height - Math.floor(host.height - (anchor.y - host.y) + offset) - height
          : host.y + Math.floor(anchor.y - host.y + anchor.height + offset)
      return { x: cross, y }
    }
    const x =
      side === "left"
        ? host.x + host.width - Math.floor(host.width - (anchor.x - host.x) + offset) - content.width
        : host.x + Math.floor(anchor.x - host.x + anchor.width + offset)
    return { x, y: cross }
  }
  const naturalFrame = positionForHeight(content.height)
  const growsUp = side === "top" || (!vertical && crossAlignment === "bottom")
  const availableHeight = Math.max(0, growsUp ? naturalFrame.y + content.height - top : bottom - naturalFrame.y)
  const constrainedHeight = Math.min(maxHeight ?? availableHeight, availableHeight)
  const height = Math.min(content.height, constrainedHeight)
  const width = content.width
  const { x, y } = positionForHeight(height)
  const crossPosition = vertical ? x : y
  const crossSize = vertical ? width : height
  const origin = anchorCross - crossPosition
  const anchorArrowCenter = clampToInterval(
    origin + anchorCrossSize / 2,
    origin + arrowSize / 2,
    origin + anchorCrossSize - arrowSize / 2,
  )
  const arrowCenter = clampToInterval(
    anchorArrowCenter,
    arrowSize / 2 + arrowBoundaryOffset,
    crossSize - arrowSize / 2 - arrowBoundaryOffset,
  )
  const crossOrigin = arrowSize
    ? arrowCenter
    : crossAlignment === "right"
      ? origin + anchorCrossSize
      : crossAlignment === undefined
        ? origin + anchorCrossSize / 2
        : origin
  const mainOrigin = side === "top" || side === "left" ? (vertical ? height : width) : 0
  return {
    placement: side,
    didFlip: side !== physicalSide,
    frame: { x, y, width, height },
    hostFrame: { x: x - host.x, y: y - host.y, width, height },
    maxHeight: constrainedHeight,
    availableMainSpace: Math.max(0, room[side]),
    arrowCrossOffset: arrowCenter - arrowSize / 2,
    arrowSide: opposite[side],
    anchorPoint: { x: vertical ? crossOrigin : mainOrigin, y: vertical ? mainOrigin : crossOrigin },
  }
}
