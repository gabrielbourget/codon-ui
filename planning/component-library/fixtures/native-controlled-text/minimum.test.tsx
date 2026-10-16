import { fireEvent, render, screen } from "@testing-library/react-native"

import { App } from "./MinimumRawApp"

it.each(["parent", "local"])("preserves raw controlled text and committed %s ownership", async (owner) => {
  await render(<App />)
  await fireEvent.press(screen.getByTestId(`${owner}-owner`))
  const field = screen.getByTestId("raw-note")
  expect(field.props.autoCorrect).toBeUndefined()
  expect(field.props.spellCheck).toBeUndefined()
  await fireEvent(field, "change", { nativeEvent: { text: "Native alert note", eventCount: 17 } })
  await fireEvent.changeText(field, "Native alert note")
  await fireEvent(field, "keyPress", { nativeEvent: { key: "e" } })
  await fireEvent(field, "endEditing", { nativeEvent: { text: "Native alert note" } })
  expect(screen.getByTestId("raw-note").props.value).toBe("Native alert note")
  await fireEvent.press(screen.getByRole("button", { name: "Capture diagnostic trace" }))
  const trace = JSON.parse(screen.getByTestId("diagnostic-events").props.accessibilityLabel)
  expect(trace).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "owner-commit", value: "Native alert note", detail: { owner } }),
      expect.objectContaining({ kind: "native-change", value: "Native alert note", detail: { eventCount: 17 } }),
      expect.objectContaining({ kind: "key", value: "e" }),
      expect.objectContaining({ kind: "end-editing", value: "Native alert note" }),
      expect.objectContaining({
        kind: "capture",
        detail: expect.objectContaining({ owner, controlledValue: "Native alert note" }),
      }),
    ]),
  )
})
