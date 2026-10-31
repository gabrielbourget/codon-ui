import { CalendarDate, createCalendar } from "@internationalized/date"
import { act, renderHook } from "@testing-library/react-native"
import { useInsertionEffect, useRef, useState } from "react"
import { type View } from "react-native"
import type * as RN from "react-native"
import { useCalendarState } from "react-stately/useCalendarState"
import { useRangeCalendarState } from "react-stately/useRangeCalendarState"

import type { TNativeKeyScope } from "../../../input/keyScope"
import {
  createNativeWindowPointers,
  dispatchNativeWindowPointer,
  type TNativeWindowPointerEvent,
} from "../../../input/nativeWindowPointers"
import type { TNativeCalendarState } from "../keys"
import { NativeCalendarRangeGesture } from "../rangeGesture"
import { useNativeCalendarPointers } from "../useCalendarPointers"

let mockPointers: ReturnType<typeof createNativeWindowPointers> | null = null,
  serial = 0
jest.mock("../../../input/NativeKeyboardScope", () => ({ useNativeWindowPointers: () => mockPointers }))
const day = (date: number) => new CalendarDate(2024, 10, date)
const view = (tag: number) => ({ tag }) as unknown as View
const disposals: (() => void)[] = []
beforeEach(() =>
  jest
    .spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle")
    .mockImplementation((target) => (target as unknown as { tag: number })?.tag ?? 0),
)
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
  mockPointers = null
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const fixture = async (range = true) => {
  const ownerId = `calendar:${++serial}`,
    windowId = `window:${serial}`
  let active = true,
    sequence = 0
  const scope = {
    ownerId,
    acknowledgedSession: () => ({ windowId, epoch: 1 }),
    isWindowActive: () => active,
  } as TNativeKeyScope
  const pointers = createNativeWindowPointers(scope)
  mockPointers = pointers
  disposals.push(pointers.dispose)
  const hooked = await renderHook(() => {
    const single = useCalendarState({ locale: "en-US", createCalendar, defaultFocusedValue: day(10) }),
      interval = useRangeCalendarState({ locale: "en-US", createCalendar, defaultFocusedValue: day(10) })
    const state: TNativeCalendarState = range ? interval : single,
      latest = useRef(state),
      root = useRef<View | null>(view(100))
    useInsertionEffect(() => {
      latest.current = state
    })
    const [gesture] = useState(() =>
      range
        ? new NativeCalendarRangeGesture(() => {
            const current = latest.current
            if (!("anchorDate" in current)) throw new Error("range state required")
            return {
              state: current,
              revision: "owner:1",
              canAct: () => active,
              admit: (_date, run) => {
                const latestState = latest.current
                if ("anchorDate" in latestState) run(latestState)
              },
            }
          })
        : null,
    )
    const pointer = useNativeCalendarPointers({
      root,
      state,
      revision: "owner:1",
      canAct: () => active,
      focusObserved: () => active,
      gesture,
      request: (_date, run) => run(latest.current),
    })
    return { state, pointer, gesture }
  })
  const originals = [view(11), view(12), view(13), view(30)]
  await act(() =>
    originals.forEach((target, index) => {
      const entry =
        index === 3
          ? null
          : {
              date: day([10, 14, 18][index]),
              outsideMonth: false,
              original: () => target,
              active: () => true,
              request: (run: () => void) => run(),
            }
      disposals.push(hooked.result.current.pointer.register(target, entry, () => active))
    }),
  )
  pointers.acceptStatus({ ownerId, windowId, epoch: 1, revision: pointers.revision(), ready: true, error: "" })
  const event = (phase: TNativeWindowPointerEvent["nativeEvent"]["phase"], hit: number, type = "mouse") =>
    ({
      nativeEvent: {
        ownerId,
        windowId,
        epoch: 1,
        sequence: ++sequence,
        phase,
        pointerId: 1,
        pointerType: type,
        isPrimary: true,
        button: 0,
        buttons: phase === "end" ? 0 : 1,
        nativeButtons: "0",
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        nativeModifiers: "0",
        pageX: 12,
        pageY: 34,
        timestamp: sequence,
        target: hit,
        registrations: pointers.registrations().map((entry) => ({
          ...entry,
          ownerId,
          epoch: 1,
          revision: pointers.revision(),
          depth: entry.targetTag === hit ? 0 : entry.targetTag === 100 && hit ? 1 : -1,
        })),
      },
      persist: jest.fn(),
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    }) as unknown as TNativeWindowPointerEvent
  const send = async (...args: Parameters<typeof event>) => {
    const packet = event(...args)
    await act(() => dispatchNativeWindowPointer(packet))
    return packet
  }
  return {
    ...hooked,
    send,
    deactivate: () => {
      active = false
      pointers.syncSession()
    },
  }
}

it("uses original window day hits for a complete range drag without preventing the observed event", async () => {
  const f = await fixture()
  const started = await f.send("start", 11)
  await f.send("move", 12)
  await f.send("end", 12)
  expect(f.result.current.state.value).toEqual({ start: day(10), end: day(14) })
  expect(started.preventDefault).not.toHaveBeenCalled()
  expect(started.stopPropagation).not.toHaveBeenCalled()
})
it("commits an outside release at the last focused day while preserving navigation-button release", async () => {
  const f = await fixture()
  await f.send("start", 11)
  await f.send("move", 12)
  await f.send("end", 0)
  expect(f.result.current.state.value).toEqual({ start: day(10), end: day(14) })
  await f.send("start", 12)
  await f.send("end", 30)
  expect("anchorDate" in f.result.current.state && f.result.current.state.anchorDate).not.toBeNull()
  expect(f.result.current.state.value).toEqual({ start: day(10), end: day(14) })
})
it("retains original touch identity and the source 200ms admission through the existing registry", async () => {
  jest.useFakeTimers()
  const f = await fixture()
  await f.send("start", 11, "touch")
  await act(() => jest.advanceTimersByTime(199))
  expect("anchorDate" in f.result.current.state && f.result.current.state.anchorDate).toBeNull()
  await act(() => jest.advanceTimersByTime(1))
  await f.send("move", 13, "touch")
  await f.send("end", 13, "touch")
  expect(f.result.current.state.value).toEqual({ start: day(10), end: day(18) })
})
it("retires a drag on window deactivation and rejects its later original release", async () => {
  const f = await fixture()
  await f.send("start", 11)
  await act(() => f.deactivate())
  await f.send("end", 12)
  expect(f.result.current.state.value).toBeNull()
  expect("isDragging" in f.result.current.state && f.result.current.state.isDragging).toBe(false)
})
it("selects a single date only when its release hits the same original day host", async () => {
  const f = await fixture(false)
  await f.send("start", 11)
  await f.send("end", 12)
  expect(f.result.current.state.value).toBeNull()
  await f.send("start", 11)
  await f.send("end", 11)
  expect(f.result.current.state.value).toEqual(day(10))
})

it("cancels source touch admission when the original day is exited before200ms", async () => {
  jest.useFakeTimers()
  const f = await fixture()
  await f.send("start", 11, "touch")
  await f.send("move", 12, "touch")
  await act(() => jest.advanceTimersByTime(200))
  await f.send("end", 12, "touch")
  expect(f.result.current.state.value).toBeNull()
  expect("anchorDate" in f.result.current.state && f.result.current.state.anchorDate).toBeNull()
})
