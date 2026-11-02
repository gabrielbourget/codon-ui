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

export const getNativePanelOverlayLayout = (styles: ReturnType<typeof getNativePanelStyles>) => {
  const overlay = styles.overlay
  const contents = overlay.display === "contents"
  const host = Object.fromEntries(
    Object.entries(overlay).filter(
      ([key]) => isGeometryField(key) || isBorderGeometry(key) || (COMPOSITE_FIELDS.has(key) && key !== "opacity"),
    ),
  ) as ViewStyle
  host.overflow = overlay.overflow
  // Native borders participate in layout; their ink stays on the original paint plane.
  host.borderColor = "transparent"
  const paintPlane = Object.fromEntries(
    Object.entries(overlay).flatMap(([key, value]) =>
      /^border.*Width$/.test(key) && typeof value === "number"
        ? [[key.replace(/^border/, "margin").replace(/Width$/, ""), -value]]
        : [],
    ),
  ) as ViewStyle
  if (contents) {
    host.transform = undefined
    host.filter = undefined
    host.mixBlendMode = undefined
    host.isolation = undefined
    host.elevation = undefined
    paintPlane.display = "none"
  }
  return {
    host,
    paint: Object.fromEntries(
      Object.entries(overlay).filter(([key]) => !isGeometryField(key) && !COMPOSITE_FIELDS.has(key)),
    ) as ViewStyle,
    paintPlane,
    opacity: contents ? 1 : (overlay.opacity ?? 1),
  }
}
