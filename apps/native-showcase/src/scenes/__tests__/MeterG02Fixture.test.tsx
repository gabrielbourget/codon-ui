import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { MeterG02Fixture } from "../MeterG02Fixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 71)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const target = () => screen.getByTestId("meter-g02-target")
const state = () => JSON.parse(screen.getByTestId("meter-g02-state").props.accessibilityLabel)
const prepare = async () => {
  await render(<MeterG02Fixture />)
  expect(screen.queryByTestId("meter-g02-target")).toBeNull()
  await press("G02 prepare Meter")
}

it("keeps caller bounds and deferred values on the original public root without manufacturing layout", async () => {
  await prepare()
  const original = state()
  expect(original.refIdentity).not.toBeNull()
  for (const [control, authored, native] of [
    ["G02 MT value 25", { value: 25 }, { min: 0, max: 100, now: 25, text: "25%" }],
    ["G02 MT lower clamp", { value: -80, minValue: -50, maxValue: 50 }, { min: -50, max: 50, now: -50, text: "0%" }],
    ["G02 MT upper clamp", { value: 80, minValue: -50, maxValue: 50 }, { min: -50, max: 50, now: 50, text: "100%" }],
  ] as const) {
    await press(control)
    expect(state().owner).toEqual(authored)
    expect(target().props.accessibilityValue).toEqual(native)
    expect(state()).toMatchObject({
      rootTag: original.rootTag,
      refIdentity: original.refIdentity,
      attaches: original.attaches,
      detaches: original.detaches,
    })
  }
  await press("G02 MT deferred 35")
  expect(state().owner).toEqual({ value: 35, minValue: -5, maxValue: 75, valueLabel: "" })
  expect(target().props.accessibilityValue).toEqual({ min: -5, max: 75, now: 35, text: "" })
  expect(state().receipts.filter((row: { kind: string }) => row.kind === "layout")).toHaveLength(0)
})

it("preserves explicit empty labels and current formatting without replacing the root", async () => {
  await prepare()
  const original = state()
  await press("G02 MT format controls")
  await press("G02 MT authored label")
  expect(target().props.accessibilityValue.text).toBe("One quarter")
  await press("G02 MT empty label")
  expect(target().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 0, text: "" })
  await press("G02 MT English decimal")
  expect(target().props.accessibilityValue.text).toBe("1,250")
  await press("G02 MT French decimal")
  expect(target().props.accessibilityValue.text).toBe(new Intl.NumberFormat("fr-CA", { style: "decimal" }).format(1250))
  expect(state().refIdentity).toBe(original.refIdentity)
})

it("exposes current known values and superseded work without creating an indeterminate state", async () => {
  await prepare()
  await press("G02 MT motion controls")
  expect(screen.queryByRole("button", { name: "G02 MT unknown" })).toBeNull()
  await press("G02 MT value 25")
  expect(target().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 25, text: "25%" })
  await press("G02 MT value 75")
  expect(target().props.accessibilityValue).toEqual({ min: 0, max: 100, now: 75, text: "75%" })
  expect(screen.queryByTestId("meter-g02-target-indeterminate", { includeHiddenElements: true })).toBeNull()
  await press("G02 MT supersede fill")
  expect(state().owner.value).toBe(90)
  await act(() => jest.advanceTimersByTime(100))
  expect(state().owner.value).toBe(10)
  expect(target().props.accessibilityValue.now).toBe(10)
  expect(state().receipts.filter((row: { kind: string }) => row.kind === "scheduled")).toHaveLength(1)
})

it("retains the delivered native payload and retires the original root from its current touch callback", async () => {
  await prepare()
  const original = state()
  await press("G02 MT events controls")
  await press("G02 MT replace callbacks")
  await press("G02 MT retire on touch start")
  const nativeEvent = {
    target: 71,
    timestamp: 100,
    identifier: 3,
    pageX: 20,
    pageY: 40,
    touches: [{ target: 71, identifier: 3 }],
    changedTouches: [{ target: 71, identifier: 3 }],
  }
  await fireEvent(target(), "touchStart", { currentTarget: 71, nativeEvent })
  expect(screen.queryByTestId("meter-g02-target")).toBeNull()
  const final = state()
  expect(final).toMatchObject({ visible: false, rootTag: null, refIdentity: null, detaches: original.detaches + 1 })
  const touch = final.receipts.find((row: { kind: string }) => row.kind === "touchStart")
  expect(touch.data).toMatchObject({ recipient: "current", currentTarget: 71, native: nativeEvent })
  expect(touch.refIdentity).toBe(original.refIdentity)
  expect(final.dropped).toBe(0)
})
