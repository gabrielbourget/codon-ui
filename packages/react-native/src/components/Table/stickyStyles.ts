import type { ColorValue, TextStyle } from "react-native"

import type { TNativeTheme } from "../../theme/types"
import { validateNativeColor } from "../colors"

import type { TNativeTableProps } from "./types"

export type TNativeTableStickyOffset = number | `${number}%`
export type TNativeTableStickyOptions = Readonly<{
  enabled: boolean
  offset: TNativeTableStickyOffset
  backgroundColor: ColorValue
}>
export const NATIVE_TABLE_STICKY_INSET_FIELDS = [
  "top",
  "right",
  "bottom",
  "left",
  "start",
  "end",
  "inset",
  "insetBlock",
  "insetInline",
  "insetBlockStart",
  "insetBlockEnd",
  "insetInlineStart",
  "insetInlineEnd",
] as const
export type TNativeTableStickyInsets = Readonly<
  Partial<Record<(typeof NATIVE_TABLE_STICKY_INSET_FIELDS)[number], number | `${number}%` | "auto">>
>

const validateInset = (value: unknown, field: string, allowAuto = true) => {
  if (typeof value === "number" && Number.isFinite(value)) return
  if (allowAuto && value === "auto") return
  if (
    typeof value === "string" &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(value) &&
    Number.isFinite(Number(value.slice(0, -1)))
  )
    return
  throw new TypeError(`Table: ${field} must be a finite logical inset, percentage or auto`)
}
export const resolveNativeTableStickyOptions = (
  props: Pick<TNativeTableProps, "stickyHeader" | "stickyHeaderOffset" | "stickyHeaderBackgroundColor">,
  theme: TNativeTheme,
): TNativeTableStickyOptions => {
  if (props.stickyHeader !== undefined && typeof props.stickyHeader !== "boolean")
    throw new TypeError("Table: stickyHeader must be boolean")
  const offset = props.stickyHeaderOffset ?? 0
  validateInset(offset, "stickyHeaderOffset", false)
  validateNativeColor(props.stickyHeaderBackgroundColor, "Table", "stickyHeaderBackgroundColor")
  return {
    enabled: props.stickyHeader ?? false,
    offset,
    backgroundColor: props.stickyHeaderBackgroundColor ?? theme.colors.background,
  }
}

export const resolveNativeTableStickyColumn = (
  options: TNativeTableStickyOptions,
  authored: TextStyle,
  resolved: TextStyle,
) => {
  const enabled = options.enabled && authored.position == null
  const insets: Record<string, number | string> = { top: options.offset }
  if (enabled)
    for (const field of NATIVE_TABLE_STICKY_INSET_FIELDS) {
      const value = authored[field as keyof TextStyle]
      if (value != null) {
        validateInset(value, `column style.${field}`)
        insets[field] = value as number | string
      }
    }
  const style = {
    ...resolved,
    ...(options.enabled
      ? {
          backgroundColor: authored.backgroundColor ?? options.backgroundColor,
          zIndex: authored.zIndex ?? 3,
        }
      : {}),
  }
  if (enabled) for (const field of NATIVE_TABLE_STICKY_INSET_FIELDS) delete style[field as keyof TextStyle]
  return { style, enabled, insets: insets as TNativeTableStickyInsets }
}
