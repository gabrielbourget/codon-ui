import { fireEvent, render, screen } from "@testing-library/react-native"

import { TEXT_G02_CONTEXT_CONTENT, TextG02ContextFixture } from "../TextG02ContextFixture"

beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation(() => 71)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

const press = async (name: string) => fireEvent.press(screen.getByRole("button", { name }))
const text = () => screen.getByTestId("text-g02-context-target")
const state = () => JSON.parse(screen.getByTestId("text-g02-context-state").props.accessibilityLabel)

it("restores actual Button-context selection policy on the same original public Text without fabricating actions", async () => {
  const increment = jest.fn()
  await render(<TextG02ContextFixture increment={increment} />)
  expect(screen.queryByTestId("text-g02-context-target")).toBeNull()
  await press("G02 prepare Text button context")
  const initial = state()
  expect(initial.refIdentity).not.toBeNull()
  expect(screen.getByTestId("text-g02-context-owner").props.accessible).toBe(true)
  expect(text().props.selectable).toBe(false)
  expect(text().props.onPress).toBeUndefined()
  expect(text().props.onLongPress).toBeUndefined()
  for (const [control, selectable, policy] of [
    ["G02 enable Text context selection", true, "explicit-true"],
    ["G02 default Text context selection", false, "default"],
  ] as const) {
    await press(control)
    expect(text().props.selectable).toBe(selectable)
    expect(text()).toHaveTextContent(TEXT_G02_CONTEXT_CONTENT, { exact: true })
    expect(state()).toMatchObject({
      policy,
      rootTag: initial.rootTag,
      refIdentity: initial.refIdentity,
      attaches: initial.attaches,
      detaches: initial.detaches,
      parentOrdinary: 0,
      receipts: [],
    })
  }
  expect(increment).not.toHaveBeenCalled()
})

it("keeps an injected parent ordinary action visible while programmatic policy controls remain quiet", async () => {
  const increment = jest.fn()
  await render(<TextG02ContextFixture increment={increment} />)
  await press("G02 prepare Text button context")
  const event = { nativeEvent: { target: 71, timestamp: 100 } }
  await fireEvent(screen.getByTestId("text-g02-context-owner"), "press", event)
  expect(state()).toMatchObject({ parentOrdinary: 1 })
  expect(state().receipts.map((row: { kind: string }) => row.kind)).toEqual(["parentPress"])
  expect(state().receipts[0].native).toEqual(event.nativeEvent)
  expect(increment).toHaveBeenCalledTimes(1)
  await press("G02 enable Text context selection")
  await press("G02 prepare Text button context")
  expect(state().receipts).toHaveLength(1)
  expect(increment).toHaveBeenCalledTimes(1)
})
