import type { NativeFormCommitData } from "../../input/specs/CUIFormRootNativeComponent"
import { NativeFormMountReceipt } from "../mount"
import { NativeFieldSemanticSession } from "../semanticSession"

const flush = () => new Promise<void>((resolve) => setImmediate(resolve))
const setup = () => {
  const metadata = {},
    original = {}
  let live = true
  const packet: NativeFormCommitData = {
    ownerId: "owner",
    descriptorId: "field",
    descriptorRevision: "revision",
    target: 11,
    originalTarget: 12,
    surfaceId: 1,
    windowId: "window",
    epoch: 1,
    sequence: 1,
    mountRevision: "mount:1",
    attached: true,
    active: true,
    complete: true,
    metadataOnly: true,
    originalClass: "OriginalEditor",
    error: "",
  }
  const receipt = new NativeFormMountReceipt(packet, {
    metadata,
    original,
    current: () => (live ? { metadata, original } : { metadata: null, original: null }),
  })
  receipt.receive(packet)
  const pending: {
    request: Record<string, unknown>
    resolve: (result: string) => void
    reject: (error: Error) => void
  }[] = []
  const runtime = {
    bindField: jest.fn(
      (encoded: string) =>
        new Promise<string>((resolve, reject) => pending.push({ request: JSON.parse(encoded), resolve, reject })),
    ),
    unbindField: jest.fn(async (_encoded: string) => true),
  }
  const session = new NativeFieldSemanticSession(receipt, runtime)
  const reply = (index: number, updates: Record<string, unknown> = {}) =>
    pending[index].resolve(
      JSON.stringify({
        requestId: pending[index].request.requestId,
        ownerToken: `native-token:${index}`,
        metadataTarget: 11,
        ...updates,
      }),
    )
  return {
    session,
    receipt,
    packet,
    pending,
    runtime,
    reply,
    replace: () => {
      live = false
    },
  }
}

it("owns one native watch across current semantic updates and releases its exact token", async () => {
  const value = setup()
  value.session.observe("frame:1")
  await flush()
  value.reply(0)
  await flush()
  value.receipt.receive({ ...value.packet, sequence: 2 })
  value.session.observe("frame:2")
  await flush()
  expect(value.runtime.bindField).toHaveBeenCalledTimes(1)
  value.session.retire()
  await flush()
  expect(JSON.parse(value.runtime.unbindField.mock.calls[0][0])).toEqual({
    metadataTarget: 11,
    ownerToken: "native-token:0",
  })
  expect(value.receipt.getSnapshot()?.complete).toBe(true)
})

it("releases an acknowledged watch that completes after original-ref retirement", async () => {
  const value = setup()
  value.session.observe("frame")
  await flush()
  value.replace()
  value.reply(0)
  await flush()
  expect(value.runtime.unbindField).toHaveBeenCalledTimes(1)
  expect(value.receipt.isRetired).toBe(true)
})

it("does not dispatch a queued binding after its owner retires", async () => {
  const value = setup()
  value.session.observe("frame")
  value.session.retire()
  await flush()
  expect(value.runtime.bindField).not.toHaveBeenCalled()
})

it("retains logical membership while inactive and acquires a new epoch watch on restoration", async () => {
  const value = setup()
  value.session.observe("frame")
  await flush()
  value.reply(0)
  await flush()
  value.receipt.receive({ ...value.packet, active: false, epoch: 2, sequence: 2 })
  value.session.observe("frame")
  await flush()
  expect(value.receipt.getSnapshot()).toMatchObject({ complete: true, active: false })
  expect(value.runtime.unbindField).toHaveBeenCalledTimes(1)
  value.receipt.receive({ ...value.packet, epoch: 3, sequence: 3 })
  value.session.observe("frame")
  await flush()
  expect(value.runtime.bindField).toHaveBeenCalledTimes(2)
})

it("releases a late old-window token before adopting the latest acknowledged window", async () => {
  const value = setup()
  value.session.observe("frame")
  await flush()
  value.receipt.receive({ ...value.packet, windowId: "replacement", epoch: 2, sequence: 2 })
  value.session.observe("frame")
  value.reply(0)
  await flush()
  expect(value.runtime.unbindField).toHaveBeenCalledTimes(1)
  expect(value.runtime.bindField).toHaveBeenCalledTimes(2)
  expect((value.pending[1].request.mount as NativeFormCommitData).windowId).toBe("replacement")
})

it("does not retry an unchanged failed acknowledgment", async () => {
  const value = setup()
  value.session.observe("frame")
  await flush()
  value.pending[0].reject(new Error("retired"))
  await flush()
  value.session.observe("frame")
  await flush()
  expect(value.runtime.bindField).toHaveBeenCalledTimes(1)
})

it("coalesces replacement acknowledgments while an older binding is pending", async () => {
  const value = setup()
  value.session.observe("frame:1")
  await flush()
  value.receipt.receive({ ...value.packet, sequence: 2 })
  value.session.observe("frame:2")
  value.receipt.receive({ ...value.packet, sequence: 3 })
  value.session.observe("frame:3")
  value.pending[0].reject(new Error("superseded"))
  await flush()
  expect(value.runtime.bindField).toHaveBeenCalledTimes(2)
  expect(value.pending[1].request.semanticBinding).toBe("frame:3")
})

it.each([{ requestId: "foreign" }, { metadataTarget: 99 }, { ownerToken: "" }])(
  "rejects a foreign/incomplete binding response %p",
  async (updates) => {
    const value = setup()
    value.session.observe("frame")
    await flush()
    value.reply(0, updates)
    await flush()
    value.session.retire()
    await flush()
    expect(value.runtime.unbindField).not.toHaveBeenCalled()
    expect(value.runtime.bindField).toHaveBeenCalledTimes(1)
  },
)

it("excludes unowned event data from the native binding request", async () => {
  const value = setup()
  value.receipt.receive({ ...value.packet, sequence: 2, query: "business query" } as NativeFormCommitData)
  value.session.observe("semantic IDs only")
  await flush()
  expect(JSON.stringify(value.pending[0].request)).not.toContain("business query")
  expect(value.pending[0].request.mount).toEqual({ ...value.packet, sequence: 2 })
})
