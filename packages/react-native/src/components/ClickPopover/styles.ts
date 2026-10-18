import { getNativeFloatingSurfaceStyles } from "../../overlays/floating/styles"
import type { TNativeTheme } from "../../theme/types"

import type { TNativeClickPopoverProps } from "./types"

export const getNativeClickPopoverStyles = (
  theme: TNativeTheme,
  props: TNativeClickPopoverProps,
  side: "top" | "bottom" | "left" | "right",
  direction: "ltr" | "rtl",
  hostWidth: number,
) => getNativeFloatingSurfaceStyles(theme, props, side, direction, hostWidth, "click-popover")
