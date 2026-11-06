import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { AccessibilityInfo, PixelRatio, StyleSheet } from "react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { METER_STYLE_CASES, MeterStyleFixture } from "../MeterStyleFixture"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const state = () => JSON.parse(screen.getByTestId("meter-style-state").props.accessibilityLabel)
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const select = async (name: string) => {
  for (let count = 0; state().case !== name && count < METER_STYLE_CASES.length; count++)
    await press("Next Meter style")
  expect(state().case).toBe(name)
}

it.each([1.75, 3])(
  "aligns independent measurement parents at density %s without changing Meter inputs",
  async (density) => {
    const scale = jest.spyOn(PixelRatio, "get").mockReturnValue(density)
    try {
      await render(<MeterStyleFixture />)
      await press("Prepare Meter styles")
      const parent = StyleSheet.flatten(screen.getByTestId("meter-style-parent").props.style)
      const reference = StyleSheet.flatten(screen.getByTestId("meter-style-reference-parent").props.style)
      const pair = StyleSheet.flatten(screen.getByTestId("meter-style-pair").props.style)
      expect(parent).toEqual(reference)
      expect(parent.height * density).toBeCloseTo(Math.round(170 * density), 8)
      expect(pair.gap * density).toBeCloseTo(Math.round(12 * density), 8)
      expect((parent.height + pair.gap) * density).toBeCloseTo(Math.round((parent.height + pair.gap) * density), 8)
      if (density === 3) expect([parent.height, pair.gap]).toEqual([170, 12])
      await select("zero-width")
      expect(screen.getByTestId("meter-style-target")).toHaveStyle({ width: 0, height: 10 })
      expect(screen.getByTestId("meter-style-reference")).toHaveStyle({ width: 0, height: 10 })
    } finally {
      scale.mockRestore()
    }
  },
)

it("keeps preparation collapsed and renders an actual named Meter beside a separate raw reference", async () => {
  await render(<MeterStyleFixture />)
  expect(screen.queryByTestId("meter-style-target")).toBeNull()
  await press("Prepare Meter styles")
  expect(screen.getAllByLabelText("Style meter")).toHaveLength(1)
  expect(screen.getByTestId("meter-style-target").props.accessibilityValue).toEqual({
    min: 0,
    max: 100,
    now: 25,
    text: "25%",
  })
  expect(screen.getByTestId("meter-style-target")).toHaveStyle({ width: 150, height: 10 })
  expect(screen.getByTestId("meter-style-reference")).toHaveStyle({ width: 150, height: 10 })
  expect(screen.getByTestId("meter-style-reference").props.accessible).toBe(false)
  expect(state().layouts).toEqual({})
})

it("prepares discriminating fractional, zero, percentage and auto inputs without fabricating native frames", async () => {
  await render(<MeterStyleFixture />)
  await press("Prepare Meter styles")
  for (const [name, target, reference] of [
    ["fractional", { width: 73.25, height: 13.75 }, { width: 73.25, height: 13.75 }],
    ["zero-width", { width: 0, height: 10 }, { width: 0, height: 10 }],
    ["zero-height", { width: 150, height: 0 }, { width: 150, height: 0 }],
    ["percentage", { width: "50%", height: 20 }, { width: 108, height: 20 }],
    ["auto-height", { width: 150, height: "auto" }, { width: 150, height: "auto" }],
  ] as const) {
    await select(name)
    expect(screen.getByTestId("meter-style-target")).toHaveStyle(target)
    expect(screen.getByTestId("meter-style-reference")).toHaveStyle(reference)
    if (name === "zero-width" || name === "zero-height" || name === "auto-height")
      expect(screen.getByTestId("meter-style-reference").children[0]).toHaveStyle({
        width: "100%",
        height: "100%",
        borderWidth: 1,
      })
    expect(state().layouts).toEqual({})
  }
})

it("records delivered public motion events and exposes actual controlled value changes and explicit reset", async () => {
  const events = jest.spyOn(AccessibilityInfo, "addEventListener")
  events.mockClear()
  await render(<MeterStyleFixture />)
  const listeners = events.mock.calls as unknown as ReadonlyArray<readonly [string, (enabled: boolean) => void]>
  const listener = listeners.filter(([name]) => name === "reduceMotionChanged").at(-1)?.[1]
  expect(listener).toBeDefined()
  await press("Prepare Meter styles")
  await press("Change Meter style value")
  expect(screen.getByTestId("meter-style-target").props.accessibilityValue).toEqual({
    min: 0,
    max: 100,
    now: 75,
    text: "75%",
  })
  await act(() => listener?.(true))
  expect(state().motionEvents).toEqual([true])
  await press("Prepare Meter styles")
  expect(state()).toMatchObject({ value: 25, case: "semantic", motionEvents: [true] })
})

it("makes the final callback depend on post-custom state and preserves independent track and bar styles", async () => {
  await render(<MeterStyleFixture />)
  await press("Prepare Meter styles")
  await select("post-custom-final")
  expect(screen.getByTestId("meter-style-target")).toHaveStyle({ width: 84, height: 20, opacity: 0.5, marginTop: 5 })
  expect(screen.getByTestId("meter-style-target")).not.toHaveStyle({ width: 92 })
  expect(screen.getByTestId("meter-style-target-track")).toHaveStyle({
    backgroundColor: "#ffcc66",
    borderColor: "#174ea6",
    borderWidth: 2,
  })
  expect(screen.getByTestId("meter-style-target-bar", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "#087f8c",
    borderRadius: 2,
  })
  await select("registered-array")
  expect(screen.getByTestId("meter-style-target")).toHaveStyle({ width: 91, opacity: 0.75 })
  expect(screen.getByTestId("meter-style-target-bar", { includeHiddenElements: true })).toHaveStyle({
    backgroundColor: "purple",
  })
})

it("retains the selected controlled Meter through provider changes and resets only on explicit prepare", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <MeterStyleFixture />
    </NativeThemeProvider>,
  )
  await press("Prepare Meter styles")
  await select("primary")
  const original = screen.getByTestId("meter-style-target")
  await rerender(
    <NativeThemeProvider mode="dark">
      <MeterStyleFixture />
    </NativeThemeProvider>,
  )
  expect(state()).toMatchObject({ case: "primary", mode: "dark" })
  expect(screen.getByTestId("meter-style-target")).toBe(original)
  expect(original.props.accessibilityValue.now).toBe(25)
  await press("Prepare Meter styles")
  expect(state()).toMatchObject({ case: "semantic", mode: "dark" })
})

it("exposes two identical raw reference trees as a separate diagnostic and restores the real Meter on prepare", async () => {
  await render(<MeterStyleFixture />)
  await press("Prepare Meter styles")
  await press("Compare raw Meter style references")
  expect(state()).toMatchObject({ case: "raised", value: 25, rawReferences: true })
  expect(screen.queryByLabelText("Style meter")).toBeNull()
  for (const owner of ["target", "reference"]) {
    const root = screen.getByTestId(`meter-style-${owner}`)
    expect(root.props.accessible).toBe(false)
    expect(root).toHaveStyle({ width: 150, height: 20 })
    expect(root.children[0]).toHaveStyle({ shadowOpacity: 0.24, shadowRadius: 3 })
  }
  await press("Prepare Meter styles")
  expect(state()).toMatchObject({ case: "semantic", value: 25, rawReferences: false })
  expect(screen.getAllByLabelText("Style meter")).toHaveLength(1)
})
