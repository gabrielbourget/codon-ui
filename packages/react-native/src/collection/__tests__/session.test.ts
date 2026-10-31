import type { NativeCollectionCommitData } from "../../input/specs/CUICollectionRootNativeComponent"
import { NativeCollectionSession } from "../session"
import type { TNativeCollectionDescriptor } from "../snapshot"

const scope = { ownerId: "owner", rootId: "root", rootRevision: "root:1" }
const descriptor = (revision = "1"): TNativeCollectionDescriptor<{ title: string }> => ({
  descriptorId: "a",
  descriptorRevision: revision,
  key: "a",
  type: "item",
  value: { title: "Original" },
  props: {},
  rendered: "Original",
  textValue: "Original",
})
const packet = (target: number, sequence = 1, revision = "1"): NativeCollectionCommitData => ({
  ...scope,
  target,
  surfaceId: 11,
  windowId: "source-model-window",
  epoch: 1,
  sequence,
  mountRevision: "source-model",
  attached: true,
  complete: true,
  metadataOnly: true,
  error: "",
  hierarchy: JSON.stringify([
    {
      descriptorId: "a",
      descriptorRevision: revision,
      target: 9001,
      parentDescriptorId: "",
      index: 0,
      retainedIndex: 0,
      hasRetainedChildren: false,
    },
  ]),
})

it("cannot publish from an early callback until an independent committed host ref binds its exact target", () => {
  const session = new NativeCollectionSession(scope)
  session.commitDescriptor(descriptor())
  session.receive(packet(7001))
  expect(session.getSnapshot().receipt.collection).toBeNull()
  expect(session.getSnapshot().collection.size).toBe(0)
  session.bindRootTarget(7001)
  expect(session.getSnapshot().receipt.status).toBe("confirmed")
  expect(session.getSnapshot().collection.size).toBe(1)
})

it("does not derive host authority from a buffered foreign target or owner", () => {
  const session = new NativeCollectionSession(scope)
  session.commitDescriptor(descriptor())
  session.receive(packet(6001))
  session.receive({ ...packet(7001), ownerId: "foreign" })
  session.bindRootTarget(7001)
  expect(session.getSnapshot().receipt.status).toBe("pending")
  expect(session.getSnapshot().collection.size).toBe(0)
  expect(session.receive(packet(7001, 2))).toBe(true)
  expect(session.getSnapshot().receipt.status).toBe("confirmed")
})

it("keeps the previous complete renderer tree while current authority is absent or a replacement revision is pending", () => {
  const session = new NativeCollectionSession(scope)
  session.commitDescriptor(descriptor())
  session.bindRootTarget(7001)
  session.receive(packet(7001))
  const previous = session.getSnapshot().collection
  session.commitDescriptor(descriptor("2"))
  expect(session.getSnapshot().receipt.status).toBe("pending")
  expect(session.getSnapshot().receipt.collection).toBeNull()
  expect(session.getSnapshot().collection).toBe(previous)
  session.bindRootTarget(null)
  expect(session.getSnapshot().receipt.error).toBe("awaiting-native-root")
  expect(session.getSnapshot().collection).toBe(previous)
  session.bindRootTarget(7001)
  expect(session.getSnapshot().receipt.collection).toBeNull()
  session.receive(packet(7001, 2, "2"))
  expect(session.getSnapshot().receipt.status).toBe("confirmed")
  expect(session.getSnapshot().collection).not.toBe(previous)
})

it("ignores delayed cleanup for a replaced committed descriptor lifetime", () => {
  const session = new NativeCollectionSession(scope)
  const retired = session.commitDescriptor(descriptor())
  session.bindRootTarget(7001)
  session.commitDescriptor(descriptor("2"))
  session.receive(packet(7001, 2, "2"))
  retired()
  expect(session.getSnapshot().receipt.status).toBe("confirmed")
})

it("retirement and rebinding cannot inherit the former target's acknowledgement", () => {
  const session = new NativeCollectionSession(scope)
  session.commitDescriptor(descriptor())
  session.bindRootTarget(7001)
  session.receive(packet(7001))
  const previous = session.getSnapshot().collection
  session.bindRootTarget(null)
  session.bindRootTarget(7002)
  expect(session.getSnapshot().receipt.status).toBe("pending")
  expect(session.getSnapshot().collection).toBe(previous)
  expect(session.receive(packet(7001, 3))).toBe(false)
  expect(session.getSnapshot().receipt.collection).toBeNull()
  session.receive(packet(7002))
  expect(session.getSnapshot().receipt.status).toBe("confirmed")
})
