export const VIEWBOX_CENTER_X = 50
export const VIEWBOX_CENTER_Y = 50

export const STROKE_LINECAP__BUTT = "butt"
export const STROKE_LINECAP__ROUND = "round"
export const STROKE_LINECAP__SQUARE = "square"

export const AVAILABLE_STROKE_LINECAPS = [STROKE_LINECAP__BUTT, STROKE_LINECAP__ROUND, STROKE_LINECAP__SQUARE] as const

export type TAvailableStrokeLinecaps = (typeof AVAILABLE_STROKE_LINECAPS)[number]
