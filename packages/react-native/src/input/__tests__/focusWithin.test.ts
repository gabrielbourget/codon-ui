import { NativeFocusWithinSession, readNativeFocusWithin, type TNativeFocusWithinEvent } from "../focusWithin"

const setup = () => {
  const receive = jest.fn(),
    retire = jest.fn(),
    changed = jest.fn()
  let target = 17
  let scope = { ownerId: "scope", windowId: "window", epoch: 1, active: true }
  const session = new NativeFocusWithinSession({
    ownerId: "host",
    target: () => target,
    scope: () => scope,
    changed,
    receive,
    retire,
  })
  session.attach()
  const binding = () => changed.mock.calls.at(-1)![0] as string
  const event = (patch: Record<string, unknown> = {}): TNativeFocusWithinEvent =>
    ({
      nativeEvent: {
        ownerId: "host",
        bindingId: binding(),
        target,
        surfaceId: 11,
        windowId: scope.windowId,
        scopeOwnerId: scope.ownerId,
        scopeEpoch: scope.epoch,
        sequence: 1,
        attached: true,
        active: true,
        within: true,
        focusedTarget: 19,
        textInputFocused: true,
        origin: "pointer",
        observedAt: 3,
        ...patch,
      },
    }) as TNativeFocusWithinEvent
  return {
    session,
    receive,
    retire,
    changed,
    binding,
    event,
    setTarget: (value: number) => {
      target = value
    },
    setScope: (patch: Partial<typeof scope>) => {
      scope = { ...scope, ...patch }
    },
  }
}

it("copies only declared flags and identities and preserves the admitted original event", () => {
  const f = setup(),
    original = f.event({ query: "private", item: { id: 3 } })
  const decoded = readNativeFocusWithin(original.nativeEvent)!
  expect(Object.keys(decoded)).toHaveLength(15)
  expect(Object.isFrozen(decoded)).toBe(true)
  expect(JSON.stringify(decoded)).not.toContain("private")
  expect(f.session.receive(original)).toBe(true)
  expect(f.receive.mock.calls).toEqual([[original]])
})

it.each([
  { ownerId: "other" },
  { target: 18 },
  { bindingId: "old" },
  { sequence: 0 },
  { sequence: 1.5 },
  { within: "true" },
  { observedAt: NaN },
  { active: true, attached: false },
  { within: true, focusedTarget: 0 },
])("rejects malformed or foreign metadata %p", (patch) => {
  const f = setup()
  expect(f.session.receive(f.event(patch))).toBe(false)
  expect(f.receive).not.toHaveBeenCalled()
})

it("does not replay a sequence or accept a previous ref binding after reattachment", () => {
  const f = setup(),
    old = f.event()
  expect(f.session.receive(old)).toBe(true)
  expect(f.session.receive(old)).toBe(false)
  f.session.detach()
  expect(f.binding()).toBe("")
  expect(f.session.receive(f.event())).toBe(false)
  f.session.attach()
  expect(f.binding()).not.toBe(old.nativeEvent.bindingId)
  expect(f.session.receive(old)).toBe(false)
  expect(f.session.receive(f.event())).toBe(true)
})

it("retires an observation when its original view physically crosses the expected window or scope", () => {
  const f = setup()
  expect(f.session.receive(f.event())).toBe(true)
  expect(f.session.receive(f.event({ windowId: "foreign", sequence: 2 }))).toBe(false)
  expect(f.retire).toHaveBeenCalledTimes(1)
  expect(f.session.receive(f.event({ sequence: 1 }))).toBe(false)
  f.setScope({ windowId: "foreign", epoch: 2 })
  f.session.refreshScope()
  expect(f.session.receive(f.event())).toBe(true)
})

it("clears bindings while inactive and requires a new scope acknowledgment before observing again", () => {
  const f = setup(),
    first = f.binding()
  f.setScope({ active: false })
  f.session.refreshScope()
  expect(f.binding()).toBe("")
  f.setScope({ active: true, windowId: "" })
  f.session.refreshScope()
  expect(f.binding()).toBe("")
  f.setScope({ windowId: "window", epoch: 2 })
  f.session.refreshScope()
  expect(f.binding()).not.toBe(first)
  expect(f.session.receive(f.event())).toBe(true)
})

it("renews the scope binding before accepting a packet that raced the scope subscriber", () => {
  const f = setup(),
    old = f.binding()
  f.setScope({ windowId: "moved", epoch: 2 })
  expect(f.session.receive(f.event())).toBe(false)
  expect(f.binding()).not.toBe(old)
  expect(f.session.receive(f.event())).toBe(true)
})
