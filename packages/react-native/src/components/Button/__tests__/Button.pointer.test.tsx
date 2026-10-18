import { act, render, screen } from "@testing-library/react-native"
import { Platform } from "react-native"

import { Button, NativeFloatingLayerHost } from "../../.."

// The pinned View mock omits these native commands; retain the real ripple hook.
jest.mock("react-native/Libraries/Components/View/ViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { hotspotUpdate: jest.fn(), setPressed: jest.fn() },
}))

const button = () => screen.getByRole("button")
const pointer = (pointerType = "mouse", timestamp = 0) => ({
  persist: jest.fn(),
  nativeEvent: { pointerType, clientX: 3, clientY: 7, timestamp },
})
const enter = async (event = pointer()) => act(() => button().props.onPointerEnter(event))
const leave = async (event = pointer()) => act(() => button().props.onPointerLeave(event))
const tick = async (duration: number) => act(() => jest.advanceTimersByTime(duration))

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("preserves original pointer events, excludes touch hover and honors both hover delays", async () => {
  const start = jest.fn(),
    end = jest.fn(),
    rawEnter = jest.fn(),
    rawLeave = jest.fn()
  await render(
    <Button
      delayHoverIn={100}
      delayHoverOut={80}
      onHoverStart={start}
      onHoverEnd={end}
      onPointerEnter={rawEnter}
      onPointerLeave={rawLeave}
    >
      {(state) => String(state.isHovered)}
    </Button>,
  )
  const touch = pointer("touch")
  await enter(touch)
  await tick(100)
  expect(rawEnter.mock.calls[0][0]).toBe(touch)
  expect(start).not.toHaveBeenCalled()
  const down = pointer()
  await enter(down)
  await tick(99)
  expect(start).not.toHaveBeenCalled()
  await tick(1)
  expect(start.mock.calls[0][0]).toBe(down)
  expect(screen.getByText("true")).toBeOnTheScreen()
  const up = pointer("mouse", 2)
  await leave(up)
  expect(rawLeave.mock.calls[0][0]).toBe(up)
  await tick(79)
  expect(end).not.toHaveBeenCalled()
  await tick(1)
  expect(end.mock.calls[0][0]).toBe(up)
  expect(screen.getByText("false")).toBeOnTheScreen()
})

it("cancels delayed entry on leave and retains active hover across a brief re-entry", async () => {
  const start = jest.fn(),
    end = jest.fn()
  await render(
    <Button delayHoverIn={100} delayHoverOut={80} onHoverStart={start} onHoverEnd={end}>
      Action
    </Button>,
  )
  await enter()
  await tick(50)
  await leave()
  await tick(100)
  expect(start).not.toHaveBeenCalled()
  await enter()
  await tick(100)
  await leave()
  await tick(40)
  await enter()
  await tick(100)
  expect(start).toHaveBeenCalledTimes(1)
  expect(end).not.toHaveBeenCalled()
  await leave()
  await tick(80)
  expect(end).toHaveBeenCalledTimes(1)
})

it("uses the current delayed callback and retires queued hover on pending takeover or unmount", async () => {
  const old = jest.fn(),
    next = jest.fn()
  const node = (pending = false, callback = next) => (
    <Button delayHoverIn={100} isPending={pending} onHoverStart={callback}>
      Action
    </Button>
  )
  await render(node(false, old))
  await enter()
  await screen.rerender(node())
  await tick(100)
  expect(old).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  await leave()
  await enter()
  await screen.rerender(node(true))
  await screen.rerender(node())
  await tick(100)
  expect(next).toHaveBeenCalledTimes(1)
  await enter()
  const retained = button().props.onPointerEnter
  await screen.unmount()
  await act(() => retained(pointer()))
  await tick(100)
  expect(next).toHaveBeenCalledTimes(1)
})

it("ends active hover once on guard takeover without fabricating a native hover-out", async () => {
  const end = jest.fn(),
    out = jest.fn(),
    changes = jest.fn()
  const node = (pending = false) => (
    <Button isPending={pending} onHoverEnd={end} onHoverOut={out} onHoverChange={changes}>
      Action
    </Button>
  )
  await render(node())
  const original = pointer()
  await enter(original)
  await act(() =>
    button().props.onNativeFocusChange({ nativeEvent: { ownerId: button().props.ownerId, isFocused: false } }),
  )
  expect(end).not.toHaveBeenCalled()
  await screen.rerender(node(true))
  expect(end.mock.calls[0][0]).toBe(original)
  expect(changes.mock.calls).toEqual([[true], [false]])
  expect(out).not.toHaveBeenCalled()
  await leave()
  expect(end).toHaveBeenCalledTimes(1)
})

it("retires a held key and delayed hover when the actual window deactivates, even across immediate reactivation", async () => {
  const press = jest.fn(),
    end = jest.fn(),
    hover = jest.fn(),
    changes = jest.fn()
  await render(
    <NativeFloatingLayerHost testID="window">
      <Button onPress={press} onPressEnd={end} onPressChange={changes} delayHoverIn={100} onHoverStart={hover}>
        Action
      </Button>
    </NativeFloatingLayerHost>,
  )
  const key = (phase = "down") => ({
    persist: jest.fn(),
    nativeEvent: {
      kind: "keyboard",
      ownerId: button().props.ownerId,
      key: "Enter",
      nativeCode: 40,
      phase,
      nativeDefaultHandled: true,
    },
  })
  const down = key()
  await act(() => button().props.onNativeKey(down))
  await enter()
  await act(() => {
    const host = screen.getByTestId("window").props
    for (const windowActive of [false, true])
      host.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host.ownerId,
          windowId: "window",
          epoch: 1,
          policyRevision: host.policyRevision,
          ready: false,
          windowActive,
        },
      })
  })
  await tick(100)
  await act(() => button().props.onNativeKey(key("up")))
  expect(end.mock.calls[0][0]).toBe(down)
  expect(changes.mock.calls).toEqual([[true], [false]])
  expect(press).not.toHaveBeenCalled()
  expect(hover).not.toHaveBeenCalled()
})

it("keeps the callback-ref lifetime stable across guard changes and releases it once on unmount", async () => {
  const cleanup = jest.fn()
  const ref = jest.fn(() => cleanup)
  await render(<Button ref={ref}>Action</Button>)
  const actual = ref.mock.calls[0]
  await screen.rerender(
    <Button ref={ref} isDisabled>
      Action
    </Button>,
  )
  await screen.rerender(
    <Button ref={ref} isPending>
      Action
    </Button>,
  )
  expect(ref).toHaveBeenCalledTimes(1)
  expect(ref.mock.calls[0]).toBe(actual)
  expect(cleanup).not.toHaveBeenCalled()
  await screen.unmount()
  expect(cleanup).toHaveBeenCalledTimes(1)
})

it("retains Android touch ripple coordinates and clears native pressed state on guard cancellation", async () => {
  const originalPlatform = Platform.OS
  const commands = jest.requireMock<{
    Commands: { hotspotUpdate: (...args: unknown[]) => void; setPressed: (...args: unknown[]) => void }
  }>("react-native/Libraries/Components/View/ViewNativeComponent").Commands
  const hotspot = jest.spyOn(commands, "hotspotUpdate").mockImplementation(() => {})
  const pressed = jest.spyOn(commands, "setPressed").mockImplementation(() => {})
  jest.replaceProperty(Platform, "OS", "android")
  try {
    const node = (pending = false) => (
      <Button isPending={pending} android_ripple={{ color: "red", radius: 0 }}>
        Action
      </Button>
    )
    await render(node())
    expect(button().props.nativeBackgroundAndroid).toMatchObject({ type: "RippleAndroid", rippleRadius: 0 })
    const touch = {
      persist: jest.fn(),
      currentTarget: 1,
      target: 1,
      nativeEvent: { target: 1, timestamp: 0, locationX: 3, locationY: 7, pageX: 3, pageY: 7 },
    }
    await act(() => button().props.onResponderGrant(touch))
    expect(hotspot.mock.calls[0].slice(1)).toEqual([3, 7])
    expect(pressed.mock.calls.map((call) => call[1])).toEqual([true])
    await screen.rerender(node(true))
    expect(pressed.mock.calls.map((call) => call[1])).toEqual([true, false])
  } finally {
    jest.replaceProperty(Platform, "OS", originalPlatform)
    hotspot.mockRestore()
    pressed.mockRestore()
  }
})
