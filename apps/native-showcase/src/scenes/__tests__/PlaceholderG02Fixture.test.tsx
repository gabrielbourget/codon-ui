import { act, fireEvent, render, screen } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

type TState = {
  contentMode: string
  rootTag: number | null
  refIdentity: number | null
  attaches: number
  detaches: number
  actions: number
  longActions: number
  dropped: number
  receipts: {
    kind: string
    callback: string
    eventIdentity: number
    nativeIdentity: number
    afterDetach: boolean
    native: { target: number; timestamp: number }
  }[]
}
const state = (): TState => JSON.parse(screen.getByTestId("placeholder-g02-state").props.accessibilityLabel)
const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const enter = async () => {
  await render(
    <SafeAreaInsetsContext.Provider value={{ top: 20, bottom: 10, left: 0, right: 0 }}>
      <NativeShowcase />
    </SafeAreaInsetsContext.Provider>,
  )
  await press("Text/Button scene")
  await press("G02 prepare placeholder")
}

it("exposes the actual public placeholder owner content and ref through falsy, deferred and removed content without fabricating actions", async () => {
  await enter()
  const original = screen.getByTestId("library-placeholder")
  const initial = state()
  expect(initial.refIdentity).not.toBeNull()
  for (const [mode, content] of [
    ["zero", "0"],
    ["empty", ""],
    ["false", ""],
    ["null", ""],
    ["restored", "Restored owner content"],
  ]) {
    await press("G02 next placeholder content")
    expect(state().contentMode).toBe(mode)
    expect(screen.getByTestId("library-placeholder")).toBe(original)
    expect(original).toHaveTextContent(content, { exact: true })
    expect(state().refIdentity).toBe(initial.refIdentity)
    expect(state().receipts).toEqual([])
  }
  await press("G02 deferred placeholder content")
  expect(original).toHaveTextContent("Deferred owner content", { exact: true })
  expect(state().refIdentity).toBe(initial.refIdentity)
  await press("G02 remove placeholder")
  expect(screen.queryByTestId("library-placeholder")).toBeNull()
  expect(state().rootTag).toBeNull()
  expect(state().refIdentity).toBeNull()
  expect(state().detaches).toBe(initial.detaches + 1)
  await press("G02 reinsert placeholder")
  expect(screen.getByTestId("library-placeholder")).toHaveTextContent("Deferred owner content", { exact: true })
  expect(state().refIdentity).not.toBeNull()
  expect(state().refIdentity).not.toBe(initial.refIdentity)
  expect(state().attaches).toBe(initial.attaches + 1)
  expect(state().receipts).toEqual([])
  expect(state().dropped).toBe(0)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 0/)
})

it("records current callback ownership and original event identities without inferring real native activation or selection", async () => {
  await enter()
  const original = screen.getByTestId("library-placeholder")
  const event = { nativeEvent: { target: 17, timestamp: 100, pageX: 30, pageY: 40 } }
  for (const phase of ["pressIn", "pressOut", "press"]) await fireEvent(original, phase, event)
  expect(state().receipts.map((row) => row.kind)).toEqual(["pressIn", "pressOut", "press"])
  expect(state().receipts.map((row) => row.callback)).toEqual(["original", "original", "original"])
  expect(new Set(state().receipts.map((row) => row.eventIdentity)).size).toBe(1)
  expect(new Set(state().receipts.map((row) => row.nativeIdentity)).size).toBe(1)
  expect(state().receipts[2].native).toEqual({ target: 17, timestamp: 100, pageX: 30, pageY: 40 })
  await press("G02 replacement placeholder callback")
  await fireEvent(original, "press", event)
  expect(state().receipts.at(-1)?.callback).toBe("replacement")
  expect(state().actions).toBe(2)
  await press("G02 absent placeholder callback")
  expect(screen.getByTestId("library-placeholder").props.onPress).toBeUndefined()
  await press("G02 original placeholder callback")
  await press("G02 toggle placeholder long press")
  await fireEvent(screen.getByTestId("library-placeholder"), "longPress", event)
  expect(state().longActions).toBe(1)
  await press("G02 toggle placeholder disabled")
  expect(screen.getByTestId("library-placeholder").props.disabled).toBe(true)
  await press("G02 toggle placeholder disabled")
  expect(screen.getByTestId("library-placeholder").props.disabled).toBe(false)
  await press("G02 default placeholder selection")
  expect(screen.getByTestId("library-placeholder").props.selectable).toBe(true)
  await press("G02 toggle placeholder label intent")
  expect(screen.getByTestId("library-placeholder").props.selectable).toBe(false)
  await press("G02 enable placeholder selection")
  expect(screen.getByTestId("library-placeholder").props.selectable).toBe(true)
})

it("makes held removal visible and retains an injected late action as a failing-native negative control", async () => {
  await enter()
  const original = screen.getByTestId("library-placeholder")
  const captured = original.props.onPress
  const event = { nativeEvent: { target: 17, timestamp: 100 } }
  await press("G02 placeholder remove on press in")
  await fireEvent(original, "pressIn", event)
  expect(screen.queryByTestId("library-placeholder")).toBeNull()
  expect(state().receipts.map((row) => row.kind)).toEqual(["pressIn"])
  expect(state().actions).toBe(0)
  // This deliberately bypasses native delivery. The observer must expose, rather than suppress, it.
  await act(() => captured(event))
  expect(state().receipts.at(-1)).toMatchObject({ kind: "press", afterDetach: true, callback: "original" })
  expect(state().actions).toBe(1)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/Library action count: 1/)
})
