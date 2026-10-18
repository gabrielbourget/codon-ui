import type { ImageProps, ImageStyle } from "react-native"

import { resolveNativeStyle, validateNativeColor } from "../colors"

export type TNativeThumbnailDimensions = Readonly<{ width: number; height: number }>
export const isNativeThumbnailDimensions = (value: unknown): value is TNativeThumbnailDimensions =>
  value !== null &&
  typeof value === "object" &&
  "width" in value &&
  "height" in value &&
  typeof value.width === "number" &&
  Number.isFinite(value.width) &&
  value.width > 0 &&
  typeof value.height === "number" &&
  Number.isFinite(value.height) &&
  value.height > 0

const isAutomatic = (value: unknown) => value === undefined || value === null || value === "auto"

export const getNativeThumbnailGeometry = (
  props: Pick<ImageProps, "width" | "height" | "style" | "tintColor">,
  natural?: TNativeThumbnailDimensions,
) => {
  const authored = resolveNativeStyle<ImageStyle>(props.style, "ThumbnailImage", "style")
  validateNativeColor(props.tintColor, "ThumbnailImage", "tintColor")
  validateNativeColor(authored.tintColor, "ThumbnailImage", "style.tintColor")
  validateNativeColor(authored.overlayColor, "ThumbnailImage", "style.overlayColor")
  const width = authored.width !== undefined ? authored.width : props.width
  const height = authored.height !== undefined ? authored.height : props.height
  const automaticWidth = isAutomatic(width)
  const automaticHeight = isAutomatic(height)
  if (!natural || (!automaticWidth && !automaticHeight))
    return { style: authored, needsIntrinsic: automaticWidth || automaticHeight }
  return {
    style: {
      ...authored,
      ...(automaticWidth ? { width: automaticHeight ? natural.width : undefined } : {}),
      ...(automaticHeight ? { height: undefined } : {}),
      aspectRatio: authored.aspectRatio ?? natural.width / natural.height,
    },
    needsIntrinsic: true,
  }
}

// This is only a metadata seed list; URI selection remains the pinned core Image's responsibility.
export const getNativeThumbnailMetadataCandidates = (src: string, srcSet: string) => {
  const uris = srcSet.split(", ").flatMap((entry) => {
    const [uri, scale = "1x"] = entry.split(" ")
    return uri && scale.endsWith("x") && Number.isFinite(Number.parseInt(scale, 10)) ? [uri] : []
  })
  return [...new Set([...uris, src].filter(Boolean))]
}
