import type { NativeSyntheticEvent, View } from "react-native"

import { NativeFieldInputSession, type TNativeFieldInputPlan } from "../fieldInputBinding"
import type { NativeFormCommitData } from "../specs/CUIFormRootNativeComponent"

const plan = (): TNativeFieldInputPlan =>
  Object.freeze({
    bindingId: "field:1",
    bindingRevision: "revision:1",
    outer: {} as View,
    outerTarget: 2,
    input: {} as View,
    inputTarget: 3,
    originalTarget: 10,
  })
const mount = (extra: Partial<NativeFormCommitData> = {}): NativeFormCommitData => ({
  ownerId: "field-owner",
  descriptorId: "descriptor",
  descriptorRevision: "value:1",
  target: 15,
  originalTarget: 10,
  surfaceId: 11,
  windowId: "window:1",
  epoch: 2,
  sequence: 1,
  mountRevision: "mount:1",
  attached: true,
  active: true,
  complete: true,
  metadataOnly: true,
  originalClass: "CUIDateSegment",
  error: "",
  ...extra,
})
const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
const setup = () => {
  const pending: Array<{
    request: { requestId: string; mount: NativeFormCommitData; fieldGroupBinding: string }
    resolve: (value: string) => void
    reject: (error: Error) => void
  }> = []
  const native = {
    getLease: jest.fn(() => "module:1"),
    acceptsField: jest.fn(),
    settleField: jest.fn(),
    moveFieldFocus: jest.fn(),
  }
  const document = {
    bindFieldInput: jest.fn(
      (encoded: string) =>
        new Promise<string>((resolve, reject) => {
          pending.push({ request: JSON.parse(encoded), resolve, reject })
        }),
    ),
    unbindFieldInput: jest.fn(async (_encoded: string) => true),
  }
  const session = new NativeFieldInputSession(native, document),
    original = plan(),
    scope = session.scope(original)
  const status = (index = 0, changes: Record<string, unknown> = {}) => {
    const request = pending[index].request,
      declaration = JSON.parse(request.fieldGroupBinding)
    return {
      kind: "binding-status",
      requestId: request.requestId,
      ownerToken: `owner:${index}`,
      metadataTarget: request.mount.target,
      ownerId: request.mount.ownerId,
      moduleLease: declaration.moduleLease,
      bindingId: declaration.bindingId,
      bindingRevision: declaration.bindingRevision,
      generation: 1,
      ready: true,
      error: "",
      ...changes,
    }
  }
  const receive = (value: unknown, metadata = session.metadataFor(original)) =>
    metadata.receive({
      nativeEvent: { record: JSON.stringify(value) },
    } as NativeSyntheticEvent<Readonly<{ record: string }>>)
  const reply = async (index = 0, changes: Record<string, unknown> = {}) => {
    const call = pending[index]
    call.resolve(
      JSON.stringify({
        requestId: call.request.requestId,
        ownerToken: `owner:${index}`,
        metadataTarget: call.request.mount.target,
        status: status(index, changes),
      }),
    )
    await tick()
  }
  session.configure(original)
  return {
    session,
    original,
    scope,
    metadata: session.metadataFor(original),
    document,
    native,
    pending,
    reply,
    status,
    receive,
  }
}

it("installs only after a complete original mount and grants authority only after the matching native reply", async () => {
  const f = setup()
  expect(f.scope.current()).toBe(false)
  expect(f.document.bindFieldInput).not.toHaveBeenCalled()
  const packet = mount()
  f.metadata.commit(packet)
  f.metadata.commit(packet)
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  expect(f.scope.current()).toBe(false)
  expect(JSON.parse(f.document.bindFieldInput.mock.calls[0][0])).toMatchObject({
    mount: packet,
    fieldGroupBinding: f.metadata.binding(packet.ownerId),
  })
  expect(JSON.parse(f.metadata.binding(packet.ownerId))).toEqual({
    version: 1,
    ownerId: packet.ownerId,
    bindingId: "field:1",
    bindingRevision: "revision:1",
    moduleLease: "module:1",
    outerTarget: 2,
    inputTarget: 3,
  })
  await f.reply()
  expect(f.scope.current()).toBe(true)
  f.metadata.commit(mount({ descriptorRevision: "value:2", mountRevision: "mount:2", sequence: 2 }))
  expect(f.scope.current()).toBe(true)
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  expect(f.document.unbindFieldInput).not.toHaveBeenCalled()
})

it.each([
  { active: false },
  { attached: false },
  { complete: false },
  { metadataOnly: false },
  { error: "retired" },
  { originalTarget: 99 },
])("withdraws current authority for an unsafe original mount %j", async (change) => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply()
  f.metadata.commit(mount(change))
  expect(f.scope.current()).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledWith(
    JSON.stringify({ metadataTarget: 15, ownerToken: "owner:0" }),
  )
})

it("cleans a late installation after unmount without granting it authority", async () => {
  const f = setup()
  f.metadata.commit(mount())
  f.session.retire()
  await f.reply()
  expect(f.scope.current()).toBe(false)
  expect(f.session.status().ready).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledWith(
    JSON.stringify({ metadataTarget: 15, ownerToken: "owner:0" }),
  )
})

it("retires old scopes on root/callback revision replacement and preserves a newer binding across an older reply", async () => {
  const f = setup()
  f.metadata.commit(mount())
  const next = Object.freeze({ ...plan(), bindingRevision: "revision:2" }),
    metadata = f.session.metadataFor(next),
    scope = f.session.scope(next)
  f.session.configure(next)
  f.metadata.commit(mount())
  expect(f.pending).toHaveLength(1)
  metadata.commit(mount())
  await f.reply(1)
  expect(scope.current()).toBe(true)
  await f.reply(0)
  expect(scope.current()).toBe(true)
  expect(f.scope.current()).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledTimes(1)
  expect(JSON.parse(f.document.unbindFieldInput.mock.calls[0][0]).ownerToken).toBe("owner:0")
})

it.each([{ target: 16 }, { ownerId: "replacement" }, { surfaceId: 12 }, { windowId: "window:2" }])(
  "does not accept a pending reply for replaced original metadata %j",
  async (change) => {
    const f = setup()
    f.metadata.commit(mount())
    f.metadata.commit(mount(change))
    await f.reply(0)
    expect(f.scope.current()).toBe(false)
    await f.reply(1)
    expect(f.scope.current()).toBe(true)
    expect(f.document.unbindFieldInput).toHaveBeenCalledTimes(1)
  },
)

it("loses current authority when the actual module lease retires and cleans the late native reply", async () => {
  const f = setup()
  f.metadata.commit(mount())
  f.native.getLease.mockReturnValue("module:replacement")
  await f.reply()
  expect(f.scope.current()).toBe(false)
  expect(f.session.status().ready).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledTimes(1)
})

it("retains the first native installation failure without retrying the same plan", async () => {
  const f = setup()
  f.metadata.commit(mount())
  f.pending[0].reject(new Error("original-native-bind-failed"))
  await tick()
  f.metadata.commit(mount({ sequence: 2 }))
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  expect(f.session.status()).toMatchObject({ ready: false, pending: false, error: "original-native-bind-failed" })
})

it.each([null, {}, { requestId: "foreign", ownerToken: "owner:0", metadataTarget: 15 }])(
  "rejects a malformed/foreign installation reply %j",
  async (value) => {
    const f = setup()
    f.metadata.commit(mount())
    f.pending[0].resolve(JSON.stringify(value))
    await tick()
    expect(f.scope.current()).toBe(false)
    expect(f.session.status().error).toBe("field-input-binding-response-invalid")
    f.metadata.commit(mount())
    expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  },
)

it("rejects invalid root plans before a native installation", () => {
  const f = setup()
  expect(() => f.session.configure({ ...f.original, inputTarget: 2 })).toThrow("field-input-plan-invalid")
  expect(() => f.session.configure({ ...f.original, outerTarget: 0 })).toThrow("field-input-plan-invalid")
  expect(f.document.bindFieldInput).not.toHaveBeenCalled()
})

it("retains synchronous native method failures without granting or retrying an installation", async () => {
  const f = setup()
  f.document.bindFieldInput.mockImplementation(() => {
    throw new Error("original-native-module-threw")
  })
  f.metadata.commit(mount())
  await tick()
  f.metadata.commit(mount())
  expect(f.session.status()).toMatchObject({ ready: false, error: "original-native-module-threw" })
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
})

it("retires old callback scopes while retaining the native watch over unchanged original roots", async () => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply()
  const next = Object.freeze({ ...f.original, bindingRevision: "new-callback-and-traits" }),
    current = f.session.scope(next)
  f.session.configure(next)
  expect(f.scope.current()).toBe(false)
  expect(current.current()).toBe(false)
  f.receive(f.status(0, { bindingRevision: next.bindingRevision, generation: 2 }), f.session.metadataFor(next))
  expect(current.current()).toBe(true)
  expect(f.document.unbindFieldInput).not.toHaveBeenCalled()
  f.session.metadataFor(next).commit(mount({ descriptorRevision: "value:2", mountRevision: "mount:2", sequence: 2 }))
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  f.session.configure({ ...next, outer: {} as View })
  expect(current.current()).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledTimes(1)
})

it("keeps an installed registration inactive until a genuine later native readiness status", async () => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply(0, { ready: false, error: "field-input-document-retired-during-read" })
  expect(f.session.status()).toMatchObject({ ready: false, pending: true })
  expect(f.scope.current()).toBe(false)
  f.metadata.commit(mount({ sequence: 2, mountRevision: "mount:2" }))
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
  f.receive(f.status(0, { generation: 2 }))
  expect(f.session.status()).toEqual({ ready: true, pending: false, error: "" })
  expect(f.scope.current()).toBe(true)
})

it("revokes native-invalidated authority and admits only a newer current readiness generation", async () => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply()
  f.receive(f.status(0, { generation: 2, ready: false, error: "document-retired" }))
  expect(f.scope.current()).toBe(false)
  f.receive(f.status(0, { generation: 1 }))
  expect(f.scope.current()).toBe(false)
  f.receive(f.status(0, { generation: 3 }))
  expect(f.scope.current()).toBe(true)
  expect(f.document.bindFieldInput).toHaveBeenCalledTimes(1)
})

it("holds native status delivered before its registration receipt without granting early authority", async () => {
  const f = setup()
  f.metadata.commit(mount())
  f.receive(f.status(0, { generation: 3 }))
  f.receive(f.status(0, { generation: 9, ownerToken: "foreign" }))
  expect(f.scope.current()).toBe(false)
  await f.reply(0, { generation: 1, ready: false, error: "document-retired" })
  expect(f.scope.current()).toBe(true)
  f.receive(f.status(0, { generation: 2, ready: false, error: "old" }))
  expect(f.scope.current()).toBe(true)
})

it.each([
  { requestId: "foreign" },
  { ownerToken: "foreign" },
  { metadataTarget: 999 },
  { ownerId: "foreign" },
  { moduleLease: "foreign" },
  { bindingId: "foreign" },
  { bindingRevision: "foreign" },
  { generation: 1.5 },
  { generation: -1 },
  { ready: "true" },
  { error: 1 },
  { added: true },
  { ready: true, error: "cannot-be-ready-with-error" },
])("refuses foreign or malformed readiness status %j", async (change) => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply(0, { ready: false, error: "awaiting-current-read" })
  f.receive(f.status(0, { generation: 2, ...change }))
  expect(f.scope.current()).toBe(false)
})

it("cannot revive a withdrawn or retired registration from a late positive status", async () => {
  const f = setup()
  f.metadata.commit(mount())
  await f.reply()
  f.metadata.commit(mount({ active: false, sequence: 2, epoch: 3 }))
  f.receive(f.status(0, { generation: 9 }))
  expect(f.scope.current()).toBe(false)
  f.session.retire()
  f.receive(f.status(0, { generation: 10 }))
  expect(f.scope.current()).toBe(false)
})

it("releases a recognized registration if its readiness receipt is malformed", async () => {
  const f = setup()
  f.metadata.commit(mount())
  f.pending[0].resolve(
    JSON.stringify({
      requestId: f.pending[0].request.requestId,
      ownerToken: "owner:0",
      metadataTarget: 15,
      status: f.status(0, { moduleLease: "foreign" }),
    }),
  )
  await tick()
  expect(f.scope.current()).toBe(false)
  expect(f.document.unbindFieldInput).toHaveBeenCalledWith(
    JSON.stringify({ metadataTarget: 15, ownerToken: "owner:0" }),
  )
})
