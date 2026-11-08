import { act, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"

import { CircularProgressFixture, CIRCULAR_NATIVE_CASES } from "../CircularProgressFixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const hidden = { includeHiddenElements: true }

it("prepares every named case and preserves caller values, semantic labels and independent raw references", async () => {
  await render(<CircularProgressFixture />)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Prepare CircularProgress checks" }))
  for (const [index, current] of CIRCULAR_NATIVE_CASES.entries()) {
    if (index) await user.press(screen.getByRole("button", { name: "Next CircularProgress check" }))
    const marker = JSON.parse(screen.getByTestId("circular-native-state").props.accessibilityLabel)
    expect(marker).toMatchObject({ index, case: current.name, value: current.props.value ?? 25 })
    expect(screen.getByTestId("circular-native-reference")).toBeOnTheScreen()
    expect(screen.queryByText("Semantic node stays unmounted")).toBeNull()
    expect(screen.getByTestId("circular-native-reference-path", hidden).props.d).toBe(
      screen.getByTestId("circular-native-target-path", hidden).props.d,
    )
    if (index === 13) {
      expect(screen.getByTestId("circular-native-target")).toHaveStyle({ width: 100, opacity: 0.8 })
      expect(screen.getByTestId("circular-native-target-path", hidden).props.strokeDashoffset).not.toBe(0)
    }
    if (index === 16) expect(screen.getByTestId("circular-native-target")).toHaveAccessibilityValue({ text: "13%" })
    if (index === 18)
      expect(screen.getByTestId("circular-native-target")).toHaveAccessibilityValue({ text: "[object Object]" })
    if (index === 19) expect(screen.getByTestId("circular-native-target").props.accessibilityValue.now).toBeUndefined()
  }
})

it("delivers the actual scheduled superseding values, retirement and fresh zero, and cancels timers on unmount", async () => {
  const result = await render(<CircularProgressFixture />)
  const user = userEvent.setup()
  await user.press(screen.getByRole("button", { name: "Prepare CircularProgress checks" }))
  await user.press(screen.getByRole("button", { name: "Arm CircularProgress interruption and retirement" }))
  await act(() => jest.advanceTimersByTime(3100))
  expect(screen.getByTestId("circular-native-target")).toHaveAccessibilityValue({ now: 10 })
  await act(() => jest.advanceTimersByTime(3200))
  expect(screen.queryByTestId("circular-native-target")).toBeNull()
  await act(() => jest.advanceTimersByTime(1300))
  expect(screen.getByTestId("circular-native-target")).toHaveAccessibilityValue({ now: 0 })
  const marker = JSON.parse(screen.getByTestId("circular-native-state").props.accessibilityLabel)
  expect(marker.scheduled.map((row: { kind: string }) => row.kind)).toEqual([
    "to-full",
    "supersede-ten",
    "to-sixty",
    "to-twenty",
    "to-ninety",
    "retire",
    "reinsert-zero",
  ])
  await user.press(screen.getByRole("button", { name: "Arm CircularProgress interruption and retirement" }))
  await result.unmount()
  await act(() => jest.runOnlyPendingTimers())
})
