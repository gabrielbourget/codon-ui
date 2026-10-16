import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { Profiler } from "react"

import { App, CASES } from "./App"

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native")
  return { SafeAreaProvider: View, SafeAreaView: View }
})
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
jest.setTimeout(15000)
const press = async (name: string) => userEvent.setup().press(screen.getByRole("button", { name }))

it.each(CASES)(
  "retains authoritative %s ownership, native observers, stable refs and default keyboard options",
  async (kind) => {
    await render(<App />)
    await press(`Case ${kind}`)
    await press("Choose")
    const field = screen.getByTestId("diag-field-input")
    for (const key of ["autoCorrect", "spellCheck", "autoCapitalize"]) expect(field.props[key]).toBeUndefined()
    await fireEvent(field, "focus", { nativeEvent: {} })
    await fireEvent(field, "change", { nativeEvent: { text: "Native query text", eventCount: 1 } })
    await fireEvent.changeText(field, "Native query text")
    if (kind !== "combo") await fireEvent(field, "keyPress", { nativeEvent: { key: "t" } })
    await act(() => jest.advanceTimersByTime(150))
    const state = JSON.parse(screen.getByTestId("diag-field-option-string:status").props.accessibilityLabel.slice(4))
    expect(state).toMatchObject({
      query: "Native query text",
      callback: "Native query text",
      committed: "Native query text",
      native: { text: "Native query text", count: 1 },
      focused: true,
      requests: { selection: 0, closes: 0 },
    })
    await fireEvent(field, "endEditing", { nativeEvent: { text: "observed final text" } })
    expect(screen.getByTestId("diag-field-input").props.value).toBe("Native query text")
    await press("Close choices")
    await press("Export diagnostic trace")
    const trace = JSON.parse(screen.getByTestId("diag-trace-json").props.accessibilityLabel.slice(6))
    expect(trace.observation.query).toBe("Native query text")
    expect(trace.events.filter((event: { kind: string }) => event.kind === "ref-attach")).toHaveLength(1)
    expect(trace.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "callback", text: "Native query text" }),
        expect.objectContaining({ kind: "owner-commit", text: "Native query text" }),
        expect.objectContaining({
          kind: "native-change",
          text: "Native query text",
          detail: expect.objectContaining({ eventCount: 1 }),
        }),
        expect.objectContaining({ kind: "end-editing", text: "observed final text" }),
      ]),
    )
    expect(trace.events.some((event: { kind: string }) => event.kind === "key")).toBe(kind !== "combo")
    expect(trace.heartbeats.length).toBeGreaterThan(0)
  },
)

it("keeps heartbeat storage out of React commits and the visible tree", async () => {
  const commit = jest.fn()
  await render(
    <Profiler id="diagnostic" onRender={commit}>
      <App />
    </Profiler>,
  )
  await press("Case raw")
  await press("Choose")
  await act(() => jest.advanceTimersByTime(150))
  const before = screen.getByTestId("diag-field-option-string:status").props.accessibilityLabel
  const count = commit.mock.calls.length
  expect(count).toBeGreaterThan(0)
  await act(() => jest.advanceTimersByTime(500))
  expect(commit).toHaveBeenCalledTimes(count)
  expect(screen.getByTestId("diag-field-option-string:status").props.accessibilityLabel).toBe(before)
  await press("Close choices")
  await press("Export diagnostic trace")
  const trace = JSON.parse(screen.getByTestId("diag-trace-json").props.accessibilityLabel.slice(6))
  expect(trace.heartbeats.length).toBeGreaterThanOrEqual(5)
  expect(trace.observation.query).toBe("")
})
