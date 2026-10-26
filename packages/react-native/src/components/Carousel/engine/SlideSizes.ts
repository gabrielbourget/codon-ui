import type { AxisType } from "./Axis"
import type { TNativeCarouselNode } from "./nativeEnvironment"
import type { NodeRectType } from "./NodeRects"
import { arrayIsLastIndex, arrayLast, mathAbs, type WindowType } from "./utils"

export type SlideSizesType = { slideSizes: number[]; slideSizesWithGaps: number[]; startGap: number; endGap: number }
export const SlideSizes = (
  axis: AxisType,
  container: NodeRectType,
  rects: NodeRectType[],
  slides: TNativeCarouselNode[],
  readEdgeGap: boolean,
  window: WindowType,
): SlideSizesType => {
  const withGap = !!rects[0] && readEdgeGap
  const startGap = withGap ? mathAbs(container[axis.startEdge] - rects[0][axis.startEdge]) : 0
  const endGap = withGap ? window.environment.margin(arrayLast(slides), axis.endEdge) : 0
  const slideSizes = rects.map(axis.measureSize)
  const slideSizesWithGaps = rects
    .map((rect, index) => {
      if (!index) return slideSizes[index] + startGap
      if (arrayIsLastIndex(rects, index)) return slideSizes[index] + endGap
      return rects[index + 1][axis.startEdge] - rect[axis.startEdge]
    })
    .map(mathAbs)
  return { slideSizes, slideSizesWithGaps, startGap, endGap }
}
