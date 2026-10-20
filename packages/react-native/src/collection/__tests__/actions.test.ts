import type {
  NativeCollectionActionData,
  NativeCollectionCommitData,
} from "../../input/specs/CUICollectionRootNativeComponent"
import { NativeCollectionActions } from "../actions"
import { NativeCollectionSession } from "../session"

const fixture = () => {
  const session = new NativeCollectionSession<unknown>({ ownerId: "owner", rootId: "root", rootRevision: "revision" })
  session.bindRootTarget(7)
  const descriptor = {
    descriptorId: "item",
    descriptorRevision: "v1",
    key: 0,
    type: "item",
    value: { secret: "owner value" },
    props: { children: "Original", onAction: jest.fn() },
    rendered: "Original",
    textValue: "Original",
  }
  session.commitDescriptor(descriptor)
  const commit: NativeCollectionCommitData = {
    ...session.scope,
    target: 7,
    surfaceId: 11,
    windowId: "window",
    epoch: 1,
    sequence: 1,
    mountRevision: "mount",
    attached: true,
    complete: true,
    metadataOnly: true,
    error: "",
    hierarchy: JSON.stringify([
      {
        descriptorId: "item",
        descriptorRevision: "v1",
        parentDescriptorId: "",
        target: 8,
        index: 0,
        retainedIndex: 0,
        hasRetainedChildren: false,
      },
    ]),
  }
  const actions = new NativeCollectionActions(session)
  return { session, descriptor, commit, actions, confirm: () => session.receive(commit) }
}
const reply = (actions: NativeCollectionActions): NativeCollectionActionData => {
  const [request] = JSON.parse(actions.getSnapshot())
  return {
    ...JSON.parse(request.binding),
    requestId: request.requestId,
    visibleTarget: request.visibleTarget,
    accepted: true,
  }
}

it("requires the exact confirmed node and a materialized original native target", () => {
  const f = fixture(),
    action = jest.fn()
  expect(f.actions.bindingFor(null)).toBe("")
  expect(f.actions.request(null, 9, action)).toBe(false)
  f.confirm()
  const node = f.session.getSnapshot().collection.getItem(0)!
  for (const target of [0, -1, NaN, Infinity, 9.5, 2147483648])
    expect(f.actions.request(node, target, action)).toBe(false)
  expect(f.actions.request({ ...node }, 9, action)).toBe(false)
  expect(action).not.toHaveBeenCalled()
})

it("admits once only after an original matching native acknowledgement, without serializing caller payloads", () => {
  const f = fixture(),
    action = jest.fn()
  f.confirm()
  expect(f.actions.request(f.session.getSnapshot().collection.getItem(0)!, 9, action)).toBe(true)
  expect(action).not.toHaveBeenCalled()
  expect(f.actions.getSnapshot()).not.toContain("owner value")
  expect(f.actions.getSnapshot()).not.toContain("Original")
  const packet = reply(f.actions)
  expect(f.actions.receive(packet)).toBe(true)
  expect(f.actions.receive(packet)).toBe(false)
  expect(action).toHaveBeenCalledTimes(1)
  expect(f.actions.getSnapshot()).toBe("[]")
})

it("admits an owned filtered node only through its unchanged opaque descriptor identity", () => {
  const f = fixture(),
    action = jest.fn()
  f.confirm()
  const filtered = f.session.getSnapshot().collection.filter(() => true)
  const node = filtered.getItem(0)!
  expect(node).not.toBe(f.session.getSnapshot().collection.getItem(0))
  expect(f.actions.request(node, 9, action)).toBe(true)
  expect(f.actions.request({ ...node }, 9, action)).toBe(false)
  expect(f.actions.receive(reply(f.actions))).toBe(true)
  expect(action).toHaveBeenCalledTimes(1)
})

it("retains a current request across foreign-owner/root/visible-target callbacks", () => {
  const f = fixture(),
    action = jest.fn()
  f.confirm()
  f.actions.request(f.session.getSnapshot().collection.getItem(0)!, 9, action)
  const packet = reply(f.actions)
  for (const changed of [
    { ownerId: "other" },
    { rootId: "other" },
    { rootRevision: "other" },
    { target: 99 },
    { visibleTarget: 99 },
  ]) {
    expect(f.actions.receive({ ...packet, ...changed })).toBe(false)
    expect(action).not.toHaveBeenCalled()
  }
  expect(f.actions.receive(packet)).toBe(true)
})

it.each(["surfaceId", "windowId", "epoch", "sequence", "accepted"] as const)(
  "rejects a native %s mismatch and consumes its response",
  (field) => {
    const f = fixture(),
      action = jest.fn()
    f.confirm()
    f.actions.request(f.session.getSnapshot().collection.getItem(0)!, 9, action)
    const packet = reply(f.actions)
    const value = field === "windowId" ? "other" : field === "accepted" ? false : packet[field] + 1
    expect(f.actions.receive({ ...packet, [field]: value })).toBe(false)
    expect(f.actions.getSnapshot()).toBe("[]")
    expect(action).not.toHaveBeenCalled()
  },
)

it("rejects a replaced descriptor even if an earlier native admission arrives late", () => {
  const f = fixture(),
    action = jest.fn()
  f.confirm()
  f.actions.request(f.session.getSnapshot().collection.getItem(0)!, 9, action)
  const packet = reply(f.actions)
  f.session.commitDescriptor({ ...f.descriptor, descriptorRevision: "v2" })
  expect(f.actions.receive(packet)).toBe(false)
  expect(f.actions.getSnapshot()).toBe("[]")
  expect(action).not.toHaveBeenCalled()
})

it("supports the original root binding for empty-list selection and cancels requests on root retirement", () => {
  const f = fixture(),
    action = jest.fn()
  f.confirm()
  f.actions.request(null, 9, action)
  expect(JSON.parse(JSON.parse(f.actions.getSnapshot())[0].binding).descriptorId).toBe("")
  const packet = reply(f.actions)
  f.actions.reset()
  f.session.bindRootTarget(null)
  expect(f.actions.receive(packet)).toBe(false)
  expect(f.actions.getSnapshot()).toBe("[]")
  expect(action).not.toHaveBeenCalled()
})
