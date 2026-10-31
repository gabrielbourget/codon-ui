import type { PointerEvent } from "react-native"

import { createNativeToastGesture } from "../gesture"

const pointer = (y: number, id = 1, x = 0, pointerType = "touch") =>
  ({
    nativeEvent: { pointerId: id, pageX: x, pageY: y, pointerType },
    target: 2,
    currentTarget: 1,
  }) as unknown as PointerEvent
const fixture = (top = true) => {
  let time = 0,
    enabled = true
  const onAmount = jest.fn(),
    onDragging = jest.fn(),
    onDismiss = jest.fn()
  const gesture = createNativeToastGesture({
    canAct: () => enabled,
    isTop: () => top,
    now: () => time,
    onAmount,
    onDragging,
    onDismiss,
  })
  return {
    gesture,
    onAmount,
    onDragging,
    onDismiss,
    at: (value: number) => {
      time = value
    },
    disable: () => {
      enabled = false
    },
  }
}
it.each([true, false])("CAP.toast.007 native descendant gestures dismiss outward from top=%s", (top) => {
  const f = fixture(top),
    amount = top ? -40 : 40
  f.gesture.down(pointer(0))
  f.at(500)
  f.gesture.move(pointer(amount))
  f.gesture.up(pointer(amount))
  expect(f.onAmount).toHaveBeenLastCalledWith(amount)
  expect(f.onDismiss).toHaveBeenCalledTimes(1)
  f.gesture.up(pointer(amount))
  expect(f.onDismiss).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.gesture.001 excludes actual shared native events without consuming another pointer", () => {
  const f = fixture(),
    excluded = pointer(0)
  f.gesture.exclude(excluded)
  f.gesture.down(excluded)
  f.gesture.move(pointer(-40))
  f.gesture.up(pointer(-40))
  expect(f.onDismiss).not.toHaveBeenCalled()
  f.gesture.down(pointer(0))
  f.at(500)
  f.gesture.move(pointer(-40))
  f.gesture.up(pointer(-40))
  expect(f.onDismiss).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.gesture.002 retains pointer ownership against another down/move/up/cancel", () => {
  const f = fixture()
  f.gesture.down(pointer(0))
  f.gesture.down(pointer(100, 2))
  f.gesture.move(pointer(-50, 2))
  f.gesture.up(pointer(-50, 2))
  f.gesture.pointerCancel(pointer(0, 2))
  expect(f.onAmount).not.toHaveBeenCalled()
  f.at(500)
  f.gesture.move(pointer(-40))
  f.gesture.up(pointer(-40))
  expect(f.onDismiss).toHaveBeenCalledTimes(1)
})
it.each([
  ["touch", -15],
  ["mouse", -2],
] as const)("NATIVE.toast.gesture.003 preserves %s threshold %s", (kind, amount) => {
  const f = fixture()
  f.gesture.down(pointer(0, 1, 0, kind))
  f.at(100)
  f.gesture.move(pointer(amount, 1, 0, kind))
  f.gesture.up(pointer(amount, 1, 0, kind))
  expect(f.onAmount).toHaveBeenLastCalledWith(0)
  expect(f.onDismiss).not.toHaveBeenCalled()
})
it("NATIVE.toast.gesture.004 retains velocity dismissal below the canonical distance threshold", () => {
  const f = fixture()
  f.gesture.down(pointer(0))
  f.at(100)
  f.gesture.move(pointer(-20))
  f.gesture.up(pointer(-20))
  expect(f.onDismiss).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.gesture.005 resets a stale displacement peak when returning inside the start threshold", () => {
  const f = fixture()
  f.gesture.down(pointer(0))
  f.gesture.move(pointer(-40))
  f.at(100)
  f.gesture.move(pointer(-5))
  f.gesture.up(pointer(-5))
  expect(f.onAmount).toHaveBeenLastCalledWith(0)
  expect(f.onDismiss).not.toHaveBeenCalled()
})
it("NATIVE.toast.gesture.006 cancels horizontal and inward movement without a dismissal", () => {
  const f = fixture()
  f.gesture.down(pointer(0))
  f.gesture.move(pointer(0, 1, 20))
  f.gesture.move(pointer(-40))
  f.gesture.up(pointer(-40))
  expect(f.onDismiss).not.toHaveBeenCalled()
  f.gesture.down(pointer(0))
  f.gesture.move(pointer(40))
  f.gesture.up(pointer(40))
  expect(f.onDismiss).not.toHaveBeenCalled()
})
it("NATIVE.toast.gesture.007 rejects disabled, invalid, cancelled and disposed deliveries", () => {
  const f = fixture()
  f.gesture.down(pointer(NaN))
  f.gesture.move(pointer(-50))
  f.gesture.up(pointer(-50))
  expect(f.onDismiss).not.toHaveBeenCalled()
  f.gesture.down(pointer(0))
  f.gesture.pointerCancel(pointer(0))
  f.gesture.up(pointer(-50))
  expect(f.onDismiss).not.toHaveBeenCalled()
  f.gesture.down(pointer(0))
  f.disable()
  f.gesture.move(pointer(-50))
  f.gesture.up(pointer(-50))
  f.gesture.dispose()
  f.gesture.down(pointer(0))
  f.gesture.move(pointer(-50))
  f.gesture.up(pointer(-50))
  expect(f.onDismiss).not.toHaveBeenCalled()
})
it("NATIVE.toast.gesture.008 rejects a held pointer from a retired native window/policy lifetime", () => {
  let lifetime = "window:1:1"
  const onDismiss = jest.fn(),
    gesture = createNativeToastGesture({
      canAct: () => true,
      isTop: () => true,
      onAmount: jest.fn(),
      onDragging: jest.fn(),
      onDismiss,
      lifetime: () => lifetime,
    })
  gesture.down(pointer(0))
  gesture.move(pointer(-40))
  lifetime = "window:2:2"
  gesture.up(pointer(-40))
  expect(onDismiss).not.toHaveBeenCalled()
  gesture.down(pointer(0))
  gesture.move(pointer(-40))
  gesture.up(pointer(-40))
  expect(onDismiss).toHaveBeenCalledTimes(1)
})
