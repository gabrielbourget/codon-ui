import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

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
const read = (id: string) => JSON.parse(screen.getByTestId(id).children.join(""))
const requests = () => read("stepper-callbacks").filter(({ kind }: { kind: string }) => kind === "request")
const armPendingSourceHold = async () => {
  for (const ready of [false, true]) {
    const host = screen.getByTestId("stepper-example").props
    await act(() =>
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "s06-source-model-window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  // Source model only. This is never a genuine installed native input/retirement witness.
  await fireEvent(screen.getByRole("button", { name: "Increase controlled quantity" }), "responderGrant", {
    persist: () => undefined,
    currentTarget: 17,
    target: 17,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
  })
}

it.each([
  [1, "disabled"],
  [2, "read-only"],
  [3, "remove"],
] as const)(
  "S06 source hold retirement %s (%s) preserves the one first request and retires future timer work",
  async (count, retirement) => {
    const press = await enter()
    for (let index = 0; index < count; index += 1) await press("Next stepper retirement on request")
    const originalRefs = read("stepper-refs")
    await fireEvent.changeText(editor(), "0.3")
    expect(requests()).toEqual([])
    await armPendingSourceHold()
    await act(() => jest.advanceTimersByTime(600))
    expect(requests()).toEqual([{ generation: 0, kind: "request", data: 0.4 }])
    expect(read("stepper-config")).toMatchObject({
      mounted: retirement !== "remove",
      retireOnRequest: "none",
      generation: 0,
    })
    if (retirement === "remove") {
      expect(screen.queryByTestId("stepper-example-input")).toBeNull()
      expect(read("stepper-refs")).toEqual({
        attached: false,
        attachments: originalRefs.attachments,
        detachments: originalRefs.detachments + 1,
      })
    } else {
      expect(editor()).toHaveDisplayValue("0.4")
      expect(screen.getByRole("button", { name: "Increase controlled quantity" })).toBeDisabled()
      expect(screen.getByRole("button", { name: "Decrease controlled quantity" })).toBeDisabled()
      expect(read("stepper-refs")).toEqual(originalRefs)
    }
    const afterRetirement = read("stepper-callbacks")
    await act(() => jest.advanceTimersByTime(1500))
    expect(read("stepper-callbacks")).toEqual(afterRetirement)
    expect(screen.getByTestId("stepper-state")).toHaveTextContent(/Value: 0.4.*Requests: 1/)
  },
)

it.each([false, true])(
  "S06 source editor replacement=%s retires a pending source hold and isolates the new generation",
  async (replacement) => {
    const press = await enter()
    const originalRefs = read("stepper-refs")
    await fireEvent.changeText(editor(), "0.3")
    const before = read("stepper-callbacks")
    await armPendingSourceHold()
    await press(replacement ? "Remount stepper editor" : "Remove or reinsert stepper editor")
    await act(() => jest.advanceTimersByTime(1500))
    expect(requests()).toEqual([])
    if (!replacement) {
      expect(screen.queryByTestId("stepper-example-input")).toBeNull()
      expect(read("stepper-config")).toMatchObject({ mounted: false, generation: 0 })
      await press("Remove or reinsert stepper editor")
    }
    expect(read("stepper-config")).toMatchObject({ mounted: true, generation: 1 })
    expect(read("stepper-refs")).toEqual({
      attached: true,
      attachments: originalRefs.attachments + 1,
      detachments: originalRefs.detachments + 1,
    })
    expect(editor()).toHaveDisplayValue("0")
    expect(read("stepper-callbacks")).toEqual(before)
    await act(() => jest.advanceTimersByTime(1500))
    expect(read("stepper-callbacks")).toEqual(before)
    await press("Increase controlled quantity")
    expect(requests()).toEqual([{ generation: 1, kind: "request", data: 0.1 }])
  },
)

it("S06 source whole-scene retirement before the first tick preserves a late original-selection negative control and isolates the new owner", async () => {
  const press = await enter()
  await press("Arm stepper scene teardown observation")
  const retiredOwner = read("stepper-teardown").owner
  const lateSelection = editor().props.onSelectionChange
  await armPendingSourceHold()
  await press("Reset scene")
  await act(() => jest.advanceTimersByTime(1500))
  // Deliberately invoke only the retained fixture callback: visibility, never installed native proof.
  await act(() => lateSelection({ nativeEvent: { target: 17, selection: { start: 0, end: 0 } } }))
  await press("Stepper scene")
  expect(read("stepper-teardown")).toEqual({
    owner: retiredOwner,
    unmounted: true,
    callbacks: [{ generation: 0, kind: "native:selection", data: { start: 0, end: 0 }, afterUnmount: true }],
  })
  expect(requests()).toEqual([])
  expect(editor()).toHaveDisplayValue("0")
  await press("Increase controlled quantity")
  await press("Read stepper scene teardown observation")
  expect(requests()).toEqual([{ generation: 0, kind: "request", data: 0.1 }])
  expect(read("stepper-teardown").callbacks).toEqual([
    { generation: 0, kind: "native:selection", data: { start: 0, end: 0 }, afterUnmount: true },
  ])
})
