import { forwardRef } from "react"

import { NativeTooltipSurface } from "./NativeTooltipSurface"
import type { TNativeTooltipProps, TNativeTooltipRef } from "./types"

export const Tooltip = forwardRef<TNativeTooltipRef, TNativeTooltipProps>((props, ref) => (
  <NativeTooltipSurface {...props} ref={ref} profile="tooltip" />
))
Tooltip.displayName = "Tooltip"
