import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  const user = userEvent.setup()
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Select scene")
  await press("Prepare standalone ListBoxItem checks")
  return press
}
const state = () => JSON.parse(screen.getByTestId("list-item-native-state").props.accessibilityLabel)
const target = () => screen.getByTestId("list-item-native-target")

it("prepares ListBoxItem native ownership with copied original events, typed keys and held cancellation", async () => {
  const press = await enter()
  const event = { target: 81, currentTarget: 81, nativeEvent: { layout: { x: 12, y: 12, width: 200, height: 44 } } }
  await fireEvent(target(), "layout", event)
  event.nativeEvent.layout.width = 999
  expect(state().layouts.at(-1)).toEqual({
    target: 81,
    currentTarget: 81,
    layout: { x: 12, y: 12, width: 200, height: 44 },
  })
  await fireEvent.press(target(), { target: 81, currentTarget: 81, nativeEvent: { timestamp: 100 } })
  expect(state()).toMatchObject({ actions: 1, selected: false })
  await press("Next ListBoxItem check")
  await fireEvent.press(target(), { target: 81, currentTarget: 81, nativeEvent: { timestamp: 101 } })
  expect(state()).toMatchObject({ actions: 2, selected: true })
  await press("Next ListBoxItem check")
  expect(state()).toMatchObject({ id: "0", keyType: "string" })
  await press("Next ListBoxItem check")
  expect(state().id).toBe("")
  for (let index = 0; index < 4; index++) await press("Next ListBoxItem check")
  await fireEvent(target(), "pressIn", { target: 81, currentTarget: 81, nativeEvent: {} })
  expect(state()).toMatchObject({ canceled: true, disabled: true, actions: 2 })
})

it("prepares ListBoxItem style precedence, explicit zero and narrow long text with independent references", async () => {
  const press = await enter()
  await press("ListBoxItem style checks")
  for (let index = 0; index < 5; index++) await press("Next ListBoxItem check")
  await act(() => jest.advanceTimersByTime(1000))
  expect(target()).toHaveStyle({ backgroundColor: "#117733", borderWidth: 2 })
  expect(screen.getByTestId("list-item-native-reference")).toHaveStyle({ backgroundColor: "#117733", borderWidth: 2 })
  for (let index = 0; index < 4; index++) await press("Next ListBoxItem check")
  expect(state()).toMatchObject({ narrow: true, width: 96 })
  expect(target()).toHaveStyle({ width: 96 })
  for (let index = 0; index < 5; index++) await press("Next ListBoxItem check")
  expect(target()).toHaveStyle({ width: 0, height: 0, padding: 0, overflow: "hidden" })
})

it("prepares ListBoxItem real motion cue, retarget and retirement without fabricating preference events", async () => {
  const press = await enter()
  await press("ListBoxItem motion checks")
  await press("Arm ListBoxItem motion and retirement")
  await act(() => jest.advanceTimersByTime(4300))
  expect(screen.queryByTestId("list-item-native-target")).toBeNull()
  expect(state().motionTrace.map((row: { name: string }) => row.name)).toEqual([
    "select",
    "interrupt",
    "retarget",
    "retire",
  ])
  await act(() => jest.advanceTimersByTime(700))
  expect(target()).toBeOnTheScreen()
  expect(state().motionTrace.at(-1).name).toBe("fresh")
})
