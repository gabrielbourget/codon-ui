import { act, render } from "@testing-library/react-native"
import type { PointerEvent } from "react-native"

import type { TNativeKeyboardEvent } from "../../../input/types"
import type { NativeDateFieldFocusManager } from "../focus"
import { NativeOrdinaryDatePress, useNativeOrdinaryDateGroup } from "../ordinaryGroup"

type TOptions = Parameters<typeof useNativeOrdinaryDateGroup>[0]
const pointer = (root: object, target: object, pointerType = "touch", extra = {}) =>
  ({
    currentTarget: root,
    target,
    timeStamp: 10,
    nativeEvent: { pointerId: 7, pointerType, button: 0, ...extra },
    stopPropagation: jest.fn(),
    preventDefault: jest.fn(),
  }) as unknown as PointerEvent
const setup = () => {
  const focus = jest.fn(() => true),
    capturePress = jest.fn(() => focus)
  const options: TOptions = {
    enabled: true,
    disabled: false,
    direction: "ltr",
    focus: { capturePress } as unknown as NativeDateFieldFocusManager,
  }
  return { options, focus, capturePress, press: new NativeOrdinaryDatePress(() => options) }
}
it.each(["mouse", "touch", "pen"])(
  "uses actual %s down/click timing once without replacing the event or target",
  (type) => {
    const value = setup(),
      root = {},
      target = {},
      event = pointer(root, target, type)
    value.press.receive(event, "down")
    expect(value.capturePress).toHaveBeenCalledWith(target)
    expect(value.focus).toHaveBeenCalledTimes(type === "mouse" ? 1 : 0)
    value.press.receive(event, "up")
    value.press.receive(event, "click")
    value.press.receive(event, "click")
    expect(value.focus).toHaveBeenCalledTimes(1)
    expect(event.target).toBe(target)
    expect(event.currentTarget).toBe(root)
    expect(event.preventDefault).not.toHaveBeenCalled()
  },
)
it.each(["cancel", "root", "pointer", "type", "disabled", "retired", "older"])(
  "rejects a %s contact before delayed focus",
  (change) => {
    const value = setup(),
      root = {},
      target = {},
      event = pointer(root, target)
    value.press.receive(event, "down")
    if (change === "cancel") value.press.receive(event, "cancel")
    if (change === "retired") value.press.retire()
    if (change === "disabled") value.options.disabled = true
    const click = {
      ...event,
      currentTarget: change === "root" ? {} : root,
      timeStamp: change === "older" ? 9 : 11,
      nativeEvent: {
        ...event.nativeEvent,
        pointerId: change === "pointer" ? 8 : 7,
        pointerType: change === "type" ? "mouse" : "touch",
      },
    } as PointerEvent
    value.press.receive(click, "click")
    expect(value.focus).not.toHaveBeenCalled()
  },
)
it("excludes foreign or portalled calendar hits and secondary buttons without stopping their events", () => {
  const value = setup(),
    root = {},
    target = {},
    event = pointer(root, target)
  value.options.admitPointer = () => false
  value.press.receive(event, "down")
  expect(value.capturePress).not.toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
  value.options.admitPointer = () => true
  value.press.receive(pointer(root, target, "mouse", { button: 2 }), "down")
  expect(value.focus).not.toHaveBeenCalled()
})
it("keeps same-group key callbacks, real releases and RTL physical requests without manufacturing key phases", async () => {
  const next = jest.fn(),
    previous = jest.fn(),
    visual = jest.fn(),
    down = jest.fn(),
    up = jest.fn()
  const options: TOptions = {
    enabled: true,
    disabled: false,
    direction: "ltr",
    onKeyDown: down,
    onKeyUp: up,
    focus: { focusNext: next, focusPrevious: previous, focusVisual: visual } as unknown as NativeDateFieldFocusManager,
  }
  let group: ReturnType<typeof useNativeOrdinaryDateGroup>
  const Probe = () => {
    group = useNativeOrdinaryDateGroup(options)
    return null
  }
  const view = await render(<Probe />)
  const event = {
    nativeEvent: { kind: "keyboard", phase: "down", key: "ArrowRight", cancelled: false },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  } as unknown as TNativeKeyboardEvent
  await act(() => group.key(event))
  expect(next).toHaveBeenCalledTimes(1)
  expect(down).toHaveBeenCalledWith(event)
  expect(event.stopPropagation).toHaveBeenCalledTimes(1)
  const release = { ...event, nativeEvent: { ...event.nativeEvent, phase: "up" as const } }
  await act(() => group.key(release))
  expect(up).toHaveBeenCalledWith(release)
  expect(next).toHaveBeenCalledTimes(1)
  options.direction = "rtl"
  await view.rerender(<Probe />)
  await act(() => group.key(event))
  expect(visual).toHaveBeenCalledWith(1)
  expect(previous).not.toHaveBeenCalled()
  options.disabled = true
  await view.rerender(<Probe />)
  await act(() => group.key(event))
  expect(down).toHaveBeenCalledTimes(2)
})
