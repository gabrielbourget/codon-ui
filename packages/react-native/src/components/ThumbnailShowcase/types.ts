import type { Key, ReactNode } from "react"
import type { StyleProp, ViewProps, ViewStyle } from "react-native"

import type { TNativeDisplayDimension } from "../displayDimensions"

export const THUMBNAIL_SHOWCASE_RENDERING_MODE__ALL = "all"
export const THUMBNAIL_SHOWCASE_RENDERING_MODE__PRIMARY = "primary"
export const THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY = "secondary"
export const AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES = [
  THUMBNAIL_SHOWCASE_RENDERING_MODE__ALL,
  THUMBNAIL_SHOWCASE_RENDERING_MODE__PRIMARY,
  THUMBNAIL_SHOWCASE_RENDERING_MODE__SECONDARY,
] as const
export const DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT = 4
export type TNativeThumbnailShowcaseRenderingMode = (typeof AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES)[number]
export type TNativeThumbnailShowcaseSecondaryItem = { content: ReactNode; id: Key }
export type TNativeThumbnailShowcaseRenderSecondaryPlaceholderArgs = { index: number }
export type TNativeThumbnailShowcaseRenderOverflowArgs = { hiddenItemCount: number }
/**
 * Equal or wrapped native columns with independent root, primary, row and slot styles.
 * Native View positioning and constraints retain their native rules; browser grid placement is not implemented.
 * Content, actions and refs remain caller-owned.
 */
export type TNativeThumbnailShowcaseProps = Omit<ViewProps, "children" | "style"> & {
  primaryContent?: ReactNode
  primaryPlaceholder: ReactNode
  primarySlotStyle?: StyleProp<ViewStyle>
  renderingMode?: TNativeThumbnailShowcaseRenderingMode
  renderOverflow?: (args: TNativeThumbnailShowcaseRenderOverflowArgs) => ReactNode
  renderSecondaryPlaceholder?: (args: TNativeThumbnailShowcaseRenderSecondaryPlaceholderArgs) => ReactNode
  secondaryItems?: readonly TNativeThumbnailShowcaseSecondaryItem[]
  secondaryRowStyle?: StyleProp<ViewStyle>
  secondarySlotCount?: number
  secondaryColumnCount?: number
  secondarySlotStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  width?: TNativeDisplayDimension
  "data-testid"?: string
  children?: never
}
