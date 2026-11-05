import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"
import { StepperScene } from "../StepperScene"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 17)
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
  const press = (name: string) => user.press(screen.getByRole("button", { name }))
  await press("Stepper scene")
  return press
}
const editor = () => screen.getByTestId("stepper-example-input")
const root = () => screen.getByTestId("stepper-example")
const read = (id: string) => JSON.parse(screen.getByTestId(id).children.join(""))
const callbacks = (): { generation: number; kind: string; data: unknown }[] => read("stepper-callbacks")
const requests = () =>
  callbacks()
    .filter(({ kind }) => kind === "request")
    .map(({ data }) => data)
const plus = () => screen.getByRole("button", { name: "Increase controlled quantity" })
const minus = () => screen.getByRole("button", { name: "Decrease controlled quantity" })
const unchanged = (value: string) =>
  expect(
    screen.getByTestId("stepper-state").children.join("").startsWith(`Value: ${value}. Request: none. Requests: 0.`),
  ).toBe(true)

it.each([
  ["upper", "Set stepper maximum", "1", "1", true],
  ["lower", "Set stepper minimum", "-1", "\u22121", false],
] as const)(
  "S02.bound-%s blocks the outward button and retains the enabled inward target",
  async (_side, action, raw, ax, upper) => {
    const press = await enter()
    await press(action)
    const original = editor()
    const config = read("stepper-config")
    const refs = read("stepper-refs")
    const outward = upper ? plus() : minus()
    const inward = upper ? minus() : plus()
    expect(outward).toBeDisabled()
    expect(inward).not.toBeDisabled()
    await press(upper ? "Increase controlled quantity" : "Decrease controlled quantity")
    unchanged(raw)
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe(raw)
    expect(editor().props.accessibilityValue.text).toBe(ax)
    expect(read("stepper-config")).toEqual(config)
    expect(read("stepper-refs")).toEqual(refs)
    expect(callbacks()).toEqual([])
    expect(inward).not.toBeDisabled()
  },
)

it.each([
  ["disabled-increase", false, true],
  ["disabled-decrease", false, false],
  ["read-only-increase", true, true],
  ["read-only-decrease", true, false],
] as const)(
  "S02.guard-%s retains value and emits no prohibited edit or numeric request",
  async (_route, readOnly, increase) => {
    const press = await enter()
    await press(readOnly ? "Toggle stepper read-only" : "Toggle stepper disabled")
    const original = editor()
    const config = read("stepper-config")
    const refs = read("stepper-refs")
    expect(editor().props.editable).toBe(false)
    expect(editor().props.focusable).toBe(readOnly)
    expect(increase ? plus() : minus()).toBeDisabled()
    await press(increase ? "Increase controlled quantity" : "Decrease controlled quantity")
    unchanged("0")
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe("0")
    expect(read("stepper-config")).toEqual(config)
    expect(read("stepper-refs")).toEqual(refs)
    expect(callbacks()).toEqual([])
  },
)

const scopeStatus = async (ready: boolean) => {
  const host = root().props
  await act(() =>
    host.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host.ownerId,
        windowId: "s02-scene-window",
        epoch: 1,
        policyRevision: host.policyRevision,
        ready,
        windowActive: ready,
      },
    }),
  )
}
const event = {
  persist: () => undefined,
  currentTarget: 17,
  target: 17,
  nativeEvent: { target: 17, timestamp: 1, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
}
const beginDirtyHold = async () => {
  await render(<StepperScene />)
  await fireEvent(editor(), "focus", { nativeEvent: { target: 17 } })
  await fireEvent(editor(), "change", { nativeEvent: { text: "0.3", eventCount: 1, target: 17 } })
  await fireEvent.changeText(editor(), "0.3")
  await scopeStatus(false)
  await scopeStatus(true)
  const metadata = {
    nativeEvent: {
      ownerId: plus().props.ownerId,
      bindingId: plus().props.nativeResponderCohortBinding,
      target: 9,
      sourceTarget: 17,
      surfaceId: 1,
      identifier: 0,
      cycleId: 1,
      cohort: "touch",
      phase: "start",
      scopeOwnerId: root().props.ownerId,
      windowId: "s02-scene-window",
      epoch: root().props.acceptedEpoch,
    },
  }
  await fireEvent(plus(), "nativeResponderCohort", metadata)
  await fireEvent(plus(), "responderGrant", event)
  await act(() => jest.advanceTimersByTime(599))
  expect(requests()).toEqual([])
  expect(editor().props.value).toBe("0.3")
  return metadata
}

it("S02 mock-admission positive control has a pending dirty touch tick at599ms and steps at600/660ms", async () => {
  await beginDirtyHold()
  await act(() => jest.advanceTimersByTime(1))
  expect(requests()).toEqual([0.4])
  await act(() => jest.advanceTimersByTime(60))
  expect(requests()).toEqual([0.4, 0.5])
  await fireEvent(plus(), "responderRelease", event)
  await act(() => jest.advanceTimersByTime(1500))
  expect(requests()).toEqual([0.4, 0.5])
})

it.each(["responder-interruption", "window-deactivation"] as const)(
  "S02.cancel-%s before first admitted mock tick cannot revive a release or timer",
  async (route) => {
    const metadata = await beginDirtyHold()
    const original = editor()
    const refs = read("stepper-refs")
    const before = callbacks()
    if (route === "responder-interruption") {
      await fireEvent(plus(), "nativeResponderCohort", {
        nativeEvent: { ...metadata.nativeEvent, phase: "cancel" },
      })
      await fireEvent(plus(), "responderTerminate", event)
    } else {
      await scopeStatus(false)
      await scopeStatus(true)
    }
    await act(() => jest.advanceTimersByTime(1500))
    if (route === "window-deactivation") await fireEvent(plus(), "responderRelease", event)
    await act(() => jest.advanceTimersByTime(1500))
    unchanged("0")
    expect(requests()).toEqual([])
    expect(editor()).toBe(original)
    expect(editor().props.value).toBe("0.3")
    expect(read("stepper-refs")).toEqual(refs)
    expect(callbacks()).toEqual(before)
  },
)
