import type { ViewStyle } from "react-native"

import type { getNativePanelStyles } from "./styles"

const isGeometryField = (key: string) =>
  /^(position|top|right|bottom|left|start|end|inset.*|display|width|height|minWidth|maxWidth|minHeight|maxHeight|aspectRatio|boxSizing|direction|align.*|justifyContent|flex.*|gap|rowGap|columnGap|margin.*|padding.*)$/.test(
    key,
  )
const COMPOSITE_FIELDS = new Set([
  "opacity",
  "transform",
  "transformOrigin",
  "filter",
  "mixBlendMode",
  "isolation",
  "zIndex",
  "backfaceVisibility",
  "elevation",
  "pointerEvents",
])
const isBorderGeometry = (key: string) => /^border.*(Width|Radius)$/.test(key) || key === "borderCurve"

export const getNativePanelOverlayLayout = (
  styles: ReturnType<typeof getNativePanelStyles>,
  appearance: ViewStyle,
  blur: boolean,
) => {
  const overlay = styles.overlay
  const contents = overlay.display === "contents"
  const transformed =
    typeof overlay.transform === "string"
      ? overlay.transform.trim() !== "none" && overlay.transform.trim() !== ""
      : (overlay.transform?.length ?? 0) > 0
  const filtered =
    typeof overlay.filter === "string"
      ? overlay.filter.trim() !== "none" && overlay.filter.trim() !== ""
      : (overlay.filter?.length ?? 0) > 0
  const establishesContainingBlock = !contents && (blur || transformed || filtered)
  const host = Object.fromEntries(
    Object.entries(overlay).filter(
      ([key]) => isGeometryField(key) || isBorderGeometry(key) || (COMPOSITE_FIELDS.has(key) && key !== "opacity"),
    ),
  ) as ViewStyle
  const paint = Object.fromEntries(
    Object.entries(overlay).filter(([key]) => !isGeometryField(key) && !COMPOSITE_FIELDS.has(key)),
  ) as ViewStyle
  if (styles.layout.position === "fixed" && !establishesContainingBlock) host.overflow = "visible"
  else host.overflow = overlay.overflow
  // Widths participate in native layout; the original backdrop remains their sole paint owner.
  host.borderColor = "transparent"
  if (contents) {
    host.transform = undefined
    host.filter = undefined
    host.mixBlendMode = undefined
    host.isolation = undefined
    host.elevation = undefined
  }
  return {
    host,
    paint,
    opacity: contents ? 1 : (overlay.opacity ?? 1),
    panelPosition: styles.layout.position,
    panelViewportHeight: styles.layout.viewportHeight && appearance.height === "100%",
    panelViewportWidth: styles.layout.viewportWidth && appearance.width === styles.view.width,
    establishesContainingBlock,
  }
}
