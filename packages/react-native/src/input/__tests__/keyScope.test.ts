import { createNativeKeyScope, nativeKeyToken, nativeKeyTokens, type TNativeKeyPolicy } from "../keyScope"
import type { TNativeKeyboardEvent } from "../types"

const event = (ownerId = "window", extra: Partial<TNativeKeyboardEvent["nativeEvent"]> = {}) =>
  ({
    nativeEvent: {
      kind: "keyboard",
      ownerId,
      target: 0,
      key: "Escape",
      nativeCode: 0,
      characters: "",
      phase: "down",
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 0,
      ...extra,
    },
  }) as TNativeKeyboardEvent
const ready = (scope: ReturnType<typeof createNativeKeyScope>) => {
  let session = scope.acknowledgedSession()
  if (!session.windowId) {
    scope.acceptNativeStatus({
      windowActive: true,
      ownerId: scope.ownerId,
      windowId: `native-${scope.ownerId}`,
      epoch: 1,
      ready: false,
      policyRevision: scope.policyRevision(),
    })
    session = scope.acknowledgedSession()
  }
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: scope.ownerId,
    ...session,
    ready: true,
    policyRevision: scope.policyRevision(),
  })
}
const register = (scope: ReturnType<typeof createNativeKeyScope>, key: string, value: TNativeKeyPolicy) => {
  const lease = scope.register(key, value)
  ready(scope)
  return lease
}
const policy = (extra: Partial<TNativeKeyPolicy> = {}): TNativeKeyPolicy => ({
  tokens: nativeKeyTokens("Escape"),
  excludeEditable: false,
  isEnabled: true,
  lifetimeKey: "first",
  canAct: () => true,
  onKey: jest.fn(),
  ...extra,
})

it("encodes all16 modifier combinations without losing Meta or requiring a nonzero native code", () => {
  const tokens = nativeKeyTokens("ArrowRight")
  expect(new Set(tokens).size).toBe(16)
  expect(nativeKeyToken(event().nativeEvent)).toBe("0000:Escape")
  expect(nativeKeyToken(event("window", { shiftKey: true, metaKey: true }).nativeEvent)).toBe("1001:Escape")
})

it("dispatches the original event immediately to the current callback and retains a callback-only native lease", () => {
  const scope = createNativeKeyScope("window")
  const first = policy()
  const lease = register(scope, "escape", first)
  const id = scope.policies()[0]!.id
  const packet = event()
  expect(scope.dispatch(id, packet)).toBe(true)
  expect(first.onKey).toHaveBeenCalledWith(packet)
  expect((first.onKey as jest.Mock).mock.calls[0][0]).toBe(packet)
  const next = policy()
  lease.update(next)
  expect(scope.policies()[0]!.id).toBe(id)
  expect(scope.dispatch(id, packet)).toBe(true)
  expect(next.onKey).toHaveBeenCalledTimes(1)
  expect(first.onKey).toHaveBeenCalledTimes(1)
})

it("does not publish callback-only or equivalent reordered-token updates", () => {
  const scope = createNativeKeyScope("window")
  const listener = jest.fn()
  const lease = register(scope, "escape", policy())
  scope.subscribe(listener)
  scope.flush()
  const revision = scope.snapshot()
  const id = scope.policies()[0]!.id
  lease.update(policy({ tokens: [...nativeKeyTokens("Escape").reverse(), "0000:Escape"] }))
  scope.flush()
  expect(scope.snapshot()).toBe(revision)
  expect(scope.policies()[0]!.id).toBe(id)
  expect(listener).not.toHaveBeenCalled()
})

it.each([{ lifetimeKey: "reopened" }, { tokens: ["0000:Enter"] }, { excludeEditable: true }, { isEnabled: false }])(
  "retires the native lease when its meaning changes: %j",
  (change) => {
    const scope = createNativeKeyScope("window")
    const lease = register(scope, "escape", policy())
    const id = scope.policies()[0]!.id
    const next = policy(change)
    lease.update(next)
    expect(scope.dispatch(id, event())).toBe(false)
    expect(next.onKey).not.toHaveBeenCalled()
    if (change.isEnabled !== false) expect(scope.policies()[0]!.id).not.toBe(id)
  },
)

it("does not let an old owner unregister or update its replacement", () => {
  const scope = createNativeKeyScope("window")
  const old = register(scope, "escape", policy())
  const oldId = scope.policies()[0]!.id
  const next = policy()
  register(scope, "escape", next)
  old.update(policy({ isEnabled: false }))
  old.unregister()
  expect(scope.policies()).toHaveLength(1)
  expect(scope.dispatch(oldId, event())).toBe(false)
  expect(scope.dispatch(scope.policies()[0]!.id, event())).toBe(true)
  expect(next.onKey).toHaveBeenCalledTimes(1)
})

it("keeps latest eligibility authoritative and rejects foreign-window or unconsumed packets", () => {
  const scope = createNativeKeyScope("window")
  let eligible = true
  const current = policy({ canAct: () => eligible })
  register(scope, "escape", current)
  const id = scope.policies()[0]!.id
  eligible = false
  expect(scope.dispatch(id, event())).toBe(false)
  eligible = true
  expect(scope.dispatch(id, event("another-window"))).toBe(false)
  expect(scope.dispatch(id, event("window", { nativeDefaultHandled: false }))).toBe(false)
  expect(scope.dispatch(id, event("window", { key: "Enter" }))).toBe(false)
  expect(current.onKey).not.toHaveBeenCalled()
})

it("retires old packets through disabled/re-enabled windows and disposal", () => {
  const scope = createNativeKeyScope("window")
  const current = policy()
  register(scope, "escape", current)
  const id = scope.policies()[0]!.id
  scope.setEnabled(false)
  expect(scope.policies()).toEqual([])
  scope.setEnabled(true)
  expect(scope.dispatch(id, event())).toBe(false)
  ready(scope)
  const fresh = scope.policies()[0]!.id
  expect(scope.dispatch(fresh, event())).toBe(true)
  scope.dispose()
  expect(scope.dispatch(fresh, event())).toBe(false)
  expect(scope.policies()).toEqual([])
  expect(() => scope.register("retired", policy())).toThrow("disposed")
})

it("copies policy tokens and orders the most recent owners first without touching caller values", () => {
  const scope = createNativeKeyScope("window")
  const tokens = ["0000:Escape"]
  register(scope, "parent", policy({ tokens }))
  const parent = scope.policies()[0]!.id
  tokens.push("0000:Enter")
  expect(scope.policies()[0]!.tokens).toEqual(["0000:Escape"])
  register(scope, "child", policy())
  expect(scope.policies()[1]!.id).toBe(parent)
})

it("requires acknowledgment of the current native window and complete policy revision", () => {
  const scope = createNativeKeyScope("window")
  const current = policy()
  scope.register("escape", current)
  const oldId = scope.policies()[0]!.id
  expect(scope.dispatch(oldId, event())).toBe(false)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    windowId: "native",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: true,
  })
  expect(scope.isNativeReady()).toBe(false)
  const id = scope.policies()[0]!.id
  expect(id).not.toBe(oldId)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    windowId: "native",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: false,
  })
  expect(scope.dispatch(id, event())).toBe(false)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    windowId: "native",
    epoch: 1,
    policyRevision: scope.policyRevision(),
    ready: true,
  })
  expect(scope.dispatch(id, event())).toBe(true)
})

it("rejects old window, epoch and policy acknowledgments and packets", () => {
  const scope = createNativeKeyScope("window")
  register(scope, "escape", policy())
  const id = scope.policies()[0]!.id
  const session = { ...scope.acknowledgedSession(), policyRevision: scope.policyRevision() }
  expect(scope.dispatch(id, event(), { ...session, windowId: "foreign" })).toBe(false)
  expect(scope.dispatch(id, event(), { ...session, epoch: session.epoch - 1 })).toBe(false)
  expect(scope.dispatch(id, event(), { ...session, policyRevision: session.policyRevision - 1 })).toBe(false)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    ...session,
    epoch: session.epoch - 1,
    ready: false,
  })
  expect(scope.isNativeReady()).toBe(true)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    ...session,
    policyRevision: session.policyRevision - 1,
    ready: false,
  })
  expect(scope.isNativeReady()).toBe(true)
})

it("retires keys at native window focus/epoch replacement, even with unchanged callbacks", () => {
  const scope = createNativeKeyScope("window")
  register(scope, "escape", policy())
  const id = scope.policies()[0]!.id
  const previous = { ...scope.acknowledgedSession(), policyRevision: scope.policyRevision() }
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    windowId: "replacement",
    epoch: 2,
    policyRevision: previous.policyRevision,
    ready: false,
  })
  expect(scope.isNativeReady()).toBe(false)
  ready(scope)
  expect(scope.dispatch(id, event(), previous)).toBe(false)
  expect(scope.dispatch(scope.policies()[0]!.id, event())).toBe(true)
})

it("uses only observed input from the current native epoch, preserving timestamp0", () => {
  const scope = createNativeKeyScope("window")
  register(scope, "escape", policy())
  const session = scope.acknowledgedSession()
  const input = { ownerId: "window", ...session, origin: "keyboard" as const, timestamp: 0 }
  expect(scope.lastInput()).toBeNull()
  scope.recordInput({ ...input, ownerId: "retired" })
  expect(scope.lastInput()).toBeNull()
  scope.recordInput(input)
  expect(scope.lastInput()).toBe(input)
  scope.recordInput({ ...input, epoch: 0, origin: "pointer" })
  expect(scope.lastInput()).toBe(input)
  scope.acceptNativeStatus({
    windowActive: true,
    ownerId: "window",
    windowId: session.windowId,
    epoch: session.epoch + 1,
    policyRevision: scope.policyRevision(),
    ready: false,
  })
  expect(scope.lastInput()).toBeNull()
})

it("retires native rules when their target or composition guard changes and preserves an explicit global target0", () => {
  const scope = createNativeKeyScope("window")
  const lease = register(scope, "escape", policy({ targetTag: 0, excludeComposing: false }))
  const id = scope.policies()[0]!.id
  expect(scope.policies()[0]).toMatchObject({ targetTag: 0, excludeComposing: false })
  lease.update(policy({ targetTag: 17, excludeComposing: false }))
  expect(scope.isNativeReady()).toBe(false)
  expect(scope.policies()[0]!.id).not.toBe(id)
  ready(scope)
  const target = scope.policies()[0]!.id
  lease.update(policy({ targetTag: 17, excludeComposing: true }))
  expect(scope.policies()[0]!.id).not.toBe(target)
})

it("publishes admitted modality changes without retiring policies or native readiness and rejects older/foreign observations", () => {
  const scope = createNativeKeyScope("window")
  ready(scope)
  const revision = scope.policyRevision(),
    changed = jest.fn()
  scope.subscribe(changed)
  const session = scope.acknowledgedSession()
  const keyboard = { ownerId: scope.ownerId, ...session, origin: "keyboard" as const, timestamp: 0 }
  scope.recordInput(keyboard)
  expect(changed).toHaveBeenCalledTimes(1)
  expect(scope.lastInput()).toBe(keyboard)
  scope.recordInput({ ...keyboard, timestamp: 1 })
  expect(changed).toHaveBeenCalledTimes(1)
  const pointer = { ...keyboard, origin: "pointer" as const, timestamp: 2 }
  scope.recordInput(pointer)
  expect(changed).toHaveBeenCalledTimes(2)
  for (const extra of [{ timestamp: 1 }, { ownerId: "foreign" }, { windowId: "foreign" }, { epoch: session.epoch - 1 }])
    scope.recordInput({ ...keyboard, timestamp: 3, ...extra })
  expect(scope.lastInput()).toBe(pointer)
  expect(changed).toHaveBeenCalledTimes(2)
  expect(scope.policyRevision()).toBe(revision)
  expect(scope.isNativeReady()).toBe(true)
})

it.each([0, 32])("does not traverse policies or serialize unchanged publications with %i registrations", (count) => {
  const scope = createNativeKeyScope("window")
  const leases = Array.from({ length: count }, (_, index) => scope.register(`policy-${index}`, policy()))
  ready(scope)
  const session = scope.acknowledgedSession()
  const initialInput = { ownerId: scope.ownerId, ...session, origin: "keyboard" as const, timestamp: 0 }
  scope.recordInput(initialInput)
  const listener = jest.fn()
  scope.subscribe(listener)
  const snapshot = scope.snapshot()
  const policyRevision = scope.policyRevision()
  const previousPolicies = scope.policies()
  const latest = jest.fn()
  for (const lease of leases)
    lease.update(policy({ tokens: [...nativeKeyTokens("Escape").reverse(), "0000:Escape"], onKey: latest }))
  let lastInput = initialInput
  const serialization = jest.spyOn(JSON, "stringify")
  const traversal = jest.spyOn(Map.prototype, "values")
  let serializationCount = 0
  let traversalCount = 0
  try {
    for (let timestamp = 1; timestamp <= 100; timestamp++) {
      scope.flush()
      lastInput = { ...initialInput, timestamp }
      scope.recordInput(lastInput)
    }
    serializationCount = serialization.mock.calls.length
    traversalCount = traversal.mock.calls.length
  } finally {
    serialization.mockRestore()
    traversal.mockRestore()
  }
  expect(serializationCount).toBe(0)
  expect(traversalCount).toBe(0)
  expect(scope.snapshot()).toBe(snapshot)
  expect(scope.policyRevision()).toBe(policyRevision)
  expect(scope.policies()).toEqual(previousPolicies)
  expect(scope.lastInput()).toBe(lastInput)
  expect(scope.isNativeReady()).toBe(true)
  expect(listener).not.toHaveBeenCalled()
  if (count) {
    const packet = event()
    expect(scope.dispatch(previousPolicies[0]!.id, packet)).toBe(true)
    expect(latest).toHaveBeenCalledTimes(1)
    expect(latest.mock.calls[0][0]).toBe(packet)
  }
})

it.each([
  { lifetimeKey: "replacement" },
  { tokens: ["0000:Enter"] },
  { excludeEditable: true },
  { isEnabled: false },
  { targetTag: 17 },
  { excludeComposing: false },
  { originalEditorAction: true },
])("publishes each changed wire policy synchronously on flush: %j", (change) => {
  const scope = createNativeKeyScope("window")
  const lease = register(scope, "escape", policy())
  const listener = jest.fn()
  scope.subscribe(listener)
  const snapshot = scope.snapshot()
  const policyRevision = scope.policyRevision()
  const oldId = scope.policies()[0]!.id
  lease.update(policy(change))
  expect(scope.policyRevision()).toBe(policyRevision + 1)
  expect(scope.isNativeReady()).toBe(false)
  expect(scope.dispatch(oldId, event())).toBe(false)
  expect(listener).not.toHaveBeenCalled()
  scope.flush()
  expect(scope.snapshot()).toBe(snapshot + 1)
  expect(listener).toHaveBeenCalledTimes(1)
  scope.flush()
  expect(listener).toHaveBeenCalledTimes(1)
})

it("publishes initial, disabled-owner replacement, enabled and disposal revisions without losing no-ops", () => {
  const scope = createNativeKeyScope("window")
  const revisions: number[] = []
  scope.subscribe(() => revisions.push(scope.snapshot()))
  scope.flush()
  scope.flush()
  expect(revisions).toEqual([1])
  const old = scope.register("escape", policy({ isEnabled: false }))
  scope.flush()
  const replacement = scope.register("escape", policy({ isEnabled: false }))
  scope.flush()
  expect(scope.policies()).toEqual([])
  expect(revisions).toEqual([1, 2, 3])
  const policyRevision = scope.policyRevision()
  old.update(policy())
  old.unregister()
  replacement.update(policy({ isEnabled: false, onKey: jest.fn() }))
  scope.setEnabled(true)
  scope.flush()
  expect(scope.policyRevision()).toBe(policyRevision)
  expect(revisions).toEqual([1, 2, 3])
  scope.setEnabled(false)
  scope.flush()
  scope.setEnabled(false)
  scope.flush()
  scope.setEnabled(true)
  scope.flush()
  replacement.unregister()
  scope.flush()
  expect(revisions).toEqual([1, 2, 3, 4, 5, 6])
  scope.dispose()
  expect(scope.snapshot()).toBe(7)
  expect(scope.policyRevision()).toBe(policyRevision + 4)
  expect(revisions).toEqual([1, 2, 3, 4, 5, 6])
  scope.dispose()
  scope.flush()
  expect(scope.snapshot()).toBe(7)
})

it("publishes readiness, origin and physical/session transitions while rejecting stale status and input", () => {
  const scope = createNativeKeyScope("window")
  const current = policy()
  register(scope, "escape", current)
  const session = scope.acknowledgedSession()
  const initialId = scope.policies()[0]!.id
  const initialRevision = scope.snapshot()
  const revisions: number[] = []
  scope.subscribe(() => revisions.push(scope.snapshot()))
  const status = {
    ownerId: scope.ownerId,
    ...session,
    policyRevision: scope.policyRevision(),
    ready: true,
    windowActive: true,
  }
  scope.acceptNativeStatus(status)
  scope.acceptNativeStatus({ ...status, ready: false })
  scope.acceptNativeStatus({ ...status, ready: false })
  scope.acceptNativeStatus(status)
  for (const extra of [
    { ownerId: "foreign" },
    { epoch: session.epoch - 1 },
    { windowId: "foreign" },
    { policyRevision: status.policyRevision - 1 },
  ])
    scope.acceptNativeStatus({ ...status, ready: false, ...extra })
  expect(revisions).toEqual([initialRevision + 1, initialRevision + 2])
  expect(scope.isNativeReady()).toBe(true)
  const keyboard = { ownerId: scope.ownerId, ...session, origin: "keyboard" as const, timestamp: 0 }
  scope.recordInput(keyboard)
  const sameOrigin = { ...keyboard, timestamp: 0 }
  scope.recordInput(sameOrigin)
  expect(scope.lastInput()).toBe(sameOrigin)
  scope.recordInput({ ...keyboard, timestamp: -1 })
  expect(scope.lastInput()).toBe(sameOrigin)
  scope.recordInput({ ...keyboard, origin: "pointer", timestamp: 1 })
  scope.acceptNativeStatus({ ...status, windowActive: false })
  expect(scope.lastInput()).toBeNull()
  expect(scope.dispatch(initialId, event())).toBe(false)
  scope.acceptNativeStatus({ ...status, policyRevision: scope.policyRevision(), windowActive: false })
  scope.acceptNativeStatus({ ...status, policyRevision: scope.policyRevision() })
  expect(scope.dispatch(initialId, event())).toBe(false)
  const packet = event()
  expect(scope.dispatch(scope.policies()[0]!.id, packet)).toBe(true)
  const returnedSession = scope.acknowledgedSession()
  returnedSession.windowId = "caller mutation"
  scope.flush()
  scope.acceptNativeStatus({
    ...status,
    windowId: "replacement",
    epoch: session.epoch + 1,
    policyRevision: scope.policyRevision(),
  })
  scope.recordInput({ ...keyboard, timestamp: 2 })
  expect(scope.lastInput()).toBeNull()
  expect(scope.isNativeReady()).toBe(false)
  ready(scope)
  expect(scope.dispatch(initialId, event(), { ...session, policyRevision: status.policyRevision })).toBe(false)
  expect(scope.dispatch(scope.policies()[0]!.id, packet)).toBe(true)
  expect(current.onKey).toHaveBeenCalledTimes(2)
  expect((current.onKey as jest.Mock).mock.calls.map(([received]) => received)).toEqual([packet, packet])
  expect(revisions).toEqual(Array.from({ length: 8 }, (_, index) => initialRevision + index + 1))
})

it("keeps synchronous listener order and reentrant publication visible without republishing no-ops", () => {
  const scope = createNativeKeyScope("window")
  ready(scope)
  const session = scope.acknowledgedSession()
  const initialRevision = scope.snapshot()
  const trace: [string, number][] = []
  let nested = false
  const keyboard = { ownerId: scope.ownerId, ...session, origin: "keyboard" as const, timestamp: 2 }
  scope.subscribe(() => {
    trace.push(["first", scope.snapshot()])
    scope.flush()
    if (!nested) {
      nested = true
      scope.recordInput(keyboard)
    }
  })
  scope.subscribe(() => trace.push(["second", scope.snapshot()]))
  scope.recordInput({ ...keyboard, origin: "pointer", timestamp: 1 })
  expect(trace).toEqual([
    ["first", initialRevision + 1],
    ["first", initialRevision + 2],
    ["second", initialRevision + 2],
    ["second", initialRevision + 2],
  ])
  expect(scope.lastInput()).toBe(keyboard)
  scope.flush()
  expect(trace).toHaveLength(4)
})
