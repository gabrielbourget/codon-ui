export const SCREEN_WIDTH__375 = 375
export const SCREEN_WIDTH__450 = 450
export const SCREEN_WIDTH__500 = 500
export const SCREEN_WIDTH__550 = 550
export const SCREEN_WIDTH__600 = 600
export const SCREEN_WIDTH__650 = 650
export const SCREEN_WIDTH__750 = 750
export const SCREEN_WIDTH__850 = 850
export const SCREEN_WIDTH__1300 = 1300

export const BREAK_POINT__MOBILE = 550
export const BREAK_POINT__TABLET = 850

export const SCREEN_SIZE__SMALL = "small"
export const SCREEN_SIZE__MEDIUM = "medium"
export const SCREEN_SIZE__LARGE = "large"
export const AVAILABLE_SCREEN_SIZE_TYPES = [SCREEN_SIZE__SMALL, SCREEN_SIZE__MEDIUM, SCREEN_SIZE__LARGE] as const

export const SCREEN_ORIENTATION__PORTRAIT = "portrait"
export const SCREEN_ORIENTATION__LANDSCAPE = "landscape"
export const AVAILABLE_SCREEN_ORIENTATIONS = [SCREEN_ORIENTATION__PORTRAIT, SCREEN_ORIENTATION__LANDSCAPE] as const

export type TScreenSizeType = (typeof AVAILABLE_SCREEN_SIZE_TYPES)[number]
export type TScreenOrientation = (typeof AVAILABLE_SCREEN_ORIENTATIONS)[number]
export type TAspectRatio = `${number} / ${number}` | "auto" | "inherit" | "initial" | "unset"
