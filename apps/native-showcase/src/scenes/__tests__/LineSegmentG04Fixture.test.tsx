import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"

import { NativeThemeProvider } from "@codon-ui/react-native"

import { LineSegmentG04Fixture } from "../LineSegmentG04Fixture"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const state = () => JSON.parse(screen.getByTestId("line-segment-g04-state").props.accessibilityLabel)
const press = async (label: string) => userEvent.setup().press(screen.getByRole("button", { name: label }))
const select = async (name: string) => {
  for (let count = 0; state().case !== name && count < 26; count++) await press("G04 LS next case")
  expect(state().case).toBe(name)
}

it("prepares actual public segment and independent native reference without changing existing scene setup", async () => {
  await render(<LineSegmentG04Fixture />)
  expect(screen.queryByTestId("line-segment-g04-target")).toBeNull()
  await press("G04 prepare LineSegment")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({ width: 2.5, height: 50 })
  expect(screen.getByTestId("line-segment-g04-target").props.accessible).toBe(false)
  expect(screen.getByTestId("line-segment-g04-reference").props.accessible).toBe(false)
  expect(screen.getByTestId("line-segment-g04-parent")).toHaveStyle({
    width: 120,
    height: 120,
    alignItems: "flex-start",
  })
  await select("computed-custom-final")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({
    backgroundColor: "tomato",
    opacity: 0.5,
    marginTop: 5,
  })
  await select("post-custom-callback-horizontal")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({
    width: 24,
    height: 50,
    backgroundColor: "purple",
  })
  await select("post-custom-callback-vertical")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({
    width: 24,
    height: 2.5,
    backgroundColor: "purple",
  })
})

it("expresses percentage, zero, auto and explicit opacity cases without inventing native measurements", async () => {
  await render(<LineSegmentG04Fixture />)
  await press("G04 prepare LineSegment")
  await select("percent-height-zero-thickness")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({ height: "50%", width: 0 })
  await select("auto-width")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({ width: "auto", height: 2.5 })
  await select("array-zero-opacity")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({ opacity: 0, borderRadius: 3 })
  expect(state().layout).toBeNull()
})

it("keeps the geometry marker fixed while recording actual native layout delivery", async () => {
  await render(<LineSegmentG04Fixture />)
  await press("G04 prepare LineSegment")
  const marker = screen.getByTestId("line-segment-g04-state")
  expect(marker).toHaveStyle({ width: 1, height: 1 })
  await act(() =>
    fireEvent(screen.getByTestId("line-segment-g04-target"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 2.5, height: 50 } },
    }),
  )
  expect(state().layout).toEqual({ x: 0, y: 0, width: 2.5, height: 50 })
  expect(screen.getByTestId("line-segment-g04-state")).toHaveStyle({ width: 1, height: 1 })
  expect(screen.getByTestId("line-segment-g04-parent")).toHaveStyle({ width: 120, height: 120 })
})

it("retains selected case and end action through mounted theme/provider changes and resets explicitly", async () => {
  const { rerender } = await render(
    <NativeThemeProvider>
      <LineSegmentG04Fixture />
    </NativeThemeProvider>,
  )
  await press("G04 prepare LineSegment")
  await select("vertical-blue")
  await press("G04 LS named boundary")
  await press("G04 LS final action")
  await rerender(
    <NativeThemeProvider mode="dark">
      <LineSegmentG04Fixture />
    </NativeThemeProvider>,
  )
  expect(state()).toMatchObject({ case: "vertical-blue", actions: 1, named: true, mode: "dark" })
  expect(screen.getByTestId("line-segment-g04-target").props.accessibilityLabel).toBe("G04 boundary")
  expect(screen.getByTestId("line-segment-g04-target")).toHaveStyle({ backgroundColor: "blue" })
  await press("G04 LS provider border")
  expect(state().override).toBe(true)
  expect(screen.getByTestId("line-segment-g04-end")).toHaveTextContent("LineSegment G04 end. Actions: 1.")
  await press("G04 prepare LineSegment")
  expect(state()).toMatchObject({ case: "default-horizontal", actions: 0, named: false, override: false })
})
