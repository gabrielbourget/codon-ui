import { Easing } from "react-native"

import { createPanelAppearanceMixer } from "../appearanceValues"

type TReference = {
  sampler: string
  results: {
    id: string
    field: "rowGap" | "columnGap"
    from: string
    to: string
    duration: number
    easing: string
    values: { progress: number; contentWidth: number; contentHeight: number; distance: number }[]
  }[]
}
const reference = jest.requireActual<TReference>("./fixtures/gap-browser-reference.json")
it.each(reference.results)("matches actual canonical browser child spacing for $id/$field", (sample) => {
  expect(reference.sampler).toBe("computed-endpoints-child-spacing")
  expect(sample.duration).toBe(350)
  expect(sample.easing).toBe("ease-in-out")
  const bounds = { width: 900, height: 800, content: { width: 0, height: 0 } }
  const mix = createPanelAppearanceMixer(sample.field, sample.from, sample.to, bounds, "navy")!
  expect(mix).toBeDefined()
  const ease = Easing.bezier(0.42, 0, 0.58, 1)
  for (const frame of sample.values) {
    bounds.content = { width: frame.contentWidth, height: frame.contentHeight }
    const value = mix(ease(frame.progress))
    const measured =
      typeof value === "string"
        ? (parseFloat(value) * (sample.field === "rowGap" ? bounds.content.height : bounds.content.width)) / 100
        : value
    // Chromium quantizes child layout to subpixels; this is a spacing-parameter control, not native raster proof.
    expect(measured).toBeCloseTo(frame.distance, 1)
  }
})
