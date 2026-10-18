import { act, renderHook } from "@testing-library/react-native"
import { AccessibilityInfo, Animated } from "react-native"

import { useNativePanelMotion } from "../motion"

const preferences: {
  addEventListener: (name: "reduceMotionChanged", listener: (value: boolean) => void) => { remove: () => void }
} = AccessibilityInfo
afterEach(() => jest.restoreAllMocks())

it("lets a live Reduce Motion change beat a late initial query and finish exit without animation", async () => {
  let resolve!: (value: boolean) => void
  let changed!: (value: boolean) => void
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockReturnValue(
    new Promise((done) => {
      resolve = done
    }),
  )
  jest.spyOn(preferences, "addEventListener").mockImplementation((_name, callback) => {
    changed = callback
    return { remove: jest.fn() }
  })
  const timing = jest.spyOn(Animated, "timing")
  const { result, rerender } = await renderHook(({ open }: { open: boolean }) => useNativePanelMotion(open, 200), {
    initialProps: { open: true },
  })
  await act(() => changed(true))
  await act(() => resolve(false))
  await rerender({ open: false })
  expect(result.current.present).toBe(false)
  expect(timing).not.toHaveBeenCalled()
})

it("fails a missing preference query toward static presentation", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockRejectedValue(new Error("unavailable"))
  const timing = jest.spyOn(Animated, "timing")
  const { result, rerender } = await renderHook(({ open }: { open: boolean }) => useNativePanelMotion(open, 0), {
    initialProps: { open: true },
  })
  await rerender({ open: false })
  expect(result.current.present).toBe(false)
  expect(timing).not.toHaveBeenCalled()
})

it("waits for a measured entry, retires callbacks on unmount and never starts from an invented width", async () => {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  const stop = jest.fn()
  let finish: ((result: { finished: boolean }) => void) | undefined
  const timing = jest.spyOn(Animated, "timing").mockReturnValue({
    start: (callback) => {
      finish = callback
    },
    stop,
    reset: jest.fn(),
  })
  const { rerender, unmount } = await renderHook(
    ({ open, width }: { open: boolean; width: number | null }) => useNativePanelMotion(open, width),
    { initialProps: { open: true, width: null } },
  )
  expect(timing).not.toHaveBeenCalled()
  await rerender({ open: true, width: 320 })
  expect(timing).toHaveBeenCalledTimes(1)
  await rerender({ open: false, width: 320 })
  await unmount()
  expect(stop).toHaveBeenCalled()
  await act(() => finish?.({ finished: true }))
})
