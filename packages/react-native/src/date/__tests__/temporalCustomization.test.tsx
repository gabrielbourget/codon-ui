import "./temporalNativeModel"

import { fireEvent, render, screen, within } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, type View } from "react-native"

import { DatePickerFixture } from "../picker/__tests__/fixtures/DatePickerFixture"

import { admitTemporal, temporalPress, temporalTarget } from "./temporalNativeModel"

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())

const hidden = { includeHiddenElements: true }

it.each(["datetime-picker", "datetime-range-picker"])(
  "exposes all fifteen %s style owners in the maintained fixture without replacing held editors",
  async (id) => {
    const host = createRef<View>()
    const view = await render(<DatePickerFixture hostRef={host} />)
    host.current!.measureInWindow = (receive) => receive(0, 0, 390, 844)
    await fireEvent(screen.getByTestId("date-fixture-host"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    })
    await admitTemporal()
    const input = `${id}-input${id.includes("range") ? "-start" : ""}`
    const originalRoot = temporalTarget(id),
      originalSegment = temporalTarget(`${input}-segment-2`)
    await temporalPress("Toggle date style owners")
    await temporalPress("Toggle date theme")
    await temporalPress("Toggle date large text fixture")
    await admitTemporal()
    await temporalPress(screen.getByTestId(`${id}-trigger`).props.accessibilityLabel)
    await admitTemporal()
    const heading = screen.getByTestId(`${id}-calendar-heading`, hidden)
    const styled = (suffix: string) => screen.getByTestId(`${id}${suffix}`, hidden)
    expect(styled("")).toHaveStyle({ margin: 0, padding: 0 })
    expect(styled("-group")).toHaveStyle({ padding: 0 })
    expect(styled(`-input${id.includes("range") ? "-start" : ""}`)).toHaveStyle({
      padding: 0,
      paddingHorizontal: 0,
    })
    if (id.includes("range")) expect(styled("-input-end")).toHaveStyle({ padding: 0, paddingHorizontal: 0 })
    expect(styled("-trigger")).toHaveStyle({ padding: 5 })
    expect(styled("-popover")).toHaveStyle({ borderWidth: 2 })
    expect(styled("-popover-dialog")).toHaveStyle({ padding: 7 })
    const calendar = styled("-calendar")
    expect(calendar).toHaveStyle({ padding: 8 })
    expect(styled("-calendar-heading")).toBe(heading)
    expect(heading).toHaveStyle({ fontSize: 27 })
    expect(styled("-prev-btn")).toHaveStyle({ padding: 9 })
    expect(styled("-next-btn")).toHaveStyle({ padding: 10 })
    for (const grid of screen.getAllByTestId(`${id}-calendar-grid`, hidden)) {
      expect(grid).toHaveStyle({ padding: 11 })
      const rows = grid.queryAll((node) => node.type === "View" && node.props.role === "row")
      expect(rows.some((row) => StyleSheet.flatten(row.props.style)?.paddingTop === 12)).toBe(true)
      expect(rows.some((row) => StyleSheet.flatten(row.props.style)?.paddingBottom === 14)).toBe(true)
      for (const header of within(grid).getAllByRole("columnheader", hidden))
        expect(header).toHaveStyle({ padding: 13 })
    }
    expect(styled("-day-2024-11-07")).toHaveStyle({ padding: 15 })
    expect(temporalTarget(id)).toBe(originalRoot)
    expect(temporalTarget(`${input}-segment-2`)).toBe(originalSegment)
    expect(screen.getByTestId("date-fixture-state", hidden)).toHaveTextContent(
      /Custom styles true.*Date 2024-11-01.*Range 2024-11-01 \/ 2024-11-04/,
    )
    expect(screen.getByTestId("date-fixture-events", hidden)).toHaveTextContent("")
    await view.unmount()
    expect(host.current).toBeNull()
  },
  // Full fixture, control transitions and repeated native-model admission can exceed Jest’s 5s default.
  10_000,
)

it("removes maintained date style overrides on the same closed field owners without issuing requests", async () => {
  const view = await render(<DatePickerFixture />)
  await admitTemporal()
  const ids = ["datetime-picker", "datetime-range-picker"]
  const original = ids.map((id) => temporalTarget(id))
  await temporalPress("Toggle date style owners")
  await admitTemporal()
  for (const id of ids) expect(screen.getByTestId(id)).toHaveStyle({ margin: 0, padding: 0 })
  await temporalPress("Toggle date style owners")
  await admitTemporal()
  for (const [index, id] of ids.entries()) {
    expect(temporalTarget(id)).toBe(original[index])
    expect(screen.getByTestId(id)).not.toHaveStyle({ margin: 0, padding: 0 })
  }
  expect(screen.getByTestId("date-fixture-state")).toHaveTextContent(
    /Custom styles false.*Date 2024-11-01.*Range 2024-11-01 \/ 2024-11-04/,
  )
  expect(screen.getByTestId("date-fixture-events")).toHaveTextContent("")
  await view.unmount()
})
