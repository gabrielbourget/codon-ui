import {
  createNativeVisibleCollectionAdmission,
  nativeCollectionFocusBinding,
  requestNativeCollectionTextInputFocus,
} from "../nativeVisibleCollectionAdmission"

jest.mock("../specs/CUICollectionRootNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}))

const scope = {
  ownerId: "owner",
  generation: "generation",
  revision: "revision",
  itemId: "item",
  itemRevision: "item-revision",
}
const model = JSON.stringify({
  ownerId: scope.ownerId,
  generation: scope.generation,
  revision: scope.revision,
  items: [{ itemId: scope.itemId, itemRevision: scope.itemRevision }],
})
const fixture = () => {
  const root = { tag: 10 },
    receiver = { tag: 20 }
  const state = createNativeVisibleCollectionAdmission((original) => (original as { tag: number }).tag)
  const releaseRoot = state.adapter.registerOwner(model, root)
  const releaseReceiver = state.adapter.registerReceiver(scope, receiver)
  let sequence = 0
  const receipt = (overrides = {}) => {
    const publication = JSON.parse(state.publication())
    return {
      intent: publication.intent,
      publisher: "native-publisher",
      instance: 1,
      sequence: ++sequence,
      lifetime: "native-root-lifetime",
      registrations: [publication.root, ...publication.receivers].map(({ id, tag }: { id: string; tag: number }) => ({
        id,
        tag,
        binding: `native-lease:${id}`,
      })),
      ...overrides,
    }
  }
  const acknowledge = (overrides = {}) => state.receiveCommit(JSON.stringify(receipt(overrides)))
  const request = () => {
    const receive = jest.fn()
    const cancel = state.adapter.request(scope, state.adapter.bindingFor(scope), receiver.tag, receive)
    const packet = JSON.parse(state.requests()).at(-1)
    return { receive, cancel, packet }
  }
  const respond = (pending: ReturnType<typeof request>, overrides = {}) =>
    state.receiveAction(
      JSON.stringify({
        id: pending.packet.id,
        binding: pending.packet.binding,
        publisher: "native-publisher",
        accepted: true,
        ...overrides,
      }),
    )
  return { state, root, receiver, releaseRoot, releaseReceiver, receipt, acknowledge, request, respond }
}

it("publishes only explicit model identities and original tags; registration alone never grants availability", () => {
  const f = fixture()
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  expect(f.state.adapter.ownerLifetimeFor(scope.ownerId, scope.generation)).toBe("")
  expect(JSON.parse(f.state.publication())).toMatchObject({
    model: JSON.parse(model),
    root: { tag: 10 },
    receivers: [{ tag: 20, itemId: "item" }],
  })
  const request = f.request()
  expect(request.receive).toHaveBeenCalledWith(false)
  expect(request.packet).toBeUndefined()
  f.acknowledge()
  expect(f.state.adapter.bindingFor(scope)).toContain("native-lease:")
  expect(f.state.adapter.ownerLifetimeFor(scope.ownerId, scope.generation)).toBe("native-root-lifetime")
})

it("requires a one-shot current native response and does not replay a rejected action", () => {
  const f = fixture()
  f.acknowledge()
  const request = f.request()
  expect(request.receive).not.toHaveBeenCalled()
  f.respond(request, { accepted: false })
  f.respond(request)
  f.acknowledge()
  expect(request.receive.mock.calls).toEqual([[false]])
  expect(JSON.parse(f.state.requests())).toEqual([])
})

it.each(["model", "receiver", "root", "tag", "inactive"])(
  "rejects an old response after an observed %s change",
  (change) => {
    const f = fixture()
    f.acknowledge()
    const request = f.request()
    if (change === "model") {
      f.releaseRoot()
      f.state.adapter.registerOwner(JSON.stringify({ ...JSON.parse(model), revision: "next-revision" }), f.root)
    }
    if (change === "receiver") {
      f.releaseReceiver()
      f.state.adapter.registerReceiver(scope, { tag: 20 })
    }
    if (change === "root") {
      f.releaseRoot()
      f.state.adapter.registerOwner(model, { tag: 10 })
    }
    if (change === "tag") f.receiver.tag = 21
    if (change === "inactive") f.state.setActive(false)
    f.respond(request)
    expect(request.receive.mock.calls).toEqual([[false]])
  },
)

it("ignores canceled and duplicate responses", () => {
  const f = fixture()
  f.acknowledge()
  const canceled = f.request()
  canceled.cancel()
  f.respond(canceled)
  expect(canceled.receive).not.toHaveBeenCalled()
  const live = f.request()
  f.respond(live)
  f.respond(live)
  expect(live.receive.mock.calls).toEqual([[true]])
})

it("rejects a foreign occurrence or target despite a valid other binding", () => {
  const f = fixture()
  f.acknowledge()
  expect(f.state.adapter.bindingFor({ ...scope, itemRevision: "replacement" })).toBe("")
  const receive = jest.fn()
  f.state.adapter.request(scope, f.state.adapter.bindingFor(scope), 21, receive)
  expect(receive).toHaveBeenCalledWith(false)
})

it("invalidates duplicate receiver claims and duplicate native receipt entries", () => {
  const f = fixture()
  f.acknowledge()
  const release = f.state.adapter.registerReceiver(scope, { tag: 21 })
  f.acknowledge()
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  release()
  const receipt = f.receipt()
  receipt.registrations.push(receipt.registrations[1]!)
  f.state.receiveCommit(JSON.stringify(receipt))
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  f.acknowledge()
  expect(f.state.adapter.bindingFor(scope)).not.toBe("")
})

it("rejects late publication receipts and an older recycled publisher instance", () => {
  const f = fixture()
  const old = f.receipt()
  f.releaseReceiver()
  f.state.adapter.registerReceiver(scope, f.receiver)
  f.state.receiveCommit(JSON.stringify(old))
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  f.acknowledge({ publisher: "replacement-publisher", instance: 2, sequence: 1 })
  const binding = f.state.adapter.bindingFor(scope)
  f.acknowledge({ publisher: "native-publisher", instance: 1, sequence: 999 })
  expect(f.state.adapter.bindingFor(scope)).toBe(binding)
  const request = f.request()
  f.respond(request)
  expect(request.receive.mock.calls).toEqual([[false]])
})

it("clears a previously acknowledged receiver when native observation reports it unavailable", () => {
  const f = fixture()
  f.acknowledge()
  const request = f.request()
  const receipt = f.receipt()
  receipt.registrations = receipt.registrations.slice(0, 1)
  f.state.receiveCommit(JSON.stringify(receipt))
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  expect(request.receive.mock.calls).toEqual([[false]])
  f.acknowledge()
  expect(request.receive).toHaveBeenCalledTimes(1)
})

it("preserves the approved current intent through an unobserved clipping interval", () => {
  const f = fixture()
  f.acknowledge()
  const request = f.request()
  // No native invalidation is delivered for this hypothetical generic clip-out/clip-in.
  // This tests the accepted JS contract, not native clipping detection or visibility.
  f.respond(request)
  expect(request.receive.mock.calls).toEqual([[true]])
})

it("permits an already native-approved callback after an unobserved visibility change during delivery", () => {
  const f = fixture()
  f.acknowledge()
  const request = f.request()
  // The adapter cannot inspect current native geometry. A current one-shot receipt is historical admission.
  f.respond(request)
  expect(request.receive.mock.calls).toEqual([[true]])
  expect(f.state.adapter.bindingFor(scope)).not.toBe("")
})

it("does not clear an existing root lifetime merely because another receiver is awaiting native acknowledgement", () => {
  const f = fixture()
  f.acknowledge()
  const before = f.state.adapter.ownerLifetimeFor(scope.ownerId, scope.generation)
  f.state.adapter.registerReceiver({ ...scope, itemId: "foreign" }, { tag: 30 })
  expect(f.state.adapter.ownerLifetimeFor(scope.ownerId, scope.generation)).toBe(before)
  expect(f.state.adapter.bindingFor({ ...scope, itemId: "foreign" })).toBe("")
})

it("rejects malformed publications before registering an owner", () => {
  const state = createNativeVisibleCollectionAdmission(() => 10)
  expect(() => state.adapter.registerOwner("{}", {})).toThrow("complete explicit model")
})

it("distinguishes unrelated originals from unavailable collection targets for focus dispatch", () => {
  const f = fixture()
  expect(nativeCollectionFocusBinding({ tag: 20 })).toBeNull()
  expect(nativeCollectionFocusBinding(f.receiver)).toBe("")
  f.acknowledge()
  expect(nativeCollectionFocusBinding(f.receiver)).toBe(f.state.adapter.bindingFor(scope))
  f.state.setActive(false)
  expect(nativeCollectionFocusBinding(f.receiver)).toBe("")
  f.releaseReceiver()
  expect(nativeCollectionFocusBinding(f.receiver)).toBeNull()
})

it("revokes an old captured focus binding on exact-ref replacement even with a reused tag", () => {
  const f = fixture()
  f.acknowledge()
  const captured = nativeCollectionFocusBinding(f.receiver)
  f.releaseReceiver()
  const replacement = { tag: 20 }
  f.state.adapter.registerReceiver(scope, replacement)
  expect(nativeCollectionFocusBinding(replacement)).toBe("")
  f.acknowledge()
  expect(nativeCollectionFocusBinding(replacement)).not.toBe(captured)
})

it("queues raw editor focus with an acknowledged native lease and never uses the editor's own focus fallback", () => {
  const root = { tag: 10 },
    editor = { tag: 20 }
  const dispatch = jest.fn(() => true)
  const state = createNativeVisibleCollectionAdmission((value) => (value as { tag: number }).tag, dispatch)
  const releaseRoot = state.adapter.registerOwner(model, root)
  const releaseEditor = state.adapter.registerReceiver(scope, editor)
  expect(requestNativeCollectionTextInputFocus(editor)).toBe(false)
  expect(dispatch).not.toHaveBeenCalled()
  const publication = JSON.parse(state.publication())
  state.receiveCommit(
    JSON.stringify({
      intent: publication.intent,
      publisher: "publisher",
      instance: 1,
      sequence: 1,
      lifetime: "root",
      registrations: [publication.root, ...publication.receivers].map((entry: { id: string; tag: number }) => ({
        ...entry,
        binding: `lease:${entry.id}`,
      })),
    }),
  )
  expect(requestNativeCollectionTextInputFocus(editor)).toBe(true)
  expect(dispatch).toHaveBeenCalledWith(20, state.adapter.bindingFor(scope))
  state.setActive(false)
  expect(requestNativeCollectionTextInputFocus(editor)).toBe(false)
  releaseEditor()
  releaseRoot()
  expect(requestNativeCollectionTextInputFocus(editor)).toBeNull()
})

it("rejects a pending action immediately when another occurrence claims the same original receiver", () => {
  const f = fixture()
  f.releaseRoot()
  const other = { ...scope, itemId: "other" }
  f.state.adapter.registerOwner(JSON.stringify({ ...JSON.parse(model), items: [scope, other] }), f.root)
  f.acknowledge()
  const request = f.request()
  f.state.adapter.registerReceiver(other, f.receiver)
  expect(request.receive.mock.calls).toEqual([[false]])
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  f.acknowledge()
  expect(f.state.adapter.bindingFor(scope)).toBe("")
  expect(f.state.adapter.bindingFor(other)).toBe("")
  f.respond(request)
  expect(request.receive.mock.calls).toEqual([[false]])
})
