import type { TNativeTheme } from "../../theme/types"
import { resolveNativeStyle, validateNativeColor } from "../colors"
import { validateNativeDisplayDimension } from "../displayDimensions"

import { DEFAULT_TOAST_GAP, DEFAULT_TOAST_WIDTH, type TNativeToastProps } from "./types"

export const getNativeToastStyles = (theme: TNativeTheme, props: TNativeToastProps, removed: boolean) => {
  const { toast, index, numToasts, position, offset, firstHeight, toasterExpanded, expandByDefault } = props
  const { type = "info", geometry = "rounded", raised = true, width, height } = toast
  validateNativeDisplayDimension(width, "Toaster", "width")
  validateNativeDisplayDimension(height, "Toaster", "height")
  if (geometry !== "rounded" && geometry !== "orthogonal") throw new TypeError("Toaster: unsupported geometry")
  const color =
    type === "warning"
      ? theme.colors.statusWarning
      : type === "success"
        ? theme.colors.statusSuccess
        : ["error", "danger", "delete"].includes(type)
          ? theme.colors.statusDanger
          : theme.colors.controlSelectedBackground
  const expanded = toasterExpanded || expandByDefault
  const lift = position.startsWith("top") ? 1 : -1
  const authored = resolveNativeStyle([toast.customStyles, toast.style], "Toaster", "toast.style")
  const { color: foreground = theme.colors.foreground, ...view } = authored
  validateNativeColor(foreground, "Toaster", "color")
  return {
    color,
    foreground,
    authored: view,
    lift,
    expanded,
    root: resolveNativeStyle(
      [
        {
          position: "absolute",
          [lift === 1 ? "top" : "bottom"]: 0,
          width: width ?? DEFAULT_TOAST_WIDTH,
          height: !expanded && index > 0 ? firstHeight : height,
          flexDirection: "column",
          gap: theme.spacing.unit,
          overflow: "hidden",
          backgroundColor: theme.colors.background,
          borderRadius: geometry === "rounded" ? theme.radius.rounded : 0,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 3,
          shadowOpacity: raised ? 0.24 : 0,
          elevation: raised ? 2 : 0,
          zIndex: numToasts - index,
          opacity: removed || index >= props.maxVisibleToasts ? 0 : 1,
          transform: [
            { translateY: lift * (expanded ? offset : index * (props.toastGap ?? DEFAULT_TOAST_GAP)) },
            { scale: !expanded && index > 0 ? 1 - index * 0.05 : 1 },
          ],
        },
        view,
      ],
      "Toaster",
      "toast.style",
    ),
    ribbon: [
      {
        minHeight: 30,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        paddingLeft: theme.spacing.unit * 2,
        paddingRight: theme.spacing.unit,
        backgroundColor: color,
      },
      toast.customTopRibbonStyles,
    ],
    left: [
      { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: theme.spacing.unit },
      toast.customTopRibbonLeftContentStyles,
    ],
    content: [
      { gap: theme.spacing.unit * 2, padding: theme.spacing.unit * 2, borderRadius: 0.5 },
      toast.customContentStyles,
    ],
    bottom: [
      { flexDirection: "row" as const, alignItems: "center" as const, width: "100%" as const },
      toast.customBottomRowStyles,
    ],
    buttons: [
      {
        flex: 1,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "flex-end" as const,
        gap: theme.spacing.unit,
      },
      toast.customButtonRowStyles,
    ],
  }
}
