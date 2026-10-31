import { act, render, screen } from "@testing-library/react-native"
import { useLayoutEffect } from "react"
import { StyleSheet } from "react-native"

import type { nativeAnimationControls } from "../animation"
import {
  nativeMotionValue,
  useNativeAnimationControls,
  useNativeMotionValue,
  useNativeMotionValueEvent,
} from "../animation/hooks"
import { MotionGlobalConfig, frameData, time } from "../kernel"
import type { MotionValue } from "../kernel"
import { NativeMotionVisualHost } from "../visual/NativeMotionVisualHost"

import { AnimationOwnerFixture, scalarTransition } from "./animation-owner.fixture"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
const flush = async (timestamp = 1016) => {
  await act(() => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach((callback) => callback(timestamp))
  })
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
})
afterEach(async () => {
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("keeps hook-created value identity and untouched caller data through prop changes", async () => {
  const values: MotionValue<unknown>[] = []
  const Initial = Object.freeze({ id: "initial" }),
    Next = Object.freeze({ id: "next" })
  const Consumer = ({ initial }: { initial: unknown }) => {
    values.push(useNativeMotionValue(initial))
    return null
  }
  await render(<Consumer initial={Initial} />)
  await screen.rerender(<Consumer initial={Next} />)
  expect(values.every((value) => value === values[0])).toBe(true)
  expect(values[0].get()).toBe(Initial)
  const destroyed = jest.fn()
  values[0].on("destroy", destroyed)
  await screen.unmount()
  expect(destroyed).not.toHaveBeenCalled()
  values[0].destroy()
})
it("does not invoke a function supplied as an initial caller value", async () => {
  const initial = jest.fn(() => 42)
  let actual: MotionValue<typeof initial> | undefined
  const Consumer = () => {
    actual = useNativeMotionValue(initial)
    return null
  }
  await render(<Consumer />)
  expect(actual?.get()).toBe(initial)
  expect(initial).not.toHaveBeenCalled()
})
it("subscribes before layout effects and replaces value/event/callback listeners", async () => {
  const first = nativeMotionValue(0),
    second = nativeMotionValue(10),
    old = jest.fn(),
    current = jest.fn()
  const Consumer = ({ value, callback }: { value: MotionValue<number>; callback: (value: number) => void }) => {
    useNativeMotionValueEvent(value, "change", callback)
    useLayoutEffect(() => value.set(value.get() + 1), [value])
    return null
  }
  await render(<Consumer value={first} callback={old} />)
  expect(old).toHaveBeenCalledWith(1, undefined, undefined)
  await screen.rerender(<Consumer value={second} callback={current} />)
  await act(() => {
    first.set(2)
    second.set(12)
  })
  expect(old).toHaveBeenCalledTimes(1)
  expect(current).toHaveBeenLastCalledWith(12, undefined, undefined)
  await screen.unmount()
  await act(() => second.set(13))
  expect(current).toHaveBeenCalledTimes(2)
})
it("mounts stable controls in layout and stops subscribed animations on cleanup", async () => {
  const owner = new AnimationOwnerFixture()
  let controls: ReturnType<typeof nativeAnimationControls> | undefined
  const instances: ReturnType<typeof nativeAnimationControls>[] = []
  const Consumer = () => {
    controls = useNativeAnimationControls()
    instances.push(controls)
    useLayoutEffect(() => controls!.subscribe(owner), [])
    return <NativeMotionVisualHost testID="motion" bindings={owner.bindings()} />
  }
  await render(<Consumer />)
  await screen.rerender(<Consumer />)
  expect(instances.every((instance) => instance === instances[0])).toBe(true)
  let pending: Promise<unknown[]> | undefined
  await act(() => {
    pending = controls!.start({ x: 100, opacity: 0, transition: scalarTransition })
  })
  await flush(1050)
  expect(StyleSheet.flatten(screen.getByTestId("motion").props.style)).toMatchObject({
    opacity: 0.5,
    transform: [{ translateX: 50 }],
  })
  await flush(1100)
  await pending
  await act(() => {
    void controls!.start({ x: 200, transition: scalarTransition })
  })
  await screen.unmount()
  expect(owner.getValue("x")?.isAnimating()).toBe(false)
  expect(() => controls!.start({ x: 300 })).toThrow(/mounted/)
  owner.retire()
})
