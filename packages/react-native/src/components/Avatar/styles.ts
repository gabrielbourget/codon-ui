import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension, type TNativeDisplayDimension } from "../displayDimensions"
import { getNativeControlRadius } from "../selection"

import type { TNativeAvatarLabels, TNativeAvatarProps, TNativeAvatarRenderState, TNativeAvatarRootStyle } from "./types"

export const getNativeAvatarName = (name1?: string, name2?: string, labels?: Partial<TNativeAvatarLabels>) => {
  const first = name1 || (name2 ? "" : (labels?.placeholderFirstName ?? "Name"))
  const last = name2 || (name1 ? "" : (labels?.placeholderLastName ?? "Unknown"))
  return {
    initials: first.charAt(0).toUpperCase() + last.charAt(0).toUpperCase(),
    name: name1 || name2 ? [name1, name2].filter(Boolean).join(" ") : `${first} ${last}`,
  }
}

export const getNativeAvatarStyle = (
  theme: TNativeTheme,
  props: TNativeAvatarProps,
  flags: Omit<TNativeAvatarRenderState, "foregroundColor">,
) => {
  const { size = 30, geometry = "round", raised = false, foreground, color, background, customStyles, style } = props
  const dimension = typeof size === "string" && /^\d+(?:\.\d+)?$/.test(size.trim()) ? Number(size) : size
  validateNativeDisplayDimension(dimension, "Avatar", "size")
  const nativeDimension = dimension as TNativeDisplayDimension
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry)) throw new TypeError("Avatar: unsupported geometry")
  if (props.fallbackDelay !== undefined && !Number.isFinite(props.fallbackDelay))
    throw new TypeError("Avatar: fallbackDelay must be finite")
  const foregroundColor = foreground ?? color ?? theme.colors.background
  validateNativeColor(foregroundColor, "Avatar", "foreground")
  validateNativeColor(background, "Avatar", "background")
  const baseline: TNativeAvatarRootStyle = {
    width: nativeDimension,
    height: nativeDimension,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
    borderRadius: getNativeControlRadius(theme, geometry),
    backgroundColor: background ?? theme.colors.foreground,
    color: foregroundColor,
    ...(raised
      ? {
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.24,
          shadowRadius: 3,
          elevation: 2,
        }
      : {}),
    ...resolveNativeStyle(customStyles, "Avatar", "customStyles"),
  }
  const { color: resolvedColor, ...viewStyle } = resolveNativeStyle(
    [
      baseline,
      typeof style === "function"
        ? style({ ...flags, foregroundColor: baseline.color ?? foregroundColor, defaultStyle: baseline })
        : style,
    ],
    "Avatar",
    "style",
  )
  return { viewStyle, foregroundColor: resolvedColor ?? foregroundColor }
}
