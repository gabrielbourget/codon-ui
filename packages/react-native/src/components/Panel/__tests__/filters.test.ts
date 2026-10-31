import { Easing, PlatformColor, processColor, type ColorValue } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { createPanelAppearanceMixer, getPanelAppearanceDefault } from "../appearanceValues"
import { createPanelFilterMixer, resolvePanelFilters } from "../filters"
import { getNativePanelStyles } from "../styles"

type TReference = {
  source: { sha256: string }
  results: { id: string; from: string; to: string; duration: number; easing: string; values: string[] }[]
}
const reference = jest.requireActual<TReference>("./fixtures/filter-browser-reference.json")
const sdk = jest.requireActual<{ default: (value: unknown) => unknown }>(
  "react-native/Libraries/StyleSheet/processFilter",
).default
const compare = (actual: unknown, expected: unknown, field = "") => {
  if (typeof expected === "number") {
    expect(typeof actual).toBe("number")
    if (field === "color") {
      for (const shift of [0, 8, 16, 24])
        expect(Math.abs((((actual as number) >>> shift) & 255) - ((expected >>> shift) & 255))).toBeLessThanOrEqual(1)
    } else
      expect(Math.abs((actual as number) - expected)).toBeLessThanOrEqual(
        Math.max(0.00001, Math.abs(expected) * 0.00001),
      )
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual)).toBe(true)
    expect(actual).toHaveLength(expected.length)
    expected.forEach((value, index) => compare((actual as unknown[])[index], value))
  } else if (expected && typeof expected === "object") {
    expect(actual).toBeTruthy()
    expect(Object.keys(actual as object).sort()).toEqual(Object.keys(expected).sort())
    for (const [key, value] of Object.entries(expected)) compare((actual as Record<string, unknown>)[key], value, key)
  } else expect(actual).toEqual(expected)
}

it("interpolates native filter functions with identity padding instead of snapping the full list", () => {
  const mix = createPanelAppearanceMixer(
    "filter",
    "brightness(50%) blur(4px)",
    "brightness(150%) blur(12px) opacity(25%)",
    { width: 300, height: 500 },
    "navy",
  )
  expect(mix).toBeDefined()
  expect(mix!(0.5)).toEqual([{ brightness: 1 }, { blur: 8 }, { opacity: 0.625 }])
})

it.each(reference.results)("matches browser filter parameters for $id through the unchanged SDK parser", (sample) => {
  expect(reference.source.sha256).toBe("df3658550291bd80a57e7b1137d4bbd2ac38e1843ba558d9760b02651aa65d9e")
  expect(sample.duration).toBe(350)
  expect(sample.easing).toBe("ease-in-out")
  const mix = createPanelFilterMixer(sample.from, sample.to, "rgb(32, 64, 128)")
  if (sample.id === "mismatch") {
    expect(mix).toBeUndefined()
    return
  }
  expect(mix).toBeDefined()
  const ease = Easing.bezier(0.42, 0, 0.58, 1)
  for (const [index, progress] of [0, 0.25, 0.5, 0.75, 1].entries())
    compare(sdk(mix!(ease(progress))), sdk(sample.values[index]))
})

it.each(["grayscale", "invert", "opacity", "sepia"])(
  "clamps %s before mixing instead of delaying its effect",
  (name) => {
    expect(sdk(`${name}(200%)`)).toEqual([{ [name]: 2 }])
    expect(resolvePanelFilters(`${name}(200%)`, "navy")).toEqual([{ [name]: 1 }])
    const mix = createPanelFilterMixer([{ [name]: "200%" }], [{ [name]: 0 }], "navy")
    expect(mix!(0.5)).toEqual([{ [name]: 0.5 }])
  },
)

it("calibrates empty CSS arguments and typed units into values admitted by the pinned SDK", () => {
  expect(sdk("brightness()")).toEqual([{ brightness: 0 }])
  expect(sdk(resolvePanelFilters("brightness() opacity() hue-rotate() blur()", "navy"))).toEqual([
    { brightness: 1 },
    { opacity: 1 },
    { hueRotate: 0 },
    { blur: 0 },
  ])
  compare(sdk(resolvePanelFilters([{ brightness: "150%" }, { hueRotate: `${Math.PI}rad` }, { blur: "8px" }], "navy")), [
    { brightness: 1.5 },
    { hueRotate: 180 },
    { blur: 8 },
  ])
})

it("resolves current foreground for a static and transitioning drop shadow on the actual Panel style path", () => {
  const style = getNativePanelStyles(
    { accessibilityLabel: "Filter", customStyles: { color: "navy", filter: "drop-shadow(2px 4px)" } },
    resolveNativeTheme("light"),
    300,
  )
  expect(style.view.filter).toEqual([{ dropShadow: { offsetX: 2, offsetY: 4, standardDeviation: 0, color: "navy" } }])
  const mix = createPanelFilterMixer("none", style.view.filter, "navy")
  const result = sdk(mix!(0.5)) as { dropShadow: { color: number } }[]
  expect(result[0].dropShadow.color).toBe(processColor("rgba(0, 0, 128, .5)"))
  expect(getPanelAppearanceDefault("filter", {}, {})).toEqual([])
})

it("keeps a shared opaque native shadow color intact while animating geometry", () => {
  const color = PlatformColor("labelColor")
  const mix = createPanelFilterMixer(
    [{ dropShadow: { offsetX: 0, offsetY: 0, color } }],
    [{ dropShadow: { offsetX: 10, offsetY: -4, color } }],
    "navy",
  )
  expect(mix!(0.5)).toEqual([{ dropShadow: { offsetX: 5, offsetY: -2, standardDeviation: 0, color } }])
  expect(
    createPanelFilterMixer(
      [{ dropShadow: { offsetX: 0, offsetY: 0, color } }],
      [{ dropShadow: { offsetX: 10, offsetY: 0, color: PlatformColor("secondaryLabelColor") } }],
      "navy",
    ),
  ).toBeUndefined()
})

it.each([
  "blur(-1px)",
  "hue-rotate(30%)",
  "blur(1em)",
  "brightness(-2)",
  "brightness(.5) garbage",
  "drop-shadow(2px 3px -4px red)",
  "drop-shadow(2px red 3px)",
  "drop-shadow(2px 3px 4px 5px red)",
  "drop-shadow(2px 3px red blue)",
  "url(#foreign)",
])("keeps unsupported or invalid %s out of interpolation without inventing an empty list", (value) => {
  expect(createPanelFilterMixer(value, "blur(4px)", "navy")).toBeUndefined()
  expect(resolvePanelFilters(value, "navy")).toBe(value)
})

it("does not mutate authored filter arrays or shadow objects", () => {
  const color: ColorValue = "navy"
  const shadow = Object.freeze({ offsetX: 2, offsetY: 4, color })
  const first = Object.freeze({ dropShadow: shadow })
  const value = Object.freeze([first, Object.freeze({ opacity: "50%" })])
  const mix = createPanelFilterMixer(value, "none", "red")
  expect(mix!(0.5)).toEqual([
    { dropShadow: { offsetX: 1, offsetY: 2, standardDeviation: 0, color: "rgba(0, 0, 128, 0.5)" } },
    { opacity: 0.75 },
  ])
  expect(value[0]).toBe(first)
  expect(shadow).toEqual({ offsetX: 2, offsetY: 4, color })
})
