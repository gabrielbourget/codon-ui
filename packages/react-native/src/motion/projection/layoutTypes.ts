import type { Box, Point } from "./types"

export type TNativeMotionLayoutProps = {
  layout?: boolean | "size" | "position" | "preserve-aspect" | "x" | "y"
  layoutId?: string
  layoutDependency?: unknown
  layoutScroll?: boolean
  layoutRoot?: boolean
  layoutAnchor?: Point | false
  layoutCrossfade?: boolean
  nativeLayoutPortal?: boolean
  onBeforeLayoutMeasure?: (layout: Box) => void
  onLayoutMeasure?: (layout: Box, previous: Box) => void
  onLayoutAnimationStart?: () => void
  onLayoutAnimationComplete?: () => void
}
