import type { TNativeKeyScope } from "../keyScope"
import {
  createNativeWindowPointers,
  dispatchNativeWindowPointer,
  type TNativeWindowPointerEvent,
} from "../nativeWindowPointers"

let nextScope = 0
const disposals: (() => void)[] = []
const fixture = (windowId = `window-${nextScope}`) => {
  let epoch = 1,
    active = true
  const ownerId = `scope-${++nextScope}`
  const scope = {
    ownerId,
    acknowledgedSession: () => ({ windowId, epoch }),
    isWindowActive: () => active,
  } as TNativeKeyScope
  const pointers = createNativeWindowPointers(scope)
  const acknowledge = () =>
    pointers.acceptStatus({ ownerId, windowId, epoch, revision: pointers.revision(), ready: true, error: "" })
  const add = (key: string, targetTag: number, more: Partial<Parameters<typeof pointers.register>[1]> = {}) => {
    const start = jest.fn((_event: TNativeWindowPointerEvent, _current: () => boolean) => true),
      move = jest.fn(),
      end = jest.fn(),
      activate = jest.fn(),
      retire = jest.fn()
    const release = pointers.register(key, {
      targetTag,
      global: false,
      stopPropagation: false,
      current: () => true,
      start,
      move,
      end,
      activate,
      retire,
      ...more,
    })
    acknowledge()
    return { start, move, end, activate, retire, release }
  }
  let sequence = 0
  const packet = (
    phase: TNativeWindowPointerEvent["nativeEvent"]["phase"],
    depths: number[] = [],
    extra: Partial<TNativeWindowPointerEvent["nativeEvent"]> = {},
  ) =>
    ({
      nativeEvent: {
        ownerId,
        windowId,
        epoch,
        sequence: ++sequence,
        phase,
        pointerId: 1,
        pointerType: "touch",
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
        target: 7,
        registrations: pointers.registrations().map((entry, index) => ({
          ...entry,
          ownerId,
          epoch,
          revision: pointers.revision(),
          depth: depths[index] ?? -1,
        })),
        ...extra,
      },
      persist: jest.fn(),
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    }) as unknown as TNativeWindowPointerEvent
  const result = {
    pointers,
    add,
    packet,
    acknowledge,
    ownerId,
    windowId,
    deactivate: () => {
      active = false
      pointers.syncSession()
    },
    advance: () => {
      active = true
      epoch++
      pointers.syncSession()
      acknowledge()
    },
  }
  disposals.push(pointers.dispose)
  return result
}
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
})

it.each([undefined, true, false])(
  "orders nested taps before global registrations with propagation %p and original packets",
  (propagation) => {
    const f = fixture(),
      order: string[] = []
    f.add("global-first", 1, {
      global: true,
      start: (event) => {
        order.push("global-first")
        expect(event).toBe(down)
        return true
      },
    })
    f.add("parent", 2, {
      start: () => {
        order.push("parent")
        return true
      },
    })
    f.add("child", 3, {
      stopPropagation: propagation === false,
      start: () => {
        order.push("child")
        return true
      },
    })
    f.add("global-last", 4, {
      global: true,
      start: () => {
        order.push("global-last")
        return true
      },
    })
    const down = f.packet("start", [-1, 2, 0, -1])
    expect(dispatchNativeWindowPointer(down)).toBe(true)
    expect(order).toEqual(propagation === false ? ["child"] : ["child", "parent", "global-first", "global-last"])
    expect(down.preventDefault).not.toHaveBeenCalled()
    expect(down.stopPropagation).not.toHaveBeenCalled()
  },
)
it("delivers a global outside start/release and cancels a local outside release", () => {
  const f = fixture(),
    local = f.add("local", 1),
    global = f.add("global", 2, { global: true })
  const outside = f.packet("start")
  dispatchNativeWindowPointer(outside)
  expect(local.start).not.toHaveBeenCalled()
  expect(global.start).toHaveBeenCalledWith(outside, expect.any(Function))
  const release = f.packet("end")
  dispatchNativeWindowPointer(release)
  expect(global.end).toHaveBeenCalledWith(release, true)
  dispatchNativeWindowPointer(f.packet("start", [0]))
  const cancel = f.packet("end")
  dispatchNativeWindowPointer(cancel)
  expect(local.end).toHaveBeenCalledWith(cancel, false)
})
it.each([
  { pointerType: "mouse", button: 2 },
  { pointerType: "touch", isPrimary: false },
  { pointerType: "pen", isPrimary: false },
] as const)("filters secondary native pointer starts %p", (extra) => {
  const f = fixture(),
    tap = f.add("tap", 1)
  dispatchNativeWindowPointer(f.packet("start", [0], extra))
  expect(tap.start).not.toHaveBeenCalled()
})
it("keeps pointer identity, move, cancellation and genuine virtual activation separate", () => {
  const f = fixture(),
    tap = f.add("tap", 1)
  dispatchNativeWindowPointer(f.packet("start", [0]))
  dispatchNativeWindowPointer(f.packet("end", [0], { pointerId: 2 }))
  expect(tap.end).not.toHaveBeenCalled()
  const move = f.packet("move", [-1])
  dispatchNativeWindowPointer(move)
  expect(tap.move).toHaveBeenCalledWith(move)
  const cancel = f.packet("cancel", [0])
  dispatchNativeWindowPointer(cancel)
  expect(tap.end).toHaveBeenCalledWith(cancel, false)
  const activation = f.packet("activation", [0], { pointerType: "virtual", pointerId: -1 })
  dispatchNativeWindowPointer(activation)
  expect(tap.activate).toHaveBeenCalledWith(activation)
  expect(tap.start).toHaveBeenCalledTimes(1)
})
it("rejects duplicate/out-of-order packets, foreign owners/windows and stale revision/epoch/ref leases", () => {
  const f = fixture(),
    tap = f.add("tap", 1)
  const down = f.packet("start", [0])
  dispatchNativeWindowPointer(down)
  const current = tap.start.mock.calls[0]?.[1] as unknown as () => boolean
  expect(current()).toBe(true)
  expect(dispatchNativeWindowPointer(down)).toBe(false)
  expect(dispatchNativeWindowPointer(f.packet("end", [0], { windowId: "foreign" }))).toBe(false)
  expect(dispatchNativeWindowPointer(f.packet("end", [0], { ownerId: "foreign" }))).toBe(false)
  const old = f.packet("end", [0])
  f.advance()
  expect(current()).toBe(false)
  dispatchNativeWindowPointer(old)
  expect(tap.end).not.toHaveBeenCalled()
  const stale = f.packet("start", [0])
  stale.nativeEvent.registrations[0]!.revision--
  dispatchNativeWindowPointer(stale)
  expect(tap.start).toHaveBeenCalledTimes(1)
  tap.release()
  dispatchNativeWindowPointer(f.packet("start", [0]))
  expect(tap.start).toHaveBeenCalledTimes(1)
})
it("orders local claims across nested scopes in one same-window packet", () => {
  const f = fixture("nested"),
    g = fixture("nested"),
    order: string[] = []
  f.add("global", 1, {
    global: true,
    start: () => {
      order.push("global")
      return true
    },
  })
  g.add("local", 2, {
    stopPropagation: true,
    start: () => {
      order.push("local")
      return true
    },
  })
  const local = g.packet("start", [0])
  const packet = f.packet("start", [-1], {
    registrations: [...f.packet("start").nativeEvent.registrations, ...local.nativeEvent.registrations],
  })
  dispatchNativeWindowPointer(packet)
  expect(order).toEqual(["local"])
})
it("rechecks leases during ordered callbacks and retires unavailable/disabled sessions", () => {
  const f = fixture(),
    first = f.add("first", 1, {
      start: () => {
        second.release()
        return true
      },
    }),
    second = f.add("second", 2)
  dispatchNativeWindowPointer(f.packet("start", [0, 1]))
  expect(second.start).not.toHaveBeenCalled()
  f.deactivate()
  expect(first.retire).toHaveBeenCalled()
  f.pointers.setEnabled(false)
  expect(f.pointers.registrations()).toEqual([])
  expect(dispatchNativeWindowPointer(f.packet("start", [0]))).toBe(false)
})
it("retains an acknowledged owner through unrelated registrations and accepts its matching older native revision", () => {
  const f = fixture(),
    first = f.add("first", 1)
  dispatchNativeWindowPointer(f.packet("start", [0]))
  const lease = first.start.mock.calls[0]![1]
  const end = f.packet("end", [0])
  const release = f.pointers.register("new", {
    targetTag: 2,
    global: true,
    stopPropagation: false,
    current: () => true,
    start: () => true,
    move: jest.fn(),
    end: jest.fn(),
    activate: jest.fn(),
    retire: jest.fn(),
  })
  expect(lease()).toBe(true)
  dispatchNativeWindowPointer(end)
  expect(first.end).toHaveBeenCalledWith(end, true)
  release()
})
it("rejects a backwards per-window sequence after the native emitter changes and deduplicates registrations", () => {
  const first = fixture("emitter-switch"),
    second = fixture("emitter-switch")
  first.add("first", 1)
  const tap = second.add("second", 2)
  dispatchNativeWindowPointer(first.packet("start", [0], { sequence: 10 }))
  expect(dispatchNativeWindowPointer(second.packet("start", [0], { sequence: 9 }))).toBe(false)
  const down = second.packet("start", [0], { sequence: 11 })
  down.nativeEvent.registrations.push(down.nativeEvent.registrations[0]!)
  dispatchNativeWindowPointer(down)
  expect(tap.start).toHaveBeenCalledTimes(1)
})
it("retires a failed native observer without accepting pending native packets", () => {
  const f = fixture(),
    tap = f.add("tap", 1),
    down = f.packet("start", [0])
  dispatchNativeWindowPointer(down)
  f.pointers.acceptStatus({
    ownerId: f.ownerId,
    windowId: f.windowId,
    epoch: 1,
    revision: f.pointers.revision(),
    ready: false,
    error: "replaced native callback",
  })
  expect(tap.retire).toHaveBeenCalled()
  expect(f.pointers.error()).toBe("replaced native callback")
  expect(dispatchNativeWindowPointer(f.packet("end", [0]))).toBe(false)
  expect(tap.end).not.toHaveBeenCalled()
})
