import { PlatformColor, type ViewStyle } from "react-native"

import { resolveNativeStyle } from "../colors"

const invalidShadows: [string, ViewStyle, RegExp][] = [
  ["box shadow color", { boxShadow: "0 1px 2px not-a-color" }, /style.boxShadow\[0\].color/],
  ["a later box shadow", { boxShadow: "0 1px 2px red, 0 2px 4px var(--shadow)" }, /style.boxShadow\[1\].color/],
  ["a function color", { boxShadow: "0 1px 2px rgb(no, color, here)" }, /style.boxShadow\[0\].color/],
  [
    "structured drop shadow",
    { filter: [{ dropShadow: { offsetX: 0, offsetY: 1, color: "var(--shadow)" } }] },
    /style.filter\[0\].dropShadow.color/,
  ],
  ["drop shadow string", { filter: [{ dropShadow: "0px 1px not-a-color" }] }, /style.filter\[0\].dropShadow.color/],
  [
    "filter string",
    { filter: "brightness(1)drop-shadow(0px 1px 2px var(--shadow))" },
    /style.filter.*dropShadow.color/,
  ],
  [
    "a later filter shadow",
    { filter: "drop-shadow(0px 1px red) contrast(1) drop-shadow(0px 1px currentColor)" },
    /style.filter.*dropShadow.color/,
  ],
]

describe("native shadow color validation", () => {
  it.each(invalidShadows)("rejects %s with its component and field", (_name, style, field) => {
    expect(() => resolveNativeStyle(style, "Button", "style")).toThrow(TypeError)
    expect(() => resolveNativeStyle(style, "Button", "style")).toThrow(field)
  })

  it.each<ViewStyle>([
    { boxShadow: "0px 1px 2px" },
    { boxShadow: "inset 0px 1px 2px rgba(10, 20, 30, 0.5), #abcdef -2px 3px 4px 5px" },
    { boxShadow: "transparent 0px 0px, blue 0px 1px" },
    { boxShadow: [{ offsetX: 0, offsetY: 1, color: PlatformColor("labelColor") }] },
    { filter: "brightness(1)drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.5)) contrast(1.2) drop-shadow(red -1px 0px)" },
    { filter: [{ dropShadow: "0px 1px 2px red" }, { brightness: 1 }] },
    { filter: [{ dropShadow: { offsetX: 0, offsetY: 1, color: PlatformColor("labelColor") } }] },
    { filter: [{ dropShadow: { offsetX: 0, offsetY: 1, color: 0xff0000ff } }] },
    { filter: [{ dropShadow: { offsetX: 0, offsetY: 1 } }] },
  ])("preserves valid native style input %#", (style) => {
    expect(resolveNativeStyle(style, "Text", "customStyles")).toEqual(style)
  })
})
