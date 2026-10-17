import type { ViewStyle } from "react-native"

import { resolveNativeStyle } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import {
  AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES,
  DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT,
  type TNativeThumbnailShowcaseProps,
} from "./types"

export const normalizeNativeThumbnailSlotCount = (value = DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT) =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : DEFAULT_THUMBNAIL_SHOWCASE_SECONDARY_SLOT_COUNT

export const getNativeThumbnailShowcaseStyles = (props: TNativeThumbnailShowcaseProps) => {
  validateNativeDisplayDimension(props.width, "ThumbnailShowcase", "width")
  if (props.renderingMode !== undefined && !AVAILABLE_THUMBNAIL_SHOWCASE_RENDERING_MODES.includes(props.renderingMode))
    throw new TypeError("ThumbnailShowcase: unsupported renderingMode")
  const count = normalizeNativeThumbnailSlotCount(props.secondarySlotCount)
  const columns = props.secondaryColumnCount ?? Math.max(count, 1)
  if (!Number.isInteger(columns) || columns <= 0)
    throw new TypeError("ThumbnailShowcase: secondaryColumnCount must be a positive integer")
  const slot: ViewStyle = { width: "100%", aspectRatio: 1, minWidth: 0, overflow: "hidden", position: "relative" }
  return {
    count,
    columns,
    root: resolveNativeStyle<ViewStyle>(
      [{ flexDirection: "column", gap: 10, width: props.width ?? "100%" }, props.style],
      "ThumbnailShowcase",
      "style",
    ),
    primary: resolveNativeStyle<ViewStyle>([slot, props.primarySlotStyle], "ThumbnailShowcase", "primarySlotStyle"),
    row: resolveNativeStyle<ViewStyle>(
      [{ width: "100%" }, props.secondaryRowStyle],
      "ThumbnailShowcase",
      "secondaryRowStyle",
    ),
    secondary: resolveNativeStyle<ViewStyle>(
      [slot, props.secondarySlotStyle],
      "ThumbnailShowcase",
      "secondarySlotStyle",
    ),
  }
}

export const resolveNativeThumbnailGap = (value: number | string) => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  if (
    typeof value === "string" &&
    /^(?:\d+(?:\.\d*)?|\.\d+)%$/.test(value) &&
    Number.isFinite(Number.parseFloat(value))
  )
    return value
  throw new TypeError("ThumbnailShowcase: gaps must be finite nonnegative native numbers or percentages")
}
