import { act, render, screen } from "@testing-library/react-native"

import { Button, NativeFloatingLayerHost, NATIVE_ACTIVATION_SOURCES, type TNativeButtonProps } from "../../.."
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"

const root = () => screen.getByRole("button")
const activation = (extra: Record<string, unknown> = {}) => ({
  persist: jest.fn(),
  nativeEvent: {
    kind: "activation",
    ownerId: root().props.ownerId,
    target: 17,
    source: "android-click",
    observedAt: 0,
    activationId: 1,
    scopeOwnerId: "",
    windowId: "window-1",
    epoch: 0,
    ...extra,
  },
})
const send = async (event = activation()) => act(() => root().props.onNativeActivation(event))
const touch = (timestamp = 0) => ({
  persist: jest.fn(),
  currentTarget: 17,
  target: 17,
  nativeEvent: { target: 17, timestamp, identifier: 0, locationX: 0, locationY: 0, pageX: 0, pageY: 0 },
})
const key = (phase = "down", extra: Record<string, unknown> = {}) => ({
  persist: jest.fn(),
  isDefaultPrevented: () => false,
  nativeEvent: {
    kind: "keyboard",
    ownerId: root().props.ownerId,
    nativeCode: 40,
    key: "Enter",
    phase,
    nativeDefaultHandled: true,
    ...extra,
  },
})
const recorder = () => {
  const calls: unknown[][] = []
  const props: TNativeButtonProps = {
    onPressStart: (event) => calls.push(["start", event]),
    onPressChange: (value) => calls.push(["change", value]),
    onPressUp: (event) => calls.push(["up", event]),
    onPressEnd: (event) => calls.push(["end", event]),
    onPress: (event) => calls.push(["press", event]),
    onPressIn: (event) => calls.push(["in", event]),
    onPressOut: (event) => calls.push(["out", event]),
  }
  return { calls, props }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it.each(NATIVE_ACTIVATION_SOURCES)(
  "delivers original %s activation in semantic order without raw down/up or fictitious coordinates",
  async (source) => {
    const { calls, props } = recorder()
    await render(<Button {...props}>{(state) => String(state.isPressed)}</Button>)
    const event = activation({ source })
    await send(event)
    expect(calls).toEqual([
      ["start", event],
      ["change", true],
      ["up", event],
      ["end", event],
      ["change", false],
      ["press", event],
    ])
    expect(event.nativeEvent).toMatchObject({ target: 17, source, observedAt: 0 })
    for (const field of ["pageX", "pageY", "timestamp", "nativeCode", "phase"])
      expect(event.nativeEvent).not.toHaveProperty(field)
    expect(screen.getByText("false")).toBeOnTheScreen()
    await send(event)
    expect(calls).toHaveLength(6)
    await send(activation({ source, activationId: 2 }))
    expect(calls).toHaveLength(12)
  },
)

it.each(["pending", "disabled"] as const)(
  "consumes %s activation without replay after re-enabling and uses the current callback",
  async (guard) => {
    const old = jest.fn(),
      next = jest.fn()
    const node = (blocked: boolean, onPress = next) => (
      <Button onPress={onPress} isPending={blocked && guard === "pending"} isDisabled={blocked && guard === "disabled"}>
        Action
      </Button>
    )
    await render(node(true, old))
    const event = activation()
    await send(event)
    await screen.rerender(node(false))
    await send(event)
    expect(old).not.toHaveBeenCalled()
    expect(next).not.toHaveBeenCalled()
    await send(activation({ activationId: 2 }))
    expect(next).toHaveBeenCalledTimes(1)
  },
)

it("rejects foreign ownership, invalid kind/source/serial and retained callbacks after unmount", async () => {
  const press = jest.fn()
  await render(<Button onPress={press}>Action</Button>)
  for (const extra of [
    { ownerId: "retired" },
    { kind: "touch" },
    { source: "invented" },
    { activationId: 0 },
    { activationId: 1.5 },
    { windowId: "" },
    { scopeOwnerId: "foreign" },
  ])
    await send(activation(extra))
  expect(press).not.toHaveBeenCalled()
  await send(activation({ activationId: 2 }))
  expect(press).toHaveBeenCalledTimes(1)
  const retained = root().props.onNativeActivation
  const event = activation({ activationId: 3 })
  await screen.unmount()
  await act(() => retained(event))
  expect(press).toHaveBeenCalledTimes(1)
})

it("finishes an admitted held pointer once and suppresses its later SDK action", async () => {
  const { calls, props } = recorder()
  await render(<Button {...props}>Action</Button>)
  const down = touch()
  await act(() => root().props.onResponderGrant(down))
  const event = activation()
  await send(event)
  expect(calls).toEqual([
    ["start", down],
    ["change", true],
    ["in", down],
    ["up", event],
    ["end", event],
    ["change", false],
    ["press", event],
  ])
  const up = touch(1)
  await act(() => root().props.onResponderRelease(up))
  await act(() => jest.runOnlyPendingTimers())
  expect(calls.filter(([name]) => name === "press")).toEqual([["press", event]])
  expect(calls.filter(([name]) => name === "up")).toEqual([["up", event]])
  expect(calls.filter(([name]) => name === "out")).toEqual([["out", up]])
})

it("ignores native activation during a held keyboard cycle and preserves genuine release order", async () => {
  const { calls, props } = recorder()
  await render(<Button {...props}>Action</Button>)
  const down = key(),
    up = key("up")
  await act(() => root().props.onNativeKey(down))
  await send()
  await act(() => root().props.onNativeKey(up))
  expect(calls).toEqual([
    ["start", down],
    ["change", true],
    ["in", down],
    ["up", up],
    ["end", up],
    ["change", false],
    ["out", up],
    ["press", up],
  ])
})

it.each([0, 100])("delivers actual pointer release once with press-in delay %i", async (delay) => {
  const { calls, props } = recorder()
  await render(
    <Button {...props} unstable_pressDelay={delay}>
      Action
    </Button>,
  )
  const down = touch(),
    up = touch(1)
  await act(() => root().props.onResponderGrant(down))
  await act(() => root().props.onResponderRelease(up))
  await act(() => jest.runOnlyPendingTimers())
  expect(calls.filter(([name]) => name === "up")).toEqual([["up", up]])
  expect(calls.findIndex(([name]) => name === "start")).toBeLessThan(calls.findIndex(([name]) => name === "up"))
  expect(calls.findIndex(([name]) => name === "up")).toBeLessThan(calls.findIndex(([name]) => name === "end"))
  expect(calls.filter(([name]) => name === "press")).toEqual([["press", up]])
})

it("does not deliver press-up for native key cancellation or pointer termination", async () => {
  const up = jest.fn(),
    press = jest.fn()
  await render(
    <Button onPressUp={up} onPress={press}>
      Action
    </Button>,
  )
  await act(() => root().props.onNativeKey(key()))
  await act(() => root().props.onNativeKey(key("up", { cancelled: true })))
  await act(() => root().props.onResponderGrant(touch()))
  await act(() => root().props.onResponderTerminate(touch(1)))
  await act(() => jest.runOnlyPendingTimers())
  expect(up).not.toHaveBeenCalled()
  expect(press).not.toHaveBeenCalled()
})

it("admits only the current same-window native scope session across deactivation/reactivation", async () => {
  const press = jest.fn()
  await render(
    <NativeFloatingLayerHost testID="scope">
      <Button onPress={press}>Action</Button>
    </NativeFloatingLayerHost>,
  )
  const status = async (epoch: number, windowActive = true) =>
    act(() => {
      const host = screen.getByTestId("scope").props
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "window-1",
          epoch,
          policyRevision: host.policyRevision,
          ready: true,
          windowActive,
        },
      })
    })
  await status(1)
  const scopeOwnerId = screen.getByTestId("scope").props.ownerId
  await send(activation({ scopeOwnerId, epoch: 1 }))
  expect(press).toHaveBeenCalledTimes(1)
  await status(2, false)
  await send(activation({ scopeOwnerId, epoch: 2, activationId: 2 }))
  await status(3)
  await send(activation({ scopeOwnerId, epoch: 1, activationId: 3 }))
  await send(activation({ scopeOwnerId: "retired", epoch: 3, activationId: 4 }))
  await send(activation({ scopeOwnerId, windowId: "window-2", epoch: 3, activationId: 5 }))
  expect(press).toHaveBeenCalledTimes(1)
  await send(activation({ scopeOwnerId, epoch: 3, activationId: 6 }))
  expect(press).toHaveBeenCalledTimes(2)
})

it("retains actual release for a long press without adding an ordinary action", async () => {
  const up = jest.fn(),
    long = jest.fn(),
    press = jest.fn()
  await render(
    <Button onPressUp={up} onLongPress={long} onPress={press}>
      Action
    </Button>,
  )
  await act(() => root().props.onResponderGrant(touch()))
  await act(() => jest.advanceTimersByTime(600))
  const release = touch(600)
  await act(() => root().props.onResponderRelease(release))
  expect(long).toHaveBeenCalledTimes(1)
  expect(up.mock.calls).toEqual([[release]])
  expect(press).not.toHaveBeenCalled()
})

it("keeps an owner key-up veto separate from semantic release and does not invent an SDK accessibility callback", async () => {
  const up = jest.fn(),
    press = jest.fn(),
    accessibilityTap = jest.fn()
  await render(
    <Button
      onPressUp={up}
      onPress={press}
      onKeyUp={(event) => event.preventDefault()}
      onAccessibilityTap={accessibilityTap}
    >
      Action
    </Button>,
  )
  let prevented = false
  const release = {
    ...key("up"),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
  await act(() => root().props.onNativeKey(key()))
  await act(() => root().props.onNativeKey(release))
  expect(up.mock.calls).toEqual([[release]])
  expect(press).not.toHaveBeenCalled()
  await send()
  expect(press).toHaveBeenCalledTimes(1)
  expect(accessibilityTap).not.toHaveBeenCalled()
  const nativeAccessibilityTap = { nativeEvent: { target: 17 } }
  await act(() => root().props.onAccessibilityTap(nativeAccessibilityTap))
  expect(accessibilityTap.mock.calls[0][0]).toBe(nativeAccessibilityTap)
})

it.each(["pending", "disabled"] as const)(
  "retires held touch release during %s takeover without losing fresh native activation",
  async (guard) => {
    const up = jest.fn(),
      end = jest.fn(),
      press = jest.fn()
    const node = (blocked = false) => (
      <Button
        onPressUp={up}
        onPressEnd={end}
        onPress={press}
        isPending={blocked && guard === "pending"}
        isDisabled={blocked && guard === "disabled"}
      >
        Action
      </Button>
    )
    await render(node())
    await act(() => root().props.onResponderGrant(touch()))
    await screen.rerender(node(true))
    await screen.rerender(node())
    await act(() => root().props.onResponderRelease(touch(1)))
    await act(() => jest.runOnlyPendingTimers())
    expect(up).not.toHaveBeenCalled()
    expect(press).not.toHaveBeenCalled()
    expect(end).toHaveBeenCalledTimes(1)
    await send()
    expect(up).toHaveBeenCalledTimes(1)
    expect(press).toHaveBeenCalledTimes(1)
  },
)

it("rechecks current window admission after semantic release before invoking the action", async () => {
  let active = true
  const press = jest.fn(),
    end = jest.fn()
  await render(
    <NativeFloatingWindowContext.Provider value={() => active}>
      <Button
        onPress={press}
        onPressEnd={end}
        onPressUp={() => {
          active = false
        }}
      >
        Action
      </Button>
    </NativeFloatingWindowContext.Provider>,
  )
  await send()
  expect(end).toHaveBeenCalledTimes(1)
  expect(press).not.toHaveBeenCalled()
  active = true
  await send(activation({ activationId: 2 }))
  expect(press).not.toHaveBeenCalled()
})
