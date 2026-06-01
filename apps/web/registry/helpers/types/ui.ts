// amino-ui-helper-file-marker

import type { AVAILABLE_STROKE_LINECAPS, AVAILABLE_POPOVER_PLACEMENT_POSITIONS } from "@src/constants/ui"

export type TAvailablePopoverPlacementPositions = (typeof AVAILABLE_POPOVER_PLACEMENT_POSITIONS)[number]

export type TAvailableStrokeLinecaps = (typeof AVAILABLE_STROKE_LINECAPS)[number]

export type TIconProps = {
  size?: number
  color?: string
}
