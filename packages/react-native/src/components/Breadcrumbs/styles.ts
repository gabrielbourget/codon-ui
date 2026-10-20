import type { ColorValue, TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { resolveNativeStyle, validateNativeColor } from "../colors"

import type { TNativeBreadcrumbsProps } from "./types"

const textKeys = [
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
export const splitNativeBreadcrumbStyle = (style: TextStyle) => {
  const view = { ...style },
    text: TextStyle = {}
  for (const key of textKeys) {
    if (Object.hasOwn(view, key)) Object.assign(text, { [key]: view[key] })
    delete view[key]
  }
  return { view: view as ViewStyle, text }
}
export const getNativeBreadcrumbStyles = (
  theme: TNativeTheme,
  props: TNativeBreadcrumbsProps,
  inherited: ColorValue = theme.colors.foreground,
) => {
  if (props.order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(props.order))
    throw new TypeError("Breadcrumbs: unsupported order")
  validateNativeColor(props.color, "Breadcrumbs", "color")
  const color = props.order === undefined ? (props.color ?? inherited) : theme.actions[props.order].background
  const root = {
    color,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing.unit,
    ...resolveNativeStyle(props.customStyles, "Breadcrumbs", "customStyles"),
    ...resolveNativeStyle(props.style, "Breadcrumbs", "style"),
  }
  const item = {
    color: props.order === undefined && props.color === undefined ? (root.color ?? inherited) : color,
    ...resolveNativeStyle(props.customBreadcrumbStyles, "Breadcrumbs", "customBreadcrumbStyles"),
  }
  validateNativeColor(root.color, "Breadcrumbs", "root color")
  validateNativeColor(item.color, "Breadcrumbs", "breadcrumb color")
  return {
    root: splitNativeBreadcrumbStyle(root),
    item: splitNativeBreadcrumbStyle(item),
    itemStyle: item,
    list: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.unit,
      borderRadius: theme.radius.rounded,
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
      ...resolveNativeStyle(props.customOptionsListStyles, "Breadcrumbs", "customOptionsListStyles"),
    },
  }
}
