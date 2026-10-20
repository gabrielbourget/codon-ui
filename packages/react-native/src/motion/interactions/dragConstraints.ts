// Native port of Motion 12.40.0 drag constraints. See UPSTREAM.json and ../animation/LICENSE.framer-motion.md.
export type TNativeDragAxis = { min: number; max: number }
export type TNativeDragBox = { x: TNativeDragAxis; y: TNativeDragAxis }
export type TNativeDragBounds = Partial<Record<"top" | "left" | "bottom" | "right", number>>
export type TNativeDragConstraints = { x: Partial<TNativeDragAxis>; y: Partial<TNativeDragAxis> }
export type TNativeDragElastic = boolean | number | TNativeDragBounds
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress
export const nativeDragAxes = ["x", "y"] as const
export type TNativeDragDirection = (typeof nativeDragAxes)[number]
export const applyNativeDragConstraints = (
  point: number,
  { min, max }: Partial<TNativeDragAxis>,
  elastic?: TNativeDragAxis,
) => {
  if (min !== undefined && point < min) return elastic ? mix(min, point, elastic.min) : Math.max(point, min)
  if (max !== undefined && point > max) return elastic ? mix(max, point, elastic.max) : Math.min(point, max)
  return point
}
export const nativeRelativeDragConstraints = ({
  left,
  right,
  top,
  bottom,
}: TNativeDragBounds): TNativeDragConstraints => ({
  x: { min: left, max: right },
  y: { min: top, max: bottom },
})
export const nativeViewportDragConstraints = (
  layout: TNativeDragBox,
  bounds: TNativeDragBox,
): TNativeDragConstraints => {
  const resolve = (axis: TNativeDragDirection) => {
    let min = bounds[axis].min - layout[axis].min,
      max = bounds[axis].max - layout[axis].max
    if (bounds[axis].max - bounds[axis].min < layout[axis].max - layout[axis].min) [min, max] = [max, min]
    return { min, max }
  }
  return { x: resolve("x"), y: resolve("y") }
}
export const nativeDragElastic = (value: TNativeDragElastic = 0.35): TNativeDragBox => {
  const elastic = value === false ? 0 : value === true ? 0.35 : value
  const edge = (key: keyof TNativeDragBounds) => (typeof elastic === "number" ? elastic : elastic[key] || 0)
  return { x: { min: edge("left"), max: edge("right") }, y: { min: edge("top"), max: edge("bottom") } }
}
export const nativeDragOrigin = (source: TNativeDragAxis, target: TNativeDragAxis) => {
  const sourceLength = source.max - source.min,
    targetLength = target.max - target.min
  const progress = (min: number, max: number, value: number) => (max - min === 0 ? 1 : (value - min) / (max - min))
  let origin = 0.5
  if (targetLength > sourceLength) origin = progress(target.min, target.max - sourceLength, source.min)
  else if (sourceLength > targetLength) origin = progress(source.min, source.max - targetLength, target.min)
  return Math.min(1, Math.max(0, origin))
}
export const nativeDragDirection = (offset: { x: number; y: number }, threshold = 10): TNativeDragDirection | null =>
  Math.abs(offset.y) > threshold ? "y" : Math.abs(offset.x) > threshold ? "x" : null
export const shouldNativeDrag = (
  axis: TNativeDragDirection,
  drag: boolean | TNativeDragDirection | undefined,
  direction: TNativeDragDirection | null,
) => (drag === true || drag === axis) && (direction === null || direction === axis)
export const nativeDragBoundingBox = (box: TNativeDragConstraints): TNativeDragBounds => ({
  top: box.y.min,
  bottom: box.y.max,
  left: box.x.min,
  right: box.x.max,
})
