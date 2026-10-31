import type { TNativeKeyScope } from "../keyScope"
import {
  createNativeMenuPointers,
  type TNativeMenuPointerEvent,
  type TNativeMenuPointerPolicy,
} from "../nativeMenuPointers"

const binding = (root: number, descriptor = "", more: Record<string, unknown> = {}) =>
  JSON.stringify({
    ownerId: `owner-${root}`,
    rootId: `root-${root}`,
    rootRevision: `revision-${root}`,
    target: root,
    surfaceId: 1,
    windowId: "window",
    epoch: 8,
    sequence: 9,
    descriptorId: descriptor,
    descriptorRevision: descriptor ? "item-revision" : "",
    metadataTarget: descriptor ? 130 : root,
    ...more,
  })
const fixture = () => {
  let epoch = 1,
    windowId = "window",
    active = true,
    current = true,
    sequence = 0
  const scope = {
    ownerId: "scope",
    acknowledgedSession: () => ({ windowId, epoch }),
    isWindowActive: () => active,
  } as TNativeKeyScope
  const pointers = createNativeMenuPointers(scope)
  const observe = jest.fn(),
    retire = jest.fn()
  const options: TNativeMenuPointerPolicy = {
    parentTarget: 10,
    submenuTarget: 20,
    triggerTarget: 11,
    parentBinding: binding(100),
    submenuBinding: binding(200),
    triggerBinding: binding(100, "trigger"),
    enabled: true,
    current: () => current,
    observe,
    retire,
  }
  const lease = pointers.register("first", options)
  const packet = (more: Partial<TNativeMenuPointerEvent["nativeEvent"]> = {}) =>
    ({
      nativeEvent: {
        ownerId: "scope",
        windowId,
        epoch,
        revision: pointers.revision(),
        policyId: pointers.policies()[0]?.id,
        sequence: ++sequence,
        phase: "status",
        ready: true,
        suppressed: false,
        observationId: 0,
        pointerType: "unknown",
        pageX: 15,
        pageY: 25,
        timestamp: 10000,
        target: 11,
        hitPath: [11, 10, 1],
        nativeButtons: "0",
        nativeModifiers: "0",
        geometry: "{}",
        error: "",
        ...more,
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
      persist: jest.fn(),
    }) as unknown as TNativeMenuPointerEvent
  const acknowledge = () => pointers.dispatch(packet())
  return {
    pointers,
    scope,
    observe,
    retire,
    options,
    lease,
    packet,
    acknowledge,
    cover: () => {
      active = false
      pointers.syncSession()
    },
    uncover: () => {
      active = true
      pointers.syncSession()
    },
    advance: () => {
      epoch++
      pointers.syncSession()
    },
    replaceWindow: () => {
      windowId = "new-window"
      epoch++
      pointers.syncSession()
    },
    invalidate: () => {
      current = false
    },
  }
}

it("requires exact native readiness and delivers the original observation without touching public defaults", () => {
  const f = fixture()
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 1, pointerType: "mouse" }))).toBe(false)
  expect(f.acknowledge()).toBe(true)
  const event = f.packet({ phase: "handoff", observationId: 7, pointerType: "mouse" })
  expect(f.pointers.dispatch(event)).toBe(true)
  expect(f.observe).toHaveBeenLastCalledWith(event)
  expect(f.observe.mock.calls.at(-1)![0]).toBe(event)
  expect(event.preventDefault).not.toHaveBeenCalled()
  expect(event.stopPropagation).not.toHaveBeenCalled()
  expect(f.pointers.dispatch(event)).toBe(false)
})

it.each(["touch", "pen"] as const)(
  "retains the original %s down receipt without treating it as mouse movement/handoff",
  (pointerType) => {
    const f = fixture()
    f.acknowledge()
    const original = f.packet({ phase: "down", pointerType, observationId: 11 })
    expect(f.pointers.dispatch(original)).toBe(true)
    expect(f.observe).toHaveBeenLastCalledWith(original)
    expect(f.pointers.dispatch(f.packet({ phase: "move", pointerType, observationId: 12 }))).toBe(false)
  },
)

it.each([
  { ownerId: "other" },
  { windowId: "other" },
  { epoch: 0 },
  { revision: 0 },
  { policyId: "other" },
  { sequence: 0 },
  { sequence: 1.5 },
  { pageX: Number.NaN },
  { timestamp: Infinity },
])("rejects a retired or malformed native session %p", (more) => {
  const f = fixture()
  f.acknowledge()
  f.observe.mockClear()
  expect(f.pointers.dispatch(f.packet(more))).toBe(false)
  expect(f.observe).not.toHaveBeenCalled()
})

it.each([
  { pointerType: "touch" },
  { pointerType: "pen" },
  { pointerType: "virtual" },
  { observationId: 0 },
  { observationId: -1 },
  { target: 0 },
  { hitPath: [12, 10] },
  { hitPath: [11, 12] },
] as const)("rejects handoff without original mouse authority/current parent hit %p", (more) => {
  const f = fixture()
  f.acknowledge()
  expect(f.pointers.dispatch(f.packet({ phase: "handoff", observationId: 7, pointerType: "mouse", ...more }))).toBe(
    false,
  )
})

it("keeps a lease for callback-only commits but retires it for descriptor/target/disabled changes", () => {
  const f = fixture(),
    id = f.pointers.policies()[0].id,
    observe = jest.fn()
  f.acknowledge()
  f.lease.update({ ...f.options, observe })
  expect(f.pointers.policies()[0].id).toBe(id)
  const event = f.packet({ phase: "move", observationId: 1, pointerType: "mouse" })
  expect(f.pointers.dispatch(event)).toBe(true)
  expect(observe).toHaveBeenLastCalledWith(event)
  f.lease.update({ ...f.options, triggerBinding: binding(100, "replacement") })
  expect(f.pointers.policies()[0].id).not.toBe(id)
  expect(f.pointers.dispatch(event)).toBe(false)
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 2, pointerType: "mouse" }))).toBe(false)
  f.lease.update({ ...f.options, enabled: false })
  expect(f.pointers.policies()).toEqual([])
  expect(f.retire).toHaveBeenCalled()
})

it("requires fresh acknowledgements after another policy changes the native revision", () => {
  const f = fixture()
  f.acknowledge()
  f.pointers.register("second", { ...f.options, submenuTarget: 30 })
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 3, pointerType: "mouse" }))).toBe(false)
  expect(f.acknowledge()).toBe(true)
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 4, pointerType: "mouse" }))).toBe(true)
})

it.each([
  { parentTarget: 0 },
  { submenuTarget: 1.2 },
  { triggerTarget: 2147483648 },
  { submenuTarget: 10 },
  { parentBinding: "{}" },
  { submenuBinding: "bad" },
  { triggerBinding: binding(101, "trigger") },
  { submenuBinding: binding(200, "", { windowId: "foreign" }) },
  { submenuBinding: binding(200, "", { surfaceId: 2 }) },
  { parentBinding: binding(100, "item") },
] as const)("does not register a policy with inconsistent actual collection identities %p", (more) => {
  const f = fixture()
  f.lease.update({ ...f.options, ...more })
  expect(f.pointers.policies()).toEqual([])
  expect(f.acknowledge()).toBe(false)
})

it.each(["cover", "advance", "replaceWindow", "invalidate"] as const)(
  "retires native observations on %s",
  (operation) => {
    const f = fixture()
    f.acknowledge()
    const old = f.packet({ phase: "handoff", observationId: 5, pointerType: "mouse" })
    f[operation]()
    expect(f.pointers.dispatch(old)).toBe(false)
    if (operation === "cover") {
      f.uncover()
      expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 6, pointerType: "mouse" }))).toBe(false)
      expect(f.acknowledge()).toBe(true)
    }
  },
)

it("clears native readiness on failed status and ignores unregistered/disposed receiver lifetimes", () => {
  const f = fixture()
  f.acknowledge()
  expect(f.pointers.dispatch(f.packet({ ready: false, error: "native target retired" }))).toBe(true)
  expect(f.retire).toHaveBeenCalledTimes(1)
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 1, pointerType: "mouse" }))).toBe(false)
  expect(() => f.pointers.register("first", f.options)).toThrow("unique live")
  f.lease.unregister()
  f.lease.update(f.options)
  expect(f.pointers.policies()).toEqual([])
  f.pointers.dispose()
  expect(() => f.pointers.register("other", f.options)).toThrow("unique live")
})

it("retires once per enabled transition and requires a fresh native readiness receipt", () => {
  const f = fixture()
  f.acknowledge()
  const previous = f.pointers.policies()[0].id
  f.pointers.setEnabled(false)
  f.pointers.syncSession()
  expect(f.retire).toHaveBeenCalledTimes(1)
  expect(f.pointers.policies()).toEqual([])
  f.pointers.setEnabled(true)
  f.pointers.syncSession()
  expect(f.pointers.policies()[0].id).not.toBe(previous)
  expect(f.retire).toHaveBeenCalledTimes(2)
  expect(f.pointers.dispatch(f.packet({ phase: "move", observationId: 2, pointerType: "mouse" }))).toBe(false)
  expect(f.acknowledge()).toBe(true)
})

it("retires the old identity before calling a receiver's retirement callback", () => {
  const f = fixture()
  const reenter = jest.fn(() => f.pointers.dispatch(old))
  f.lease.update({ ...f.options, retire: reenter })
  f.acknowledge()
  const old = f.packet()
  f.observe.mockClear()
  f.lease.update({ ...f.options, triggerTarget: 12, retire: reenter })
  expect(reenter).toHaveReturnedWith(false)
  expect(f.observe).not.toHaveBeenCalled()
})
