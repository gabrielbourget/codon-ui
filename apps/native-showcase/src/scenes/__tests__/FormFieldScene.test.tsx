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
  const press = async (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Form field scene")
  return press
}

it("retains caller input and keyed help state through messages, themes, fixtures and live windows, then resets", async () => {
  const press = await enter()
  await fireEvent.changeText(screen.getByTestId("field-editor"), "caller@example.test")
  await press("Field help, count 0")
  await press("Next field messages")
  await press("Next field label")
  await press("Dark theme")
  await press("Vertical blocked region")
  await act(() =>
    Dimensions.set({
      window: { width: 844, height: 390, scale: 1, fontScale: 1 },
      screen: { width: 844, height: 390, scale: 1, fontScale: 1 },
    }),
  )
  expect(screen.getByTestId("field-editor")).toHaveDisplayValue("caller@example.test")
  expect(screen.getByRole("button", { name: "Field help, count 1" })).toBeOnTheScreen()
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Requests: 1.*Messages: all.*Help actions: 1/)
  expect(screen.getAllByTestId("form-field-error-messages")).toHaveLength(2)
  await press("Reset scene")
  await press("Form field scene")
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Owner: "".*Requests: 0.*Messages: none.*Help actions: 0/)
  expect(screen.getByRole("button", { name: "Field help, count 0" })).toBeOnTheScreen()
})

it("preserves repeated owner veto, explicit empty state and the child editor's independent guards", async () => {
  const press = await enter()
  await press("Toggle field request veto")
  await fireEvent.changeText(screen.getByTestId("field-editor"), "first")
  await fireEvent.changeText(screen.getByTestId("field-editor"), "second")
  expect(screen.getByTestId("field-editor")).toHaveDisplayValue("")
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Request: "second".*Requests: 2.*Veto: true/)
  await press("Toggle field request veto")
  await fireEvent.changeText(screen.getByTestId("field-editor"), "accepted")
  await press("Toggle field editor disabled")
  await fireEvent.changeText(screen.getByTestId("field-editor"), "blocked disabled")
  await press("Toggle field editor disabled")
  await press("Toggle field editor read only")
  await fireEvent.changeText(screen.getByTestId("field-editor"), "blocked read only")
  expect(screen.getByTestId("field-editor")).toHaveDisplayValue("accepted")
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Requests: 3/)
  await press("Clear field owner")
  expect(screen.getByTestId("field-editor")).toHaveDisplayValue("")
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Requests: 3/)
})

it("exercises empty arrays, primitive content, eight styles, label ownership, zero frames and native receipts", async () => {
  const press = await enter()
  await press("Next field right content")
  expect(screen.queryByTestId("form-field-bottom-row")).toBeNull()
  expect(screen.getByTestId("form-field-top-right-content")).toHaveTextContent("0")
  await press("Next field messages")
  expect(screen.getByTestId("form-field-bottom-right-content")).toHaveTextContent("0")
  await press("Next field messages")
  expect(screen.getByTestId("form-field-bottom-row")).toBeOnTheScreen()
  expect(screen.queryAllByTestId(/form-field-(error|warning|success)-messages/)).toHaveLength(0)
  await press("Toggle field styles")
  expect(screen.getByTestId("field-example")).toHaveStyle({ padding: 5, borderWidth: 1 })
  expect(screen.getByTestId("form-field-top-row")).toHaveStyle({ gap: 8, paddingVertical: 4 })
  expect(screen.getByTestId("form-field-label")).toHaveStyle({ fontSize: 16, fontWeight: "bold" })
  expect(screen.getByTestId("form-field-top-right-content")).toHaveStyle({ padding: 2 })
  expect(screen.getByTestId("form-field-bottom-row")).toHaveStyle({ gap: 8, padding: 2 })
  expect(screen.getByTestId("form-field-bottom-right-content")).toHaveStyle({ maxWidth: 100 })
  expect(screen.getByTestId("form-field-validation-messages")).toHaveStyle({ fontSize: 14, gap: 3 })
  expect(screen.getByTestId("form-field-description")).toHaveStyle({ fontSize: 14, fontStyle: "normal" })
  await press("Toggle field native label relationship")
  expect(screen.getByTestId("field-editor").props.accessibilityLabelledBy).toBe("field-example-label")
  await press("Toggle field focus target")
  expect(screen.getByTestId("form-field-label").props.onPress).toBeUndefined()
  await press("Toggle field required marker")
  expect(screen.getByTestId("form-field-required-indicator")).toHaveTextContent("")
  await press("Toggle field description")
  expect(screen.queryByTestId("form-field-description")).toBeNull()
  await press("Toggle field raised")
  expect(screen.getByTestId("field-example").props.style.boxShadow).toHaveLength(2)
  await press("Toggle field zero dimensions")
  expect(screen.getByTestId("field-example")).toHaveStyle({ width: 0, height: 0, padding: 0, borderWidth: 0 })
  await fireEvent(screen.getByTestId("field-example"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
  })
  expect(screen.getByTestId("field-frames")).toHaveTextContent(/root 0 x 0/)
  await fireEvent(screen.getByTestId("field-editor"), "focus", { nativeEvent: { target: 1 } })
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Focus events: 1/)
  expect(screen.getByTestId("field-state")).toHaveTextContent(/Owner: "".*Requests: 0/)
})
