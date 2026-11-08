import { act, cleanup, fireEvent, render, screen, userEvent } from "@testing-library/react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { INDICATOR_G04_CASES, IndicatorG04Fixture } from "../IndicatorG04Fixture"

beforeEach(() => jest.useFakeTimers())
afterEach(async () => {
  await cleanup()
  jest.useRealTimers()
})

const state = () => JSON.parse(screen.getByTestId("indicator-g04-state").props.accessibilityLabel)
const press = async (label: string) => userEvent.setup().press(screen.getByRole("button", { name: label }))
const select = async (name: string) => {
  for (let count = 0; state().case !== name && count < INDICATOR_G04_CASES.length; count++)
    await press("G04 IND next case")
  expect(state().case).toBe(name)
}

it("prepares a collapsed public Indicator and independently authored raw references", async () => {
  await render(<IndicatorG04Fixture />)
  expect(screen.queryByTestId("indicator-g04-target")).toBeNull()
  await press("G04 prepare Indicator")
  expect(INDICATOR_G04_CASES).toHaveLength(8)
  expect(screen.getByTestId("indicator-g04-target")).toHaveStyle({ width: 10, height: 10, borderWidth: 0 })
  expect(screen.getByTestId("indicator-g04-target").props.accessible).toBe(false)
  expect(screen.getByTestId("indicator-g04-reference").props.accessible).toBe(false)
  expect(screen.getByTestId("indicator-g04-parent")).toHaveStyle({
    width: 120,
    height: 120,
    alignItems: "flex-start",
  })
  expect(state().layout).toBeNull()
})

it("retains the active border while changing activity and independently authored shape geometry", async () => {
  await render(<IndicatorG04Fixture />)
  await press("G04 prepare Indicator")
  await select("activity-border")
  await press("G04 IND activity")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor: "gray", borderColor: "lime", borderWidth: 2 })
  await press("G04 IND explicit border")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor: "gray", borderColor: "#174ea6" })
  await select("shape-fractional")
  expect(state()).toMatchObject({ active: false, shape: "rounded" })
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ width: 14.5, height: 14.5, borderRadius: 5 })
  await press("G04 IND shape")
  expect(state().shape).toBe("square")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ borderRadius: 0 })
})

it("expresses zero, percentage, auto and post-custom callback outputs without fabricating native layout", async () => {
  await render(<IndicatorG04Fixture />)
  await press("G04 prepare Indicator")
  await select("zero")
  expect(screen.getByTestId("indicator-g04-target")).toHaveStyle({ width: 0, height: 0, borderWidth: 0 })
  await select("percent")
  expect(screen.getByTestId("indicator-g04-target")).toHaveStyle({ width: "50%", height: "50%" })
  expect(screen.getByTestId("indicator-g04-reference")).toHaveStyle({ width: 60, height: 60 })
  await select("auto")
  expect(screen.getByTestId("indicator-g04-target")).toHaveStyle({ width: "auto", height: "auto" })
  expect(screen.getByTestId("indicator-g04-reference")).toHaveStyle({ width: 0, height: 0 })
  await select("registered-callback")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ width: 24, height: 10, borderRadius: 3, opacity: 0.75, marginTop: 5 })
  await press("G04 IND activity")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ width: 28, height: 10 })
  await press("G04 IND zero opacity")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ opacity: 0 })
  expect(state().layout).toBeNull()
})

it("records only delivered native layout fields and keeps the serialized marker geometry fixed", async () => {
  await render(<IndicatorG04Fixture />)
  await press("G04 prepare Indicator")
  await select("zero")
  await act(() =>
    fireEvent(screen.getByTestId("indicator-g04-target"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 }, target: 771 },
      currentTarget: 771,
    }),
  )
  expect(state().layouts.target).toEqual({
    layout: { x: 0, y: 0, width: 0, height: 0 },
    nativeTarget: 771,
    currentTarget: 771,
  })
  expect(state().layout).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  expect(screen.getByTestId("indicator-g04-state")).toHaveStyle({ width: 1, height: 1 })
  expect(screen.getByTestId("indicator-g04-parent")).toHaveStyle({ width: 120, height: 120 })
})

it("keeps public Button foreground and standalone provider colors distinct through context changes and reset", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <IndicatorG04Fixture />
    </NativeThemeProvider>,
  )
  await press("G04 prepare Indicator")
  for (const id of ["indicator-g04-owned-target", "indicator-g04-owned-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor: "#ffffff" })
  await press("G04 IND named target")
  expect(screen.getByTestId("indicator-g04-target").props.accessibilityLabel).toBe("G04 indicator")
  await press("G04 IND provider context")
  for (const id of ["indicator-g04-target", "indicator-g04-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor: "#ff8800" })
  await act(() => jest.advanceTimersByTime(275))
  for (const id of ["indicator-g04-owned-target", "indicator-g04-owned-reference"])
    expect(screen.getByTestId(id)).toHaveStyle({ backgroundColor: "#087f8c" })
  await select("native-color")
  await press("G04 IND final action")
  await rerender(
    <NativeThemeProvider mode="dark">
      <IndicatorG04Fixture />
    </NativeThemeProvider>,
  )
  expect(state()).toMatchObject({
    case: "native-color",
    active: true,
    actions: 1,
    named: true,
    override: true,
    mode: "dark",
  })
  await press("G04 prepare Indicator")
  expect(state()).toMatchObject({
    case: "default",
    active: true,
    shape: "circle",
    actions: 0,
    named: false,
    override: false,
    borderOverride: false,
    zeroOpacity: false,
  })
})
