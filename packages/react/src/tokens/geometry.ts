export const ORTHOGONAL = "orthogonal"
export const ROUNDED = "rounded"
export const ROUND = "round"

export const AVAILABLE_CORNER_GEOMETRY_CODES = [ORTHOGONAL, ROUNDED, ROUND] as const

export type TCornerGeometry = (typeof AVAILABLE_CORNER_GEOMETRY_CODES)[number]
