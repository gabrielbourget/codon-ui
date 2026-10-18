import type { TextStyle, ViewStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_THEMING_ORDER_CODES } from "../../tokens/theme-order"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import type { TNativeClickPopoverProps } from "./types"

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
const PAINT_FIELDS = [
  "fill",
  "fillOpacity",
  "fillRule",
  "stroke",
  "strokeWidth",
  "strokeOpacity",
  "strokeLinecap",
  "strokeLinejoin",
  "strokeMiterlimit",
  "strokeDasharray",
  "strokeDashoffset",
] as const
const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T
const textAndView = (style: TextStyle) => {
  const text: TextStyle = {}
  const view = { ...style }
  for (const field of TEXT_FIELDS) {
    if (style[field] !== undefined) Object.assign(text, { [field]: style[field] })
    delete view[field]
  }
  return { text, view: view as ViewStyle }
}
const marginKeys = (side: "top" | "bottom" | "left" | "right", rtl: boolean) => {
  if (side === "top") return ["marginTop", "marginBlockStart", "marginVertical", "marginBlock", "margin"] as const
  if (side === "bottom") return ["marginBottom", "marginBlockEnd", "marginVertical", "marginBlock", "margin"] as const
  const start = side === (rtl ? "right" : "left")
  return start
    ? ([
        "marginStart",
        "marginInlineStart",
        side === "left" ? "marginLeft" : "marginRight",
        "marginHorizontal",
        "marginInline",
        "margin",
      ] as const)
    : ([
        "marginEnd",
        "marginInlineEnd",
        side === "left" ? "marginLeft" : "marginRight",
        "marginHorizontal",
        "marginInline",
        "margin",
      ] as const)
}
const resolveMargin = (
  style: TextStyle,
  side: "top" | "bottom" | "left" | "right",
  rtl: boolean,
  hostWidth: number,
) => {
  const value = marginKeys(side, rtl)
    .map((key) => style[key])
    .find((value) => value !== undefined)
  if (value === undefined || value === "auto") return 0
  const numeric =
    typeof value === "string" && value.endsWith("%") ? (Number(value.slice(0, -1)) * hostWidth) / 100 : value
  if (typeof numeric !== "number" || !Number.isFinite(numeric))
    throw new TypeError("ClickPopover: margin must be a finite native dimension")
  // The canonical calculator reads computed CSS margins with parseInt; authored native style stays intact.
  return Math.trunc(numeric)
}

export const getNativeClickPopoverStyles = (
  theme: TNativeTheme,
  props: TNativeClickPopoverProps,
  side: "top" | "bottom" | "left" | "right",
  direction: "ltr" | "rtl",
  hostWidth: number,
) => {
  validateNativeDisplayDimension(props.width, "ClickPopover", "width")
  validateNativeDisplayDimension(props.height, "ClickPopover", "height")
  validateNativeColor(props.color, "ClickPopover", "color")
  if (props.order !== undefined && !AVAILABLE_THEMING_ORDER_CODES.includes(props.order))
    throw new TypeError("ClickPopover: unsupported order")
  if (props.geometry !== undefined && props.geometry !== "rounded" && props.geometry !== "orthogonal")
    throw new TypeError("ClickPopover: unsupported geometry")
  const colors = {
    primary: theme.colors.controlSelectedBackground,
    secondary: theme.colors.controlPressedBackground,
    tertiary: theme.colors.statusSuccess,
    quaternary: theme.colors.statusWarning,
    quintenary: theme.colors.statusDanger,
  }
  const surface = !props.color && props.order ? colors[props.order] : theme.colors.background
  const inline = withoutUndefined(
    resolveNativeStyle(
      [{ color: props.color, width: props.width, height: props.height }, props.customStyles, props.style],
      "ClickPopover",
      "style",
    ),
  )
  const rtl = direction === "rtl"
  const marginSide = side === "bottom" ? "top" : side === "top" ? "bottom" : side === "right" ? "left" : "right"
  const defaultMargin = marginKeys(marginSide, rtl).some((key) => inline[key] !== undefined)
    ? {}
    : { [`margin${marginSide[0].toUpperCase()}${marginSide.slice(1)}`]: theme.spacing.unit * 2 }
  const root = resolveNativeStyle(
    [
      {
        position: "absolute",
        padding: theme.spacing.unit * 2,
        color: theme.colors.foreground,
        backgroundColor: surface,
        borderRadius: props.geometry === "orthogonal" ? 0 : theme.radius.rounded,
        ...defaultMargin,
        ...(props.raised === false
          ? {}
          : {
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
            }),
      },
      inline,
    ],
    "ClickPopover",
    "resolvedStyle",
  )
  const dialog = resolveNativeStyle(
    [
      { flexDirection: "column", flexShrink: 0, gap: theme.spacing.unit * 3, borderRadius: 0.5 },
      withoutUndefined(resolveNativeStyle(props.customDialogStyles, "ClickPopover", "customDialogStyles")),
    ],
    "ClickPopover",
    "dialogStyle",
  )
  const arrow = withoutUndefined(
    resolveNativeStyle(
      [{ color: props.color }, props.customOverlayArrowStyles],
      "ClickPopover",
      "customOverlayArrowStyles",
    ),
  )
  const paint: Record<string, unknown> = { fill: surface }
  const arrowView: Record<string, unknown> = { ...arrow }
  for (const field of PAINT_FIELDS) {
    if (arrow[field] !== undefined) paint[field] = arrow[field]
    delete arrowView[field]
  }
  for (const field of ["fill", "stroke"] as const) {
    const value = paint[field]
    if (value !== "none" && value !== "currentColor" && value !== "context-fill" && value !== "context-stroke")
      validateNativeColor(value, "ClickPopover", `arrow.${field}`)
  }
  delete arrowView.color
  const rootSplit = textAndView(root)
  const dialogSplit = textAndView(dialog)
  const margins = {
    top: resolveMargin(root, "top", rtl, hostWidth),
    right: resolveMargin(root, "right", rtl, hostWidth),
    bottom: resolveMargin(root, "bottom", rtl, hostWidth),
    left: resolveMargin(root, "left", rtl, hostWidth),
  }
  return {
    root: rootSplit.view,
    rootText: rootSplit.text,
    dialog: dialogSplit.view,
    dialogText: { ...rootSplit.text, ...dialogSplit.text },
    arrow: arrowView as ViewStyle,
    arrowPaint: paint,
    arrowColor: arrow.color ?? root.color,
    margins,
  }
}
