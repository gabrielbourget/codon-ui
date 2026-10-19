import {
  createNativeKeyboardObservations,
  type TNativeKeyboardObservation,
  type TNativeObservedKeyboardEvent,
} from "../keyboardObservation"

const options = (onKeyDown: TNativeKeyboardObservation["onKeyDown"] = jest.fn()): TNativeKeyboardObservation => ({
  isEnabled: true,
  lifetimeKey: "live",
  canAct: () => true,
  onKeyDown,
})
const setup = () => {
  const scope = createNativeKeyboardObservations("owner")
  const acknowledge = (epoch = 1, windowId = "window", windowActive = true) => {
    const status = () => ({
      ownerId: "owner",
      windowId,
      epoch,
      observationRevision: scope.revision(),
      ready: true,
      windowActive,
    })
    scope.acceptStatus(status())
    scope.acceptStatus(status())
  }
  let serial = 0
  const packet = (extra = {}): TNativeObservedKeyboardEvent =>
    ({
      nativeEvent: {
        ownerId: "owner",
        ...scope.session(),
        observationRevision: scope.revision(),
        eventId: ++serial,
        observerIds: scope.registrations().map(({ id }) => id),
        target: 1,
        focusedTarget: 2,
        key: "q",
        code: "KeyE",
        nativeCode: 8,
        legacyKeyCode: 69,
        location: 0,
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey: false,
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        defaultCaptured: false,
        timestamp: 1,
        ...extra,
      },
    }) as unknown as TNativeObservedKeyboardEvent
  return { scope, acknowledge, packet }
}

it("broadcasts the original packet in registration order and deduplicates native event IDs", () => {
  const f = setup(),
    calls: unknown[] = []
  f.scope.register(
    "first",
    options((event) => calls.push(["first", event])),
  )
  f.scope.register(
    "second",
    options((event) => calls.push(["second", event])),
  )
  expect(f.scope.dispatch(f.packet())).toBe(false)
  f.acknowledge()
  const event = f.packet()
  expect(f.scope.dispatch(event)).toBe(true)
  expect(f.scope.dispatch(event)).toBe(false)
  expect(calls).toEqual([
    ["first", event],
    ["second", event],
  ])
  expect((calls[0] as unknown[])[1]).toBe(event)
})

it("lets a listener retire itself without discarding another live listener from that event", () => {
  const f = setup(),
    calls: string[] = []
  const first = f.scope.register(
    "first",
    options(() => {
      calls.push("first")
      first.unregister()
      f.scope.flush()
    }),
  )
  f.scope.register(
    "second",
    options(() => calls.push("second")),
  )
  f.acknowledge()
  f.scope.dispatch(f.packet())
  expect(calls).toEqual(["first", "second"])
  expect(f.scope.isNativeReady()).toBe(false)
  expect(f.scope.dispatch(f.packet())).toBe(false)
  f.acknowledge()
  f.scope.dispatch(f.packet())
  expect(calls).toEqual(["first", "second", "second"])
})

it("skips retired siblings and defers registrations created inside an earlier callback", () => {
  const f = setup(),
    calls: string[] = []
  f.scope.register(
    "first",
    options(() => {
      calls.push("first")
      second.unregister()
      f.scope.register(
        "third",
        options(() => calls.push("third")),
      )
    }),
  )
  const second = f.scope.register(
    "second",
    options(() => calls.push("second")),
  )
  f.acknowledge()
  f.scope.dispatch(f.packet())
  expect(calls).toEqual(["first"])
})

it("updates callbacks without replacing a native lease but retires changed target/lifetime/enabled registrations", () => {
  const f = setup(),
    old = jest.fn(),
    next = jest.fn()
  const registration = f.scope.register("entry", options(old))
  f.acknowledge()
  const event = f.packet(),
    wire = f.scope.registrations(),
    revision = f.scope.revision()
  registration.update(options(next))
  expect(f.scope.registrations()).toEqual(wire)
  expect(f.scope.revision()).toBe(revision)
  f.scope.dispatch(event)
  expect(old).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledWith(event)
  for (const changed of [
    { ...options(next), targetTag: 9 },
    { ...options(next), lifetimeKey: "replacement" },
    { ...options(next), isEnabled: false },
  ]) {
    const stale = f.packet()
    registration.update(changed)
    f.acknowledge()
    expect(f.scope.dispatch(stale)).toBe(false)
  }
})

it("invalidates retained packets on coverage, background, window replacement and unmount", () => {
  const f = setup(),
    callback = jest.fn()
  f.scope.register("entry", options(callback))
  f.acknowledge()
  const stale = f.packet()
  f.scope.setEnabled(false)
  f.scope.setEnabled(true)
  f.acknowledge()
  expect(f.scope.dispatch(stale)).toBe(false)
  const previousWindow = f.packet()
  f.acknowledge(2, "window", false)
  expect(f.scope.dispatch(previousWindow)).toBe(false)
  f.acknowledge(3, "replacement")
  expect(f.scope.dispatch(previousWindow)).toBe(false)
  expect(f.scope.dispatch(f.packet({ ownerId: "other" }))).toBe(false)
  expect(f.scope.dispatch(f.packet({ cancelled: true }))).toBe(false)
  const retained = f.packet()
  f.scope.dispose()
  expect(f.scope.dispatch(retained)).toBe(false)
  expect(callback).not.toHaveBeenCalled()
})

it("keeps delivery live across callback errors and checks each current owner before invocation", () => {
  const f = setup(),
    callback = jest.fn(),
    error = new Error("listener failed")
  f.scope.register("first", {
    ...options(),
    canAct: () => {
      throw error
    },
  })
  f.scope.register("second", options(callback))
  f.scope.register("covered", { ...options(callback), canAct: () => false })
  f.acknowledge()
  const event = f.packet()
  expect(() => f.scope.dispatch(event)).toThrow(error)
  expect(callback.mock.calls).toEqual([[event]])
})
