import type { ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { getNativeControlRadius } from "../selection"

import type { TNativeSliderProps } from "./types"

const PAINT = /^(?:backgroundColor|border.*|boxShadow|shadow.*|elevation|outline.*|filter|backfaceVisibility)$/
const PLACEMENT =
  /^(?:position|top|left|right|bottom|start|end|inset.*|margin.*|transform.*|translate.*|rotate|scale.*|flex.*|alignSelf|zIndex|opacity|display|overflow)$/
export const getSliderThumbStyles = (
  theme: TNativeTheme,
  props: TNativeSliderProps,
  dragging: boolean,
  focused: boolean,
  target: number,
  size: { width: number; height: number },
) => {
  validateNativeColor(props.thumbColor, "Slider", "thumbColor")
  const custom = resolveNativeStyle(props.customThumbStyles, "Slider", "customThumbStyles")
  const layout = Object.fromEntries(
    Object.entries(custom).filter(([key]) => !PAINT.test(key) && !/^padding/.test(key)),
  ) as ViewStyle
  const paint = Object.fromEntries(Object.entries(custom).filter(([key]) => !PLACEMENT.test(key))) as ViewStyle
  if (custom.width !== undefined) paint.width = "100%"
  if (custom.height !== undefined) paint.height = "100%"
  const action = props.order ? theme.actions[props.order] : undefined
  const color =
    props.thumbColor ??
    (dragging
      ? (action?.hoverBackground ?? (theme.mode === "dark" ? "#9e9e9e" : "#474747"))
      : (action?.background ?? theme.colors.controlForeground))
  return {
    layout: {
      width: Math.max(target, size.width),
      height: Math.max(target, size.height),
      cursor: "pointer",
      borderRadius: getNativeControlRadius(theme, props.geometry ?? "round"),
      alignItems: "center",
      justifyContent: "center",
      ...layout,
      ...(focused && props.enableFocusStyle !== false
        ? {
            outlineWidth: 2,
            outlineColor: theme.colors.focusRing,
            outlineOffset: props.offsetFocusRing === false ? 0 : 3.5,
          }
        : {}),
    } as ViewStyle,
    paint: resolveNativeStyle(
      [
        {
          minHeight: 18,
          height: custom.width === undefined && custom.height === undefined ? 18 : undefined,
          aspectRatio: 1,
          backgroundColor: color,
          borderRadius: getNativeControlRadius(theme, props.geometry ?? "round"),
          ...(props.raised !== false
            ? {
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.24,
                shadowRadius: 3,
                elevation: 2,
              }
            : {}),
        },
        paint,
      ],
      "Slider",
      "thumbPaint",
    ),
  }
}
