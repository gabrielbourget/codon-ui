import { act, render, renderHook } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { useNativeFloatingScrollAnchor, type TNativeFloatingScrollHost } from "../useFloatingScrollAnchor"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
beforeEach(() => {
  frames.clear()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((handle) => {
    if (handle != null) frames.delete(handle)
  })
})
afterEach(() => jest.restoreAllMocks())
const frame = () =>
  act(() => {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  })

it("resolves the original materialized VirtualizedList scroll ref without calling owner scroll methods", async () => {
  const native = createRef<RN.ScrollView>()
  await render(<RN.ScrollView ref={native} />)
  const target = native.current!
  const find = jest
    .spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle")
    .mockImplementation((view) => (view === target ? 41 : null))
  let current: RN.ScrollView | null = null
  const getScrollRef = jest.fn(() => current)
  const getScrollResponder = jest.fn(() => null)
  const ref = { current: { getScrollRef, getScrollResponder } }
  const hook = await renderHook<number, { enabled: boolean }>(
    ({ enabled }) => useNativeFloatingScrollAnchor(enabled, ref),
    {
      initialProps: { enabled: true },
    },
  )
  expect(hook.result.current).toBe(0)
  current = target
  await frame()
  expect(hook.result.current).toBe(41)
  expect(find.mock.calls.at(-1)![0] === target).toBe(true)
  expect(getScrollResponder).not.toHaveBeenCalled()
  current = null
  await frame()
  expect(hook.result.current).toBe(0)
  await hook.rerender({ enabled: false })
  expect(frames.size).toBe(0)
})

it("uses the original ScrollView host getter and follows ref replacement", async () => {
  // The preset's ScrollView getter is inert. A rendered host stands in for its
  // public return value; this establishes no native scroll proof.
  const native = createRef<RN.View>()
  await render(<RN.View ref={native} />)
  const host = native.current!
  const find = jest
    .spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle")
    .mockImplementation((view) => (view === host ? 51 : null))
  const first = {
    current: {
      getNativeScrollRef: jest.fn(() => host as unknown as ReturnType<RN.ScrollView["getNativeScrollRef"]>),
      getScrollableNode: jest.fn(() => 51),
    },
  }
  const second = { current: null as TNativeFloatingScrollHost | null }
  const hook = await renderHook<number, { ref: { current: TNativeFloatingScrollHost | null } }>(
    ({ ref }) => useNativeFloatingScrollAnchor(true, ref),
    {
      initialProps: { ref: first as { current: TNativeFloatingScrollHost | null } },
    },
  )
  expect(hook.result.current).toBe(51)
  expect(find.mock.calls.at(-1)![0] === host).toBe(true)
  expect(first.current.getScrollableNode).not.toHaveBeenCalled()
  await hook.rerender({ ref: second })
  expect(hook.result.current).toBe(0)
  expect(first.current.getNativeScrollRef).toHaveBeenCalledTimes(1)
})
