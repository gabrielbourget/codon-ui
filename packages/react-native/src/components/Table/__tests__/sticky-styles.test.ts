import { processColor, type TextStyle } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { resolveNativeTableStickyColumn, resolveNativeTableStickyOptions } from "../stickyStyles"
import type { TNativeTableProps } from "../types"

const theme = resolveNativeTheme("light")
it.each([undefined, false, true])("keeps stickyHeader %s explicit and disabled paint untouched", (stickyHeader) => {
  const options = resolveNativeTableStickyOptions({ stickyHeader }, theme)
  const style = { width: 180, color: "red" }
  const result = resolveNativeTableStickyColumn(options, {}, style)
  expect(result.enabled).toBe(!!stickyHeader)
  expect(result.style).toMatchObject(style)
  if (stickyHeader) expect(result.style).toMatchObject({ backgroundColor: theme.colors.background, zIndex: 3 })
  else expect(result.style).toEqual(style)
})
it("retains zero/negative/percentage offset and final transparent/background/stacking overrides", () => {
  for (const offset of [0, -12, "-10%", "25%"] as const) {
    const options = resolveNativeTableStickyOptions(
      { stickyHeader: true, stickyHeaderOffset: offset, stickyHeaderBackgroundColor: "red" },
      theme,
    )
    const authored = { top: 0, left: "10%", backgroundColor: "transparent", zIndex: 0 } as const
    const result = resolveNativeTableStickyColumn(options, authored, { ...authored, width: 180 })
    expect(result.enabled).toBe(true)
    expect(result.insets).toEqual({ top: offset })
    expect(result.style).toEqual({ ...authored, width: 180 })
    expect(processColor(result.style.backgroundColor)).toBe(processColor("transparent"))
    expect(resolveNativeTableStickyColumn(options, {}, {}).insets.top).toBe(offset)
  }
})
it.each(["relative", "absolute", "static"] as const)(
  "preserves an authored %s position and its original insets",
  (position) => {
    const options = resolveNativeTableStickyOptions({ stickyHeader: true }, theme)
    const authored = { position, top: 12, bottom: "25%", zIndex: 0 } as const
    const result = resolveNativeTableStickyColumn(options, authored, authored)
    expect(result.enabled).toBe(false)
    expect(result.style).toMatchObject(authored)
    expect(result.style.backgroundColor).toBe(theme.colors.background)
  },
)
it("preserves every authored inset for the original renderer and leaves only the stylesheet fallback in the binding", () => {
  const authored = {
    top: "auto",
    bottom: 2,
    left: -4,
    right: "25%",
    start: 3,
    end: 4,
    inset: 5,
    insetBlock: 6,
    insetInline: 7,
    insetBlockStart: 8,
    insetBlockEnd: 9,
    insetInlineStart: 10,
    insetInlineEnd: 11,
    margin: 12,
    padding: 14,
    transform: [{ rotate: "15deg" }],
  } as TextStyle
  const result = resolveNativeTableStickyColumn(
    resolveNativeTableStickyOptions({ stickyHeader: true }, theme),
    authored,
    { ...authored, width: 180 },
  )
  expect(result.insets).toEqual({ top: 0 })
  expect(result.style).toEqual({
    ...authored,
    width: 180,
    backgroundColor: theme.colors.background,
    zIndex: 3,
  })
  expect(authored.top).toBe("auto")
  expect(authored.margin).toBe(12)
})
it("preserves the existing final resize width and untouched native style object values", () => {
  const transform = [{ translateX: 2 }]
  const result = resolveNativeTableStickyColumn(
    resolveNativeTableStickyOptions({ stickyHeader: true }, theme),
    { width: 999 },
    { width: 180, transform },
  )
  expect(result.style.width).toBe(180)
  expect(result.style.transform).toBe(transform)
})
it.each([NaN, Infinity, "10px", "auto", "2rem", "NaN%", {}])(
  "rejects invalid public offset %s before a native registration",
  (stickyHeaderOffset) => {
    expect(() => resolveNativeTableStickyOptions({ stickyHeaderOffset } as TNativeTableProps, theme)).toThrow(
      "stickyHeaderOffset",
    )
  },
)
