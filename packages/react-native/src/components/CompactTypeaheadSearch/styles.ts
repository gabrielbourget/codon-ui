import type { TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { AVAILABLE_CORNER_GEOMETRY_CODES } from "../../tokens/geometry"
import { resolveNativeStyle } from "../colors"

import type { TNativeCompactTypeaheadRenderState, TNativeCompactTypeaheadSearchProps } from "./types"

export const getCompactTypeaheadStyles = <T extends object>(
  theme: TNativeTheme,
  props: TNativeCompactTypeaheadSearchProps<T>,
  state: TNativeCompactTypeaheadRenderState,
  focused: boolean,
) => {
  const geometry = props.geometry ?? "rounded"
  if (!AVAILABLE_CORNER_GEOMETRY_CODES.includes(geometry))
    throw new TypeError("CompactTypeaheadSearch: unsupported geometry")
  const resolve = (styles: Parameters<typeof resolveNativeStyle<TextStyle>>[0], field: string) =>
    resolveNativeStyle<TextStyle>(styles, "CompactTypeaheadSearch", field)
  const defaults = resolve(
    [
      {
        height: props.height,
        width: props.width ?? "100%",
        direction: props.rtl ? "rtl" : "ltr",
        color: props.color ?? theme.colors.controlForeground,
        backgroundColor: theme.colors.controlBackground,
        opacity: props.isDisabled ? theme.opacity.disabled : 1,
      },
      props.customStyles,
    ],
    "customStyles",
  )
  const root = resolve(
    [
      defaults,
      typeof props.style === "function" ? props.style({ ...state, defaultStyle: { ...defaults } }) : props.style,
    ],
    "style",
  )
  const group = resolve(
    [
      {
        height: props.height,
        width: props.width ?? "100%",
        color: props.color,
        flexDirection: props.rtl ? "row-reverse" : "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderWidth: 1,
        borderColor: props.errorState
          ? theme.colors.validationErrorBorder
          : props.warningState
            ? theme.colors.validationWarningBorder
            : props.successState
              ? theme.colors.validationSuccessBorder
              : theme.colors.controlBorder,
        borderRadius: geometry === "round" ? theme.radius.round : geometry === "rounded" ? theme.radius.rounded : 0,
        ...(geometry === "round" ? { paddingVertical: theme.spacing.unit, paddingHorizontal: 7 } : {}),
        ...(focused && props.enableFocusStyle !== false
          ? {
              outlineColor: theme.colors.focusRing,
              outlineWidth: 1.5,
              outlineOffset: props.offsetFocusRing === false ? 0 : 1.5,
            }
          : {}),
      },
      props.customInputButtonGroupStyles,
    ],
    "customInputButtonGroupStyles",
  )
  const foreground = root.color ?? theme.colors.controlForeground
  const groupForeground = group.color ?? foreground
  return {
    root,
    group,
    foreground,
    input: resolve(
      [
        {
          flex: 1,
          minWidth: 0,
          writingDirection: props.rtl ? "rtl" : "ltr",
          borderWidth: 0,
          backgroundColor: "transparent",
          color: props.color ?? groupForeground,
          outlineWidth: 0,
          boxShadow: [],
        },
        props.customInputStyles,
      ],
      "customInputStyles",
    ),
    button: resolve(
      [
        { borderWidth: 0, backgroundColor: "transparent", color: props.color ?? groupForeground },
        props.customButtonStyles,
      ],
      "customButtonStyles",
    ),
    list: resolve(
      [
        {
          width: "100%",
          maxHeight: 280,
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
        },
        props.customOptionsListStyles,
      ],
      "customOptionsListStyles",
    ),
    status: {
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.unit,
      padding: theme.spacing.unit * 2,
    } as TextStyle,
  }
}
