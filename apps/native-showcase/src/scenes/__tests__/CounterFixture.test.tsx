import { act, render, screen, userEvent } from "@testing-library/react-native"
import { AccessibilityInfo } from "react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { COUNTER_NATIVE_CASES } from "../CounterFixture"
import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Circular/Counter scene")
  await press("Prepare Counter checks")
  return press
}
const state = () => JSON.parse(screen.getByTestId("counter-native-state").props.accessibilityLabel)

it("prepares every selected Counter case with real raw values and independent native references", async () => {
  const press = await enter()
  for (const current of COUNTER_NATIVE_CASES) {
    expect(state().case).toBe(current.name)
    expect(screen.getByTestId("counter-native-target-value").props.children).toBe(current.props.value ?? 25)
    expect(screen.getByTestId("counter-native-reference-value").props.children).toBe(current.props.value ?? 25)
    if (["warning", "danger"].includes(current.name)) {
      const color = current.name === "warning" ? "#a66b00" : "#b73434"
      expect(screen.getByTestId("counter-native-target-value")).toHaveStyle({ color })
      expect(screen.getByTestId("counter-native-reference-value")).toHaveStyle({ color })
    }
    if (current.name === "numeric-max-zero") expect(screen.queryByTestId("counter-native-target-max")).toBeNull()
    if (current.name === "string-max-zero")
      expect(screen.getByTestId("counter-native-target-max")).toHaveTextContent("/0")
    if (current.name === "three-slots") {
      expect(screen.getByTestId("counter-native-target-value")).toHaveStyle({
        color: "#087f8c",
        fontSize: 18,
        fontWeight: "700",
        letterSpacing: 0,
      })
      expect(screen.getByTestId("counter-native-child")).toHaveStyle({ fontStyle: "italic", letterSpacing: 2 })
    } else expect(screen.getByTestId("counter-native-empty-child")).toHaveStyle({ width: 20, height: 20 })
    await press("Next Counter check")
  }
  expect(state().case).toBe("baseline")
})

it("schedules interrupted Counter color changes and actual removal/fresh insertion, then cancels on reset", async () => {
  const press = await enter()
  await press("Arm Counter color interruption and retirement")
  await act(() => jest.advanceTimersByTime(6350))
  expect(screen.queryByTestId("counter-native-target")).toBeNull()
  expect(state().scheduled.map((row: { kind: string }) => row.kind)).toEqual([
    "red",
    "supersede-green",
    "blue",
    "red-again",
    "green-again",
    "retire",
  ])
  await act(() => jest.advanceTimersByTime(1300))
  expect(screen.getByTestId("counter-native-target-value")).toHaveTextContent("25")
  expect(state().motionColor).toBe("#087f8c")
  await press("Prepare Counter checks")
  await act(() => jest.advanceTimersByTime(8000))
  expect(state().scheduled).toEqual([])
  expect(state().case).toBe("baseline")
})
