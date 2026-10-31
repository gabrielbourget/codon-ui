import type { TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { validateNativeDisplayDimension } from "../displayDimensions"

import type { TNativeCardProps } from "./types"

export const getNativeCardStyle = (
  props: Pick<TNativeCardProps, "width" | "height" | "borderRadius" | "raised" | "layoutMode">,
  theme: TNativeTheme,
): TextStyle => {
  const { width = "auto", height = "auto", borderRadius = 10, raised = true } = props
  validateNativeDisplayDimension(width, "Card", "width")
  validateNativeDisplayDimension(height, "Card", "height")
  if (
    !(
      (typeof borderRadius === "number" && Number.isFinite(borderRadius) && borderRadius >= 0) ||
      (typeof borderRadius === "string" &&
        /^(?:\d+(?:\.\d*)?|\.\d+)%$/.test(borderRadius) &&
        Number.isFinite(Number(borderRadius.slice(0, -1))))
    )
  )
    throw new TypeError("Card: borderRadius must be a finite nonnegative native radius or percentage")
  if (typeof raised !== "boolean") throw new TypeError("Card: raised must be boolean")
  if (props.layoutMode !== undefined && props.layoutMode !== "size" && props.layoutMode !== "position")
    throw new TypeError("Card: unsupported layoutMode")
  return {
    flexDirection: "column",
    justifyContent: "flex-start",
    width,
    height,
    gap: theme.spacing.unit * 3,
    padding: theme.spacing.unit * 3,
    borderRadius,
    ...(raised
      ? {
          boxShadow: [
            {
              offsetX: 0,
              offsetY: 2,
              blurRadius: 3,
              color: theme.mode === "dark" ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.12)",
            },
            {
              offsetX: 0,
              offsetY: 2,
              blurRadius: 2,
              color: theme.mode === "dark" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.24)",
            },
          ],
        }
      : {}),
  }
}
