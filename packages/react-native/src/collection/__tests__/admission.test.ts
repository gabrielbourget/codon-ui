import type { NativeCollectionCommitData } from "../../input/specs/CUICollectionRootNativeComponent"
import { NativeCollectionAdmission } from "../admission"
import type { TNativeCollectionDescriptor } from "../snapshot"

type TValue = { title: string }
const root = { ownerId: "owner", rootId: "root", rootRevision: "root:1", target: 20 }
const descriptor = (revision = "1"): TNativeCollectionDescriptor<TValue> => ({
  descriptorId: "a",
  descriptorRevision: revision,
  key: "a",
  type: "item",
  value: { title: "Original" },
  rendered: "Original",
  textValue: "Original",
  props: {},
})
// Synthetic native packets exercise the join's guards; these tests provide no native SDK/input evidence.
const packet = (sequence = 1, revision = "1"): NativeCollectionCommitData => ({
  ...root,
  surfaceId: 11,
  windowId: "window",
  epoch: 1,
  sequence,
  mountRevision: String(sequence),
  attached: true,
  complete: true,
  metadataOnly: true,
  error: "",
  hierarchy: JSON.stringify([
    {
      descriptorId: "a",
      descriptorRevision: revision,
      parentDescriptorId: "",
      target: 22,
      index: 0,
      retainedIndex: 0,
      hasRetainedChildren: false,
    },
  ]),
})

it("publishes only after both the current native receipt and exact committed JS revision exist", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  const draft = descriptor()
  admission.receive(packet())
  expect(admission.getSnapshot()).toMatchObject({
    status: "pending",
    collection: null,
    error: "uncommitted-descriptor",
  })
  const retire = admission.commitDescriptor(draft)
  const confirmed = admission.getSnapshot()
  expect(confirmed.status).toBe("confirmed")
  expect(confirmed.collection?.getItem("a")?.value).toBe(draft.value)
  const replacement = descriptor("2")
  admission.commitDescriptor(replacement)
  expect(admission.getSnapshot().collection).toBeNull()
  expect(admission.getSnapshot().status).toBe("pending")
  admission.receive(packet(2, "2"))
  expect(admission.getSnapshot().collection?.getItem("a")?.value).toBe(replacement.value)
  retire()
  expect(admission.getSnapshot().status).toBe("confirmed")
  expect(confirmed.collection?.getItem("a")?.value).toBe(draft.value)
})

it("retires each committed lifetime independently even when Activity restores the same revision", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  const value = descriptor()
  const oldCleanup = admission.commitDescriptor(value)
  admission.receive(packet())
  const restoredCleanup = admission.commitDescriptor(value)
  oldCleanup()
  expect(admission.getSnapshot().status).toBe("confirmed")
  restoredCleanup()
  expect(admission.getSnapshot()).toMatchObject({ status: "pending", collection: null })
})

it("does not republish or reorder when unrelated hidden payloads commit", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  admission.commitDescriptor(descriptor())
  admission.receive(packet())
  const listener = jest.fn()
  const unsubscribe = admission.subscribe(listener)
  const initial = admission.getSnapshot()
  admission.commitDescriptor({ ...descriptor(), descriptorId: "hidden", key: "hidden" })
  expect(admission.getSnapshot()).toBe(initial)
  expect(listener).not.toHaveBeenCalled()
  unsubscribe()
})

it.each(["ownerId", "rootId", "rootRevision", "target"] as const)(
  "ignores a foreign %s and stale sequence",
  (field) => {
    const admission = new NativeCollectionAdmission<TValue>(root)
    admission.commitDescriptor(descriptor())
    admission.receive(packet(2))
    const confirmed = admission.getSnapshot()
    expect(admission.receive({ ...packet(3), [field]: field === "target" ? 99 : "foreign" })).toBe(false)
    expect(admission.receive(packet(1))).toBe(false)
    expect(admission.getSnapshot()).toBe(confirmed)
  },
)

it("rejects changed window/surface in one epoch and older packets after a genuine epoch change", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  admission.commitDescriptor(descriptor())
  admission.receive(packet())
  expect(admission.receive({ ...packet(2), windowId: "other" })).toBe(false)
  expect(admission.receive({ ...packet(2), surfaceId: 12 })).toBe(false)
  expect(admission.receive({ ...packet(3), epoch: 2, windowId: "other", surfaceId: 12 })).toBe(true)
  expect(admission.receive(packet(4))).toBe(false)
  expect(admission.getSnapshot().lease).toMatchObject({ epoch: 2, windowId: "other", surfaceId: 12, sequence: 3 })
})

it.each(["complete", "attached", "metadataOnly"] as const)(
  "invalidates the previous confirmation for %s=false without accepting an older rescue",
  (field) => {
    const admission = new NativeCollectionAdmission<TValue>(root)
    admission.commitDescriptor(descriptor())
    admission.receive(packet())
    admission.receive({ ...packet(3), [field]: false })
    expect(admission.getSnapshot()).toMatchObject({ status: "rejected", collection: null })
    expect(admission.receive(packet(2))).toBe(false)
    admission.commitDescriptor({ ...descriptor(), descriptorId: "hidden", key: "hidden" })
    expect(admission.getSnapshot().status).toBe("rejected")
    admission.receive(packet(4))
    expect(admission.getSnapshot().status).toBe("confirmed")
  },
)

it.each(["{", "{}", '[{"descriptorId":"a"}]'])(
  "rejects malformed hierarchy without exposing the old collection: %s",
  (hierarchy) => {
    const admission = new NativeCollectionAdmission<TValue>(root)
    admission.commitDescriptor(descriptor())
    admission.receive(packet())
    admission.receive({ ...packet(2), hierarchy })
    expect(admission.getSnapshot()).toMatchObject({ status: "rejected", collection: null })
  },
)

it("keeps a malformed lease from being rescued by a later descriptor effect", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  admission.commitDescriptor(descriptor())
  admission.receive(packet(2))
  admission.receive({ ...packet(3), sequence: 3.1 })
  admission.commitDescriptor({ ...descriptor(), descriptorId: "hidden", key: "hidden" })
  expect(admission.getSnapshot()).toMatchObject({ status: "rejected", collection: null })
  expect(admission.receive(packet(1))).toBe(false)
  expect(admission.receive(packet(4))).toBe(true)
})

it.each(["legacy-index", "negative-index", "root-as-child"])(
  "rejects unusable retained hierarchy metadata: %s",
  (kind) => {
    const admission = new NativeCollectionAdmission<TValue>(root)
    admission.commitDescriptor(descriptor())
    admission.receive(packet())
    const next = packet(2)
    const hierarchy = JSON.parse(next.hierarchy) as Record<string, unknown>[]
    if (kind === "legacy-index") delete hierarchy[0].retainedIndex
    if (kind === "negative-index") hierarchy[0].retainedIndex = -1
    if (kind === "root-as-child") hierarchy[0].target = root.target
    admission.receive({ ...next, hierarchy: JSON.stringify(hierarchy) })
    expect(admission.getSnapshot()).toMatchObject({ status: "rejected", collection: null })
  },
)

it("requires immutable revision payloads and preserves the source's changed-ID prohibition", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  const first = descriptor()
  admission.commitDescriptor(first)
  expect(() => admission.commitDescriptor(descriptor())).toThrow("reused-descriptor-revision")
  expect(() => admission.commitDescriptor({ ...descriptor("2"), key: "b" })).toThrow("Cannot change the id of an item")
  expect(Object.isFrozen(first)).toBe(true)
  expect(Object.isFrozen(first.value)).toBe(false)
})

it("retirement releases subscribers/payloads and permanently refuses delayed receipts and descriptors", () => {
  const admission = new NativeCollectionAdmission<TValue>(root)
  admission.commitDescriptor(descriptor())
  admission.receive(packet())
  const listener = jest.fn()
  admission.subscribe(listener)
  admission.dispose()
  expect(listener).toHaveBeenCalledTimes(1)
  expect(admission.getSnapshot()).toMatchObject({ status: "retired", collection: null, lease: null })
  expect(admission.receive(packet(2))).toBe(false)
  expect(() => admission.commitDescriptor(descriptor("2"))).toThrow("retired-collection-root")
  admission.dispose()
  expect(listener).toHaveBeenCalledTimes(1)
})
