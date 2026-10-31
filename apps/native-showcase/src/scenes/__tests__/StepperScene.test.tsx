import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Dimensions } from "react-native"
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
  await press("Stepper scene")
  return press
}
const editor = () => screen.getByTestId("stepper-example-input")
const state = () => screen.getByTestId("stepper-state")
const plus = () => screen.getByRole("button", { name: "Increase controlled quantity" })

it("retains controlled requests and veto through theme/window/fixture changes and explicit reset", async () => {
  const press = await enter()
  await press("Increase controlled quantity")
  expect(state()).toHaveTextContent(/Value: 0.1.*Request: 0.1.*Requests: 1/)
  await press("Toggle stepper owner veto")
  await press("Increase controlled quantity")
  await press("Increase controlled quantity")
  expect(state()).toHaveTextContent(/Value: 0.1.*Request: 0.2.*Requests: 3/)
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(editor()).toHaveDisplayValue("0.1")
  expect(state()).toHaveTextContent(/Requests: 3.*Parent: veto/)
  await press("Reset scene")
  await press("Stepper scene")
  expect(state()).toHaveTextContent(/Value: 0.*Request: none.*Requests: 0.*Parent: echo.*Type: segmented/)
})

it("commits the native draft, preserves empty/zero, and exercises every style owner and presentation control", async () => {
  const press = await enter()
  await fireEvent.changeText(editor(), "0.3")
  await fireEvent(editor(), "endEditing", { nativeEvent: { text: "0.4" } })
  expect(state()).toHaveTextContent(/Value: 0.4.*Requests: 1.*Raw: 0.3/)
  await press("Set stepper empty")
  expect(editor()).toHaveDisplayValue("")
  await press("Increase controlled quantity")
  expect(editor()).toHaveDisplayValue("-1")
  await press("Set stepper zero")
  await press("Toggle stepper type")
  await press("Toggle stepper orientation")
  await press("Toggle stepper color mode")
  await press("Next stepper order")
  await press("Next stepper geometry")
  await press("Next stepper text size")
  await press("Next stepper status")
  await press("Toggle stepper styles")
  await press("Toggle stepper icons")
  await press("Toggle stepper locale")
  expect(state()).toHaveTextContent(
    /Value: 0.*Type: cohesive.*Orientation: vertical.*Mode: outline.*Order: primary.*Geometry: rounded.*Size: small.*Locale: fr-CA.*Status: error/,
  )
  expect(screen.getByTestId("stepper-example")).toHaveStyle({ padding: 8, borderWidth: 2 })
  expect(screen.getByTestId("stepper-example-group")).toHaveStyle({ gap: 12, flexDirection: "column-reverse" })
  expect(editor()).toHaveStyle({ fontSize: 18, maxWidth: 80 })
  expect(plus()).toHaveStyle({ width: 44, height: 44, paddingHorizontal: 0, borderRadius: 5 })
  expect(screen.getByText("+", { includeHiddenElements: true })).toBeOnTheScreen()
  await press("Toggle stepper zero width")
  expect(screen.getByTestId("stepper-example")).toHaveStyle({ width: 0 })
  await fireEvent(screen.getByTestId("stepper-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 10 } },
  })
  expect(screen.getByTestId("stepper-frame")).toHaveTextContent(/0 x 10/)
})

it("observes held veto requests and retires repeat on owner guard takeover", async () => {
  const press = await enter()
  await press("Toggle stepper owner veto")
  const event = { nativeEvent: { timestamp: 1 }, persist: () => undefined }
  await fireEvent(plus(), "pressIn", event)
  await act(() => jest.advanceTimersByTime(600))
  await act(() => jest.advanceTimersByTime(60))
  expect(state()).toHaveTextContent(/Value: 0.*Request: 0.1.*Requests: 2/)
  await press("Toggle stepper read-only")
  const countAtTakeover = Number(
    state()
      .children.join("")
      .match(/Requests: (\d+)/)?.[1],
  )
  expect(countAtTakeover).toBeGreaterThanOrEqual(2)
  await act(() => jest.advanceTimersByTime(1000))
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}.*Guard: read-only`))
  expect(plus()).toBeDisabled()
  await press("Toggle stepper read-only")
  await fireEvent(plus(), "pressOut", event)
  await fireEvent.press(plus(), event)
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}`))
  await press("Toggle stepper disabled")
  expect(editor().props.editable).toBe(false)
  await press("Set stepper maximum")
  expect(editor()).toHaveDisplayValue("1")
  expect(state()).toHaveTextContent(new RegExp(`Requests: ${countAtTakeover}`))
})
