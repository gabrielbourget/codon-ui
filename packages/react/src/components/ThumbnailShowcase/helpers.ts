import type { ComponentPropsWithoutRef, CSSProperties, Key, ReactNode } from "react"

export const THUMBNAIL_SHOWCASE_RENDERING_MODE__ALL = "all"
export const THUMBNAIL_SHOWCASE_RENDERING_MODE__PRIMARY = "primary"
export const THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY = "secondary"
export const AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES = [
  THUMBNAIL_SHOWCASE_RENDERING_MODE__ALL,
  THUMBNAIL_SHOWCASE_RENDERING_MODE__PRIMARY,
  THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY,
] as const
export const DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT = 4

export type TThumbnailShowcaseRenderingMode = (typeof AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES)[number]

export type TThumbnailShowcaseSecondaryItem = {
  content: ReactNode
  id: Key
}

export type TThumbnailShowcaseRenderSecondaryPlaceholderArgs = {
  index: number
}

export type TThumbnailShowcaseRenderOverflowArgs = {
  hiddenItemCount: number
}

type TThumbnailShowcaseNativeProps = Omit<ComponentPropsWithoutRef<"div">, "children" | "className" | "style">

export type TThumbnailShowcaseCSSProperties = CSSProperties & {
  "--thumbnail-showcase-secondary-slot-count"?: number
  "--thumbnail-showcase-width"?: string
}

export type TThumbnailShowcaseProps = TThumbnailShowcaseNativeProps & {
  className?: string
  primaryContent?: ReactNode
  primaryPlaceholder: ReactNode
  primarySlotClassName?: string
  primarySlotStyle?: CSSProperties
  renderingMode?: TThumbnailShowcaseRenderingMode
  renderOverflow?: (args: TThumbnailShowcaseRenderOverflowArgs) => ReactNode
  renderSecondaryPlaceholder?: (args: TThumbnailShowcaseRenderSecondaryPlaceholderArgs) => ReactNode
  secondaryItems?: readonly TThumbnailShowcaseSecondaryItem[]
  secondaryRowClassName?: string
  secondaryRowStyle?: CSSProperties
  secondarySlotClassName?: string
  secondarySlotCount?: number
  secondarySlotStyle?: CSSProperties
  style?: CSSProperties
  width?: number | string
}

export const normalizeThumbnailShowcaseDimension = (value: number | string | undefined) => {
  if (typeof value === "number") return `${value}px`
  return value
}

export const normalizeThumbnailShowcaseSecondarySlotCount = (value: number) => {
  if (!Number.isFinite(value)) return DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT
  return Math.max(Math.floor(value), 0)
}
