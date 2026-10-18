import { act, render, screen } from "@testing-library/react-native"
import { useState } from "react"
import { AccessibilityInfo, Animated, type ViewStyle } from "react-native"

import { getNativeToastMotionFrame, useNativeToastMotion } from "../motion"
import type { TNativeToastProps } from "../types"

const props: TNativeToastProps = {
  toast: { id: 0 },
  index: 0,
  numToasts: 1,
  position: "top-right",
  offset: 80,
  firstHeight: 20,
  maxVisibleToasts: 5,
  toasterExpanded: true,
  interacting: false,
  onHeight: jest.fn(),
  removeToast: jest.fn(),
}
const state = { entered: true, removed: false, swiped: false, naturalHeight: 100 }
beforeEach(() => {
  jest.useFakeTimers()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})
it.each([
  ["top-right", -100],
  ["bottom-left", 100],
] as const)("CAP.toast.001 enters %s from its actual natural height", (position, expected) => {
  expect(getNativeToastMotionFrame({ ...props, position }, { ...state, entered: false }, {}, {})).toMatchObject({
    translation: expected,
    opacity: 0,
  })
})
it.each([
  [0, false, false, -100],
  [1, true, false, -20],
  [1, false, false, 40],
  [1, false, true, -100],
] as const)(
  "NATIVE.toast.motion.001 preserves exit index%s expanded%s swipe%s",
  (index, expanded, swiped, expected) => {
    expect(
      getNativeToastMotionFrame(
        { ...props, index, toasterExpanded: expanded },
        { ...state, removed: true, swiped },
        {},
        {},
      ),
    ).toMatchObject({ translation: expected, opacity: 0 })
  },
)
it("CAP.toast.017 preserves authored zero opacity/numeric height and hidden-stack semantics", () => {
  expect(getNativeToastMotionFrame(props, state, { height: 0 }, { opacity: 0 })).toMatchObject({
    opacity: 0,
    height: 0,
  })
  expect(getNativeToastMotionFrame({ ...props, index: 5 }, state, {}, {}).opacity).toBe(0)
})
type TProbeProps = {
  value?: TNativeToastProps
  root?: ViewStyle
  authored?: ViewStyle
  removed?: boolean
  dragging?: boolean
}
const Probe = ({ value = props, root = {}, authored = {}, removed = false, dragging = false }: TProbeProps) => {
  const [drag] = useState(() => new Animated.Value(0))
  const style = useNativeToastMotion(value, root, authored, 100, removed, dragging, false, drag)
  return <Animated.View testID="motion" style={style} />
}
const motionInfo = AccessibilityInfo as unknown as {
  addEventListener: (event: "reduceMotionChanged", listener: (value: boolean) => void) => { remove: () => void }
}
const advance = async (duration: number) => act(() => jest.advanceTimersByTime(duration))
it("NATIVE.toast.motion.002 performs double-frame entry and preserves explicit native transforms", async () => {
  const frames = new Map<number, (time: number) => void>()
  let serial = 0
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++serial
    frames.set(id, callback)
    return id
  })
  await render(<Probe authored={{ transform: [{ translateX: 5 }] }} />)
  expect(screen.getByTestId("motion")).toHaveStyle({ opacity: 0, transform: [{ translateX: 5 }] })
  expect(frames.size).toBe(1)
  await act(() => frames.get(1)!(16))
  expect(frames.size).toBe(2)
  expect(screen.getByTestId("motion")).toHaveStyle({ opacity: 0 })
  await act(() => frames.get(2)!(32))
  expect(screen.getByTestId("motion")).toHaveStyle({ opacity: 1, transform: [{ translateX: 5 }] })
})
it("NATIVE.toast.motion.003 animates real numeric height from the current frame and reaches its exact target", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const { rerender } = await render(<Probe root={{ height: 200 }} />)
  await advance(500)
  await rerender(<Probe root={{ height: 60 }} />)
  await advance(180)
  const height = screen.getByTestId("motion").props.style.height as number
  expect(height).toBeGreaterThan(60)
  expect(height).toBeLessThan(200)
  await advance(300)
  expect(screen.getByTestId("motion")).toHaveStyle({ height: 60 })
})
it("NATIVE.toast.motion.004 gives Reduce Motion changes priority over a late query and retires subscriptions", async () => {
  let resolve: ((value: boolean) => void) | undefined, changed: ((value: boolean) => void) | undefined
  const remove = jest.fn()
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  jest.spyOn(motionInfo, "addEventListener").mockImplementation((_, listener) => {
    changed = listener
    return { remove }
  })
  const timing = jest.spyOn(Animated, "timing")
  const { rerender, unmount } = await render(<Probe root={{ height: 200 }} />)
  await act(() => changed?.(true))
  await act(() => resolve?.(false))
  await advance(500)
  timing.mockClear()
  await rerender(<Probe root={{ height: 60 }} />)
  expect(screen.getByTestId("motion")).toHaveStyle({ height: 60 })
  expect(timing).not.toHaveBeenCalled()
  await unmount()
  expect(remove).toHaveBeenCalledTimes(1)
})
it("NATIVE.toast.motion.005 interrupts active transitions on Reduce Motion and on unmount", async () => {
  let changed: ((value: boolean) => void) | undefined
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(motionInfo, "addEventListener").mockImplementation((_, listener) => {
    changed = listener
    return { remove: jest.fn() }
  })
  const stop = jest.fn()
  jest.spyOn(Animated, "timing").mockImplementation(() => ({ start: jest.fn(), stop, reset: jest.fn() }))
  const { rerender, unmount } = await render(<Probe root={{ height: 200 }} />)
  await advance(50)
  await rerender(<Probe root={{ height: 60 }} />)
  await act(() => changed?.(true))
  expect(stop).toHaveBeenCalled()
  expect(screen.getByTestId("motion")).toHaveStyle({ height: 60 })
  await act(() => changed?.(false))
  await rerender(<Probe root={{ height: 90 }} />)
  stop.mockClear()
  await unmount()
  expect(stop).toHaveBeenCalled()
})
