import type { TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import { AVAILABLE_PANEL_POSITIONS, type TNativePanelProps } from "./types"

const TEXT_FIELDS = [
  "color",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "fontVariant",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textAlignVertical",
  "verticalAlign",
  "includeFontPadding",
  "textDecorationLine",
  "textDecorationStyle",
  "textDecorationColor",
  "textShadowColor",
  "textShadowOffset",
  "textShadowRadius",
  "textTransform",
  "writingDirection",
  "userSelect",
] as const

export const getNativePanelStyles = (props: TNativePanelProps, theme: TNativeTheme, viewportWidth: number) => {
  validateNativeDisplayDimension(props.width, "Panel", "width")
  validateNativeDisplayDimension(props.height, "Panel", "height")
  validateNativeColor(props.backgroundColor, "Panel", "backgroundColor")
  if (props.position !== undefined && !AVAILABLE_PANEL_POSITIONS.includes(props.position))
    throw new TypeError("Panel: unsupported position")
  if (props.panelGeometry !== undefined && !AVAILABLE_CORNER_GEOMETRY_CODES.includes(props.panelGeometry))
    throw new TypeError("Panel: unsupported geometry")
  if (props.horizontalGap !== undefined && !Number.isFinite(props.horizontalGap))
    throw new TypeError("Panel: horizontalGap must be finite")
  for (const [name, value] of [
    ["isOpen", props.isOpen],
    ["isDismissable", props.isDismissable],
    ["isKeyboardDismissDisabled", props.isKeyboardDismissDisabled],
    ["raised", props.raised],
    ["overlayBlur", props.overlayBlur],
  ] as const)
    if (value !== undefined && typeof value !== "boolean") throw new TypeError(`Panel: ${name} must be boolean`)
  const side = props.position ?? "left"
  const inline = resolveNativeStyle(
    [
      { width: props.width, height: props.height, backgroundColor: props.backgroundColor, [side]: props.horizontalGap },
      props.customStyles,
      props.style,
    ],
    "Panel",
    "style",
  )
  const authored = Object.fromEntries(Object.entries(inline).filter(([, value]) => value !== undefined))
  const style = resolveNativeStyle<TextStyle>(
    [
      {
        position: "absolute",
        top: 0,
        [side]: 0,
        height: "100%",
        width: viewportWidth < 500 ? viewportWidth * 0.8 : 300,
        flexDirection: "column",
        backgroundColor: theme.colors.background,
        color: theme.colors.foreground,
        borderRadius:
          props.panelGeometry === "round"
            ? theme.radius.round
            : props.panelGeometry === "rounded"
              ? theme.radius.rounded
              : 0,
        ...(props.raised
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
      },
      authored,
    ],
    "Panel",
    "resolvedStyle",
  )
  const text = Object.fromEntries(
    Object.entries(style).filter(([key]) => TEXT_FIELDS.some((field) => field === key)),
  ) as TextStyle
  const view = Object.fromEntries(
    Object.entries(style).filter(([key]) => !TEXT_FIELDS.some((field) => field === key)),
  ) as ViewStyle
  const overlay = resolveNativeStyle(
    [{ backgroundColor: theme.colors.overlayBackdrop }, props.customOverlayStyles],
    "Panel",
    "customOverlayStyles",
  )
  return { text, view, overlay, side }
}
