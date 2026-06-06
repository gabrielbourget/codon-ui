export const ALIGNMENT__LEFT = "Left"
export const ALIGNMENT__CENTER = "Center"
export const ALIGNMENT__RIGHT = "Right"

export const AVAILABLE_ALIGNMENTS = [ALIGNMENT__LEFT, ALIGNMENT__CENTER, ALIGNMENT__RIGHT] as const

export type TAvailableAlignments = (typeof AVAILABLE_ALIGNMENTS)[number]
