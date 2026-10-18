import { forwardRef } from "react"

import { NativeTooltipSurface } from "../Tooltip/NativeTooltipSurface"
import type { TNativeHoverPopoverProps, TNativeHoverPopoverRef } from "../Tooltip/types"

export const HoverPopover = forwardRef<TNativeHoverPopoverRef, TNativeHoverPopoverProps>((props, ref) => (
  <NativeTooltipSurface {...props} ref={ref} profile="hover-popover" />
))
HoverPopover.displayName = "HoverPopover"
