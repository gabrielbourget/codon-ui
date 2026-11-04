import { fireEvent, render, screen, userEvent } from "@testing-library/react-native"
import { SafeAreaInsetsContext } from "react-native-safe-area-context"

import { NativeShowcase } from "../NativeShowcase"

type TReceipt = { sequence: number; kind: string; data: unknown }
const owner = () => JSON.parse(screen.getByTestId("library-button-behavior").children.join(""))
const receipts = (): TReceipt[] => JSON.parse(screen.getByTestId("library-button-callbacks").children.join(""))
const events = (kind: string) => receipts().filter((receipt) => receipt.kind === kind)
const changes = () => events("press:change").map(({ data }) => data)
const primary = () => screen.getByRole("button", { name: "Library action" })

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
  await press("Text/Button scene")
  expect(owner()).toMatchObject({ actions: 0, longActions: 0, disabled: false, pending: false })
  expect(receipts()).toEqual([])
  return { user, press }
}

it("observes the public press lifecycle and original callback objects without adding a second action", async () => {
  const { user } = await enter()
  await user.press(primary())
  expect(owner()).toMatchObject({ actions: 1, longActions: 0 })
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 1/)
  for (const kind of ["press:start", "press:up", "press:end", "press", "native:pressIn", "native:pressOut"])
    expect(events(kind)).toHaveLength(1)
  expect(changes()).toEqual([true, false])
  const start = events("press:start")[0]!.data
  expect(events("native:pressIn")[0]!.data).toEqual(start)
  expect(events("native:pressOut")[0]!.data).toEqual(events("press:end")[0]!.data)
  expect(receipts().map(({ sequence }) => sequence)).toEqual(receipts().map((_, index) => index + 1))
})

it("retains the original held-release action when no long-press callback is configured", async () => {
  const { user } = await enter()
  await user.longPress(primary(), { duration: 700 })
  expect(owner()).toMatchObject({ actions: 1, longActions: 0, longPressEnabled: false })
  expect(events("press")).toHaveLength(1)
  expect(events("long:press")).toEqual([])
  expect(changes()).toEqual([true, false])
})

it("exposes the authored long-press action without also counting an ordinary activation", async () => {
  const { user, press } = await enter()
  await press("Toggle library long press action")
  await user.longPress(primary(), { duration: 700 })
  expect(owner()).toMatchObject({ actions: 0, longActions: 1, longPressEnabled: true })
  expect(events("press")).toEqual([])
  expect(events("long:press")).toHaveLength(1)
  expect(screen.getByTestId("library-state")).toHaveTextContent(/count: 0/)
  expect(changes()).toEqual([true, false])
})

it.each(["disabled", "pending"] as const)(
  "observes the %s guard and the first subsequent enabled action",
  async (guard) => {
    const { user, press } = await enter()
    await press(`Toggle library ${guard}`)
    await user.press(primary())
    expect(owner().actions).toBe(0)
    expect(receipts()).toEqual([])
    expect(primary().props.accessibilityState).toMatchObject({
      disabled: guard === "disabled",
      busy: guard === "pending",
    })
    expect(primary().props.focusable).toBe(guard === "pending")
    await press(`Toggle library ${guard}`)
    await user.press(primary())
    expect(owner().actions).toBe(1)
    expect(events("press")).toHaveLength(1)
  },
)

it.each(["disabled", "pending"] as const)(
  "records balanced cancellation when the owner becomes %s at press start",
  async (guard) => {
    const { user, press } = await enter()
    await press("Next library button press-start takeover")
    if (guard === "pending") await press("Next library button press-start takeover")
    expect(owner().pressStartTakeover).toBe(guard)
    await user.press(primary())
    expect(owner()).toMatchObject({ actions: 0, [guard]: true, pressStartTakeover: "none" })
    expect(events("press:start")).toHaveLength(1)
    expect(events("press:end")).toHaveLength(1)
    expect(events("press")).toEqual([])
    expect(changes()).toEqual([true, false])
    await press(`Toggle library ${guard}`)
    await user.press(primary())
    expect(owner().actions).toBe(1)
    expect(events("press")).toHaveLength(1)
    expect(events("press:end")).toHaveLength(2)
    expect(changes()).toEqual([true, false, true, false])
  },
)

it("records cancellation without manufacturing a semantic activation", async () => {
  await enter()
  const event = {
    persist: jest.fn(),
    target: 17,
    currentTarget: 17,
    nativeEvent: { target: 17, timestamp: 1, identifier: 0, pageX: 0, pageY: 0, locationX: 0, locationY: 0 },
  }
  await fireEvent(primary(), "pressIn", event)
  await fireEvent(primary(), "pressOut", event)
  expect(owner().actions).toBe(0)
  expect(events("press")).toEqual([])
  expect(events("press:start")).toHaveLength(1)
  expect(events("press:end")).toHaveLength(1)
  expect(changes()).toEqual([true, false])
})

it("retains the new observations through existing theme/fixture controls and clears them on explicit scene reset", async () => {
  const { user, press } = await enter()
  await user.press(primary())
  const before = receipts()
  await press("Dark theme")
  await press("Compact width")
  expect(owner().actions).toBe(1)
  expect(receipts()).toEqual(before)
  await press("Reset scene")
  await press("Text/Button scene")
  expect(owner()).toMatchObject({ actions: 0, longActions: 0, disabled: false, pending: false })
  expect(receipts()).toEqual([])
})
