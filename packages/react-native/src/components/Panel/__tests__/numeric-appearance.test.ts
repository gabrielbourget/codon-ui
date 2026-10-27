import { Easing } from "react-native"

import { resolveNativeTheme } from "../../../theme/defaults"
import { createPanelAppearanceMixer } from "../appearanceValues"
import { getNativePanelStyles } from "../styles"

type TReference = {
  sampler: string
  results: {
    id: string
    property: "opacity" | "zIndex"
    from: number | "auto"
    to: number
    duration: number
    easing: string
    values: string[]
  }[]
}
const reference = jest.requireActual<TReference>("./fixtures/numeric-browser-reference.json")
const theme = resolveNativeTheme("light")

it("interpolates stacking order as CSS integers instead of forwarding fractions to the native int receiver", () => {
  const mix = createPanelAppearanceMixer("zIndex", 0, 5, { width: 300, height: 500 }, "navy")
  expect(mix!(0.5)).toBe(3)
})

it.each(reference.results)("matches browser-computed transition parameters for $id", (sample) => {
  expect(reference.sampler).toBe("computed-endpoints")
  expect(sample.duration).toBe(350)
  expect(sample.easing).toBe("ease-in-out")
  if (sample.from === "auto") {
    expect(
      createPanelAppearanceMixer("zIndex", undefined, sample.to, { width: 300, height: 500 }, "navy"),
    ).toBeUndefined()
    return
  }
  const calibrate = (value: number) =>
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
