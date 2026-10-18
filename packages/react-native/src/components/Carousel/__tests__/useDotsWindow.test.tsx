import { act, renderHook } from "@testing-library/react-native"

import { useNativeCarouselDotsWindow, type TNativeCarouselDotsWindowInput } from "../useDotsWindow"

import oracle from "./fixtures/dotsWindowOracle.json"

let nextId: number
type TFrameCallback = Parameters<typeof requestAnimationFrame>[0]
let pending: Map<number, TFrameCallback>
let callbacks: Map<number, TFrameCallback>
beforeEach(() => {
  nextId = 1
  pending = new Map()
  callbacks = new Map()
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = nextId++
    pending.set(id, callback)
    callbacks.set(id, callback)
    return id
  })
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
    if (id !== null && id !== undefined) pending.delete(id)
  })
})
afterEach(() => jest.restoreAllMocks())

const input = (selectedIndex = 0): TNativeCarouselDotsWindowInput => ({
  selectedIndex,
  itemCount: 20,
  largeZoneCount: 3,
  neighbors: 2,
  minPinned: 1,
  maxStart: 13,
  initialWindowStart: 0,
})
const flushFrame = async () => {
  const current = [...pending.values()]
  pending.clear()
  await act(() => current.forEach((callback) => callback(16)))
}

it.each(oracle.sequences)("matches the canonical settled timeline: $name", async (sequence) => {
  const hook = await renderHook(useNativeCarouselDotsWindow, { initialProps: sequence.steps[0].input })
  const snapshot = () => {
    const { setWindowStart: _setter, ...state } = hook.result.current
    return state
  }
  for (const [index, step] of sequence.steps.entries()) {
    if (index) await hook.rerender(step.input)
    expect(snapshot()).toEqual(step.beforeFrames)
    for (const expected of step.afterFrames) {
      await flushFrame()
      expect(snapshot()).toEqual(expected)
    }
  }
  await hook.unmount()
})

it("keeps wrap suppression through exactly two frame boundaries even when the window target is unchanged", async () => {
  const { result, rerender } = await renderHook(useNativeCarouselDotsWindow, {
    initialProps: { ...input(), itemCount: 2, maxStart: 0 },
  })
  await rerender({ ...input(1), itemCount: 2, maxStart: 0 })
  expect(result.current.windowStart).toBe(0)
  expect(result.current.noTransition).toBe(true)
  await flushFrame()
  expect(result.current.noTransition).toBe(true)
  await flushFrame()
  expect(result.current.noTransition).toBe(false)
})

it("retires a replaced first frame without clearing ownership of its replacement", async () => {
  const { result, rerender, unmount } = await renderHook(useNativeCarouselDotsWindow, { initialProps: input() })
  await rerender(input(19))
  const old = nextId - 1
  await rerender(input(0))
  const current = nextId - 1
  expect(cancelAnimationFrame).toHaveBeenCalledWith(old)
  await act(() => callbacks.get(old)!(16))
  expect(result.current.noTransition).toBe(true)
  expect(pending.has(current)).toBe(true)
  await unmount()
  expect(cancelAnimationFrame).toHaveBeenCalledWith(current)
  expect(pending.size).toBe(0)
})

it("retires a replaced second frame without ending the new wrap or losing its current handle", async () => {
  const { result, rerender, unmount } = await renderHook(useNativeCarouselDotsWindow, { initialProps: input() })
  await rerender(input(19))
  await flushFrame()
  const oldSecond = nextId - 1
  await rerender(input(0))
  expect(cancelAnimationFrame).toHaveBeenCalledWith(oldSecond)
  await flushFrame()
  const currentSecond = nextId - 1
  await act(() => callbacks.get(oldSecond)!(32))
  expect(result.current.noTransition).toBe(true)
  expect(pending.has(currentSecond)).toBe(true)
  await unmount()
  expect(cancelAnimationFrame).toHaveBeenCalledWith(currentSecond)
  expect(pending.size).toBe(0)
})

it.each([
  { name: "count", changes: { itemCount: 21, maxStart: 14 } },
  { name: "large zone", changes: { largeZoneCount: 5 } },
  { name: "neighbors", changes: { neighbors: 3 } },
  { name: "pin threshold", changes: { minPinned: 2 } },
  { name: "window size", changes: { maxStart: 12 } },
])("retires pending frames when $name changes without rewriting the owner selection", async ({ changes }) => {
  const owner = Object.freeze({ ...input(19), ...changes })
  const { result, rerender } = await renderHook(useNativeCarouselDotsWindow, { initialProps: input() })
  await rerender(input(19))
  const old = nextId - 1
  await rerender(owner)
  expect(cancelAnimationFrame).toHaveBeenCalledWith(old)
  expect(result.current.noTransition).toBe(false)
  await act(() => callbacks.get(old)!(16))
  expect(pending.size).toBe(0)
  expect(result.current.noTransition).toBe(false)
  expect(owner.selectedIndex).toBe(19)
})

it.each([0, 1])(
  "cancels on unmount after %s delivered frames and ignores forced retired delivery",
  async (delivered) => {
    const { rerender, unmount } = await renderHook(useNativeCarouselDotsWindow, { initialProps: input() })
    await rerender(input(19))
    if (delivered) await flushFrame()
    const old = nextId - 1
    await unmount()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(old)
    expect(pending.size).toBe(0)
    const count = jest.mocked(requestAnimationFrame).mock.calls.length
    await act(() => callbacks.get(old)!(32))
    expect(requestAnimationFrame).toHaveBeenCalledTimes(count)
    expect(pending.size).toBe(0)
  },
)

it("does not reinitialize the UI window from later initialWindowStart changes or mutate its inputs", async () => {
  const owner = Object.freeze({ ...input(6), initialWindowStart: 3 })
  const { result, rerender } = await renderHook(useNativeCarouselDotsWindow, { initialProps: owner })
  const current = result.current.windowStart
  await rerender(Object.freeze({ ...owner, initialWindowStart: 0 }))
  expect(result.current.windowStart).toBe(current)
  expect(owner.selectedIndex).toBe(6)
  expect(owner.initialWindowStart).toBe(3)
})
