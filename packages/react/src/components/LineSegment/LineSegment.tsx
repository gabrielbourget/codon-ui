"use client"

import { calibrateComponent, type TLineSegmentProps } from "./helpers"

export const LineSegment = (props: TLineSegmentProps) => {
  const { root } = calibrateComponent(props)

  return <div {...root.props} style={root.style} className={root.className} />
}

export {
  AVAILABLE_LINE_SEGMENT_DIRECTIONS,
  LINE_SEGMENT_DIRECTION__HORIZONTAL,
  LINE_SEGMENT_DIRECTION__VERTICAL,
  type TAvailableLineSegmentDirections,
  type TLineSegmentProps,
} from "./helpers"

export default LineSegment
