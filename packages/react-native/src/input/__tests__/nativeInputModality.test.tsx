import { act, renderHook } from "@testing-library/react-native"

import { createNativeKeyScope } from "../keyScope"
import {
  attachNativeInputModalityWitness,
  recordAcceptedNativeInputModality,
  useNativeInputModalityWitness,
} from "../nativeInputModality"
import {
  createNativeWindowPointers,
  dispatchNativeWindowPointer,
  type TNativeWindowPointerEvent,
} from "../nativeWindowPointers"
import type { NativeInputModalityData } from "../specs/CUIKeyboardScopeNativeComponent"

let serial = 0
const disposals: (() => void)[] = []
const fixture = async (windowId = `modality-window-${++serial}`, initialEpoch = 1) => {
  const scope = createNativeKeyScope(`modality-owner-${++serial}`)
  let epoch = initialEpoch,
    sequence = 0
  const status = (active = true) =>
    scope.acceptNativeStatus({
      ownerId: scope.ownerId,
      windowId,
      epoch,
      ready: true,
      windowActive: active,
      policyRevision: scope.policyRevision(),
    })
  status()
  const pointers = createNativeWindowPointers(scope)
  const activate = jest.fn()
  pointers.register("original-consumer", {
    targetTag: 7,
    global: true,
    stopPropagation: true,
    current: () => true,
    start: () => true,
    move: jest.fn(),
    end: jest.fn(),
    activate,
    retire: jest.fn(),
  })
  const acknowledge = () =>
    pointers.acceptStatus({
      ownerId: scope.ownerId,
      windowId,
      epoch,
      revision: pointers.revision(),
      ready: true,
      error: "",
    })
  acknowledge()
  const release = attachNativeInputModalityWitness(scope)
  const { result, unmount } = await renderHook(() => useNativeInputModalityWitness(scope))
  disposals.push(() => {
    release()
    pointers.dispose()
    scope.dispose()
  })
  const packet = (extra: Partial<TNativeWindowPointerEvent["nativeEvent"]> = {}) =>
    ({
      nativeEvent: {
        ownerId: scope.ownerId,
        windowId,
        epoch,
        sequence: ++sequence,
        phase: "activation",
        pointerId: -1,
        pointerType: "virtual",
        isPrimary: true,
        button: 0,
        buttons: 0,
        nativeButtons: "0",
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        nativeModifiers: "0",
        pageX: 0,
        pageY: 0,
        timestamp: sequence,
        target: 7,
        registrations: pointers
          .registrations()
          .map((entry) => ({ ...entry, ownerId: scope.ownerId, epoch, revision: pointers.revision(), depth: -1 })),
        ...extra,
      },
    }) as TNativeWindowPointerEvent
  const input = async (extra: Partial<NativeInputModalityData> = {}) => {
    const data = { ownerId: scope.ownerId, windowId, epoch, origin: "keyboard" as const, timestamp: 1, ...extra }
    await act(() => {
      const previous = scope.lastInput()
      scope.recordInput(data)
      if (previous !== data && scope.lastInput() === data) recordAcceptedNativeInputModality(scope, data)
    })
    return data
  }
  const dispatch = (event = packet()) => act(() => dispatchNativeWindowPointer(event))
  return {
    scope,
    pointers,
    result,
    packet,
    input,
    dispatch,
    activate,
    release,
    unmount,
    inactive: () =>
      act(() => {
        status(false)
        pointers.syncSession()
      }),
    advance: () =>
      act(() => {
        epoch++
        status()
        pointers.syncSession()
        acknowledge()
      }),
  }
}
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
})

it("virtual witness observes genuine accepted activation despite the earlier consumer claim and later same-kind keyboard replaces it", async () => {
  const f = await fixture()
  await f.input({ timestamp: 100 })
  const keyboard = f.scope.lastInput()
  const before = f.result.current!.revision
  await f.dispatch(f.packet({ sequence: 400, timestamp: 1 }))
  expect(f.result.current).toMatchObject({ origin: "virtual", source: "window-pointer" })
  expect(f.result.current!.revision).toBeGreaterThan(before)
  expect(f.scope.lastInput()).toBe(keyboard)
  expect(f.activate).toHaveBeenCalledTimes(1)
  await f.input({ timestamp: 101 })
  expect(f.result.current).toMatchObject({ origin: "keyboard", source: "native-input-modality" })
  const revision = f.result.current!.revision
  await f.input({ timestamp: 102 })
  expect(f.result.current!.revision).toBeGreaterThan(revision)
})

it("virtual witness ignores rejected pointer and keyboard records while preserving current snapshot identity", async () => {
  const f = await fixture()
  await f.input({ timestamp: 10 })
  const event = f.packet()
  await f.dispatch(event)
  const current = f.result.current
  await f.dispatch(event)
  for (const extra of [{ ownerId: "foreign" }, { windowId: "foreign" }, { epoch: 0 }, { sequence: 0 }])
    await f.dispatch(f.packet(extra))
  for (const extra of [{ ownerId: "foreign" }, { windowId: "foreign" }, { epoch: 0 }, { timestamp: 9 }])
    await f.input(extra)
  expect(f.result.current).toBe(current)
})

it("virtual witness retires on physical window loss and epoch change and cannot replay old virtual packets", async () => {
  const f = await fixture()
  const old = f.packet()
  await f.dispatch(old)
  expect(f.result.current!.origin).toBe("virtual")
  await f.inactive()
  expect(f.result.current).toBeNull()
  await f.advance()
  await f.dispatch(old)
  expect(f.result.current).toBeNull()
  await f.input({ timestamp: 1 })
  expect(f.result.current).toMatchObject({ origin: "keyboard", epoch: 2 })
})

it("virtual witness does not compare independent same-window scope epochs or native producer counters", async () => {
  const f = await fixture("shared-modality-window", 2),
    g = await fixture("shared-modality-window", 9)
  await f.input({ timestamp: 900 })
  await g.input({ timestamp: 2 })
  await f.dispatch(f.packet({ sequence: 600, timestamp: 1 }))
  expect(f.result.current).toMatchObject({ origin: "virtual", epoch: 2 })
  expect(g.result.current).toMatchObject({ origin: "virtual", epoch: 9 })
  await g.input({ timestamp: 3 })
  expect(g.result.current!.origin).toBe("keyboard")
  expect(f.result.current!.origin).toBe("virtual")
})

it("virtual witness ignores other windows and nonvirtual packets and retires its lifecycle without changing registrations", async () => {
  const f = await fixture(),
    g = await fixture()
  const before = f.pointers.registrations()
  await f.dispatch(f.packet({ pointerType: "touch", phase: "start" }))
  expect(f.result.current).toBeNull()
  await g.dispatch()
  expect(f.result.current).toBeNull()
  await f.dispatch()
  expect(Object.isFrozen(f.result.current)).toBe(true)
  expect(f.pointers.registrations()).toEqual(before)
  await act(() => f.release())
  expect(f.result.current).toBeNull()
  await f.dispatch()
  expect(f.result.current).toBeNull()
})
