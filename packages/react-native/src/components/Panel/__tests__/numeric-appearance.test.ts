import { Easing } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { arePanelAppearanceValuesEqual, createPanelAppearanceMixer } from "../appearanceValues"
import { getNativePanelStyles } from "../styles"

type TReference = {
  sampler: string
  results: {
    id: string
    property: "opacity" | "zIndex" | "aspectRatio"
    from: number | string
    to: number | string
    duration: number
    easing: string
    values: string[]
  }[]
}
const reference = jest.requireActual<TReference>("./fixtures/numeric-browser-reference.json")
const theme = resolveNativeTheme("light")

it.each([
  [1, 4, 2],
  [4, 1, 2],
  [0.25, 4, 1],
  ["5 / 1", "3 / 2", Math.sqrt(7.5)],
  ["+2e0", "8 / 1", 4],
])("interpolates native aspect ratios %s to %s in logarithmic ratio space", (from, to, expected) => {
  const mix = createPanelAppearanceMixer("aspectRatio", from, to, { width: 300, height: 500 }, "navy")
  expect(mix).toBeDefined()
  expect(mix!(0.5)).toBeCloseTo(expected as number, 10)
})

it("leaves auto, degenerate and unsupported aspect ratios outside interpolation", () => {
  for (const from of [undefined, "auto", 0, "0 / 1", "1 / 0", -1, Infinity, "auto 2 / 1", "2px / 1"])
    expect(createPanelAppearanceMixer("aspectRatio", from, 4, { width: 300, height: 500 }, "navy")).toBeUndefined()
  expect(arePanelAppearanceValuesEqual("aspectRatio", 1.5, "3 / 2")).toBe(true)
  expect(arePanelAppearanceValuesEqual("aspectRatio", "1/2", "2/4")).toBe(true)
})

it("interpolates stacking order as CSS integers instead of forwarding fractions to the native int receiver", () => {
  const mix = createPanelAppearanceMixer("zIndex", 0, 5, { width: 300, height: 500 }, "navy")
  expect(mix!(0.5)).toBe(3)
})

it.each(reference.results)("matches browser-computed transition parameters for $id", (sample) => {
  expect(reference.sampler).toBe("computed-endpoints")
  expect(sample.duration).toBe(350)
  expect(sample.easing).toBe("ease-in-out")
  if (sample.from === "auto" || (sample.property === "aspectRatio" && sample.from === "0 / 1")) {
    expect(
      createPanelAppearanceMixer(
        sample.property,
        sample.property === "zIndex" ? undefined : sample.from,
        sample.to,
        { width: 300, height: 500 },
        "navy",
      ),
    ).toBeUndefined()
    return
  }
  const calibrate = (value: number | string) =>
    getNativePanelStyles(
      {
        accessibilityLabel: "Numeric",
        customStyles: { [sample.property]: value },
      },
      theme,
      300,
    ).view[sample.property]!
  const mix = createPanelAppearanceMixer(
    sample.property,
    calibrate(sample.from),
    calibrate(sample.to),
    { width: 300, height: 500 },
    "navy",
  )
  expect(mix).toBeDefined()
  const ease = Easing.bezier(0.42, 0, 0.58, 1)
  for (const [index, progress] of [0, 0.25, 0.5, 0.75, 1].entries()) {
    if (sample.property === "aspectRatio") {
      const [width, height = "1"] = sample.values[index].split("/")
      const expected = Number(width) / Number(height)
      // Computed CSS ratios serialize to six significant digits; retain five for the native easing comparison.
      expect(Number(mix!(ease(progress))).toPrecision(5)).toBe(expected.toPrecision(5))
      continue
    }
    const expected = Number(sample.values[index])
    if (sample.property === "zIndex") expect(mix!(ease(progress))).toBe(expected)
    else expect(mix!(ease(progress))).toBeCloseTo(expected, 5)
  }
})

it("normalizes negative zero and leaves non-integer authored stacking values outside interpolation", () => {
  expect(createPanelAppearanceMixer("zIndex", -1, 0, { width: 300, height: 500 }, "navy")!(0.5)).toBe(0)
  expect(createPanelAppearanceMixer("zIndex", 0.25, 2, { width: 300, height: 500 }, "navy")).toBeUndefined()
})

it("uses the overlay's own foreground default for shadow filters independently of the Panel text", () => {
  const styles = getNativePanelStyles(
    {
      accessibilityLabel: "Shadow",
      customStyles: { color: "navy" },
      customOverlayStyles: { filter: "drop-shadow(2px 4px)" },
    },
    theme,
    300,
  )
  expect(styles.overlay.filter).toEqual([
    { dropShadow: { offsetX: 2, offsetY: 4, standardDeviation: 0, color: theme.colors.foreground } },
  ])
  expect(styles.text.color).toBe("navy")
})

it("calibrates Panel and overlay opacity endpoints before their independent composition", () => {
  const styles = getNativePanelStyles(
    { accessibilityLabel: "Numeric", customStyles: { opacity: 2 }, customOverlayStyles: { opacity: -1 } },
    resolveNativeTheme("light"),
    300,
  )
  expect(styles.view.opacity).toBe(1)
  expect(styles.overlay.opacity).toBe(0)
})
