import { createNativeDialogFocusRegistry, type TNativeDialogDescription } from "../dialogFocusRegistry"
import { createNativeKeyScope } from "../keyScope"

const setup = () => {
  const scope = createNativeKeyScope("scope")
  const ready = (epoch = 1) => {
    const data = { ownerId: "scope", windowId: "window", epoch, windowActive: true }
    scope.acceptNativeStatus({ ...data, ready: false, policyRevision: scope.policyRevision() })
    scope.acceptNativeStatus({ ...data, ready: true, policyRevision: scope.policyRevision() })
  }
  ready()
  return { scope, ready, registry: createNativeDialogFocusRegistry(scope) }
}
const description = (tag: number, extra: Partial<TNativeDialogDescription> = {}): TNativeDialogDescription => {
  const node = {}
  return {
    parentId: "",
    target: () => ({ node, tag }),
    entryOwner: () => 10,
    entryAllowed: true,
    canAct: () => true,
    ...extra,
  }
}

it("leaves an unopted-in native scope unchanged and publishes the original root only after attachment", () => {
  const f = setup()
  f.registry.flush()
  expect(f.registry.revision()).toBe(0)
  let node: object | null = null
  f.registry.register("dialog", description(20, { target: () => ({ node, tag: node ? 20 : 0 }) }))
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([])
  node = {}
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([
    expect.objectContaining({ id: "dialog", targetTag: 20, enabled: true, entryAllowed: true }),
  ])
  expect(f.registry.hasEntryFor(10)).toBe(true)
})

it("retires old native actions on root replacement even if the native tag is reused", () => {
  const f = setup()
  let node = {}
  f.registry.register("dialog", description(20, { target: () => ({ node, tag: 20 }) }))
  f.registry.flush()
  const original = f.registry.bindings()[0],
    revision = f.registry.revision()
  const action = {
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    revision,
    id: "dialog",
    bindingId: original.bindingId,
    phase: "entered" as const,
    target: 20,
  }
  expect(f.registry.acceptAction(action)).toBe(true)
  node = {}
  expect(f.registry.acceptAction(action)).toBe(false)
  expect(f.registry.bindings()[0].bindingId).not.toBe(original.bindingId)
  expect(f.registry.lastAction()).toBeNull()
})

it("retains original portal member identity separately from a stable Dialog lease", () => {
  const f = setup()
  f.registry.register("dialog", description(20))
  let node = {}
  const remove = f.registry.registerMember(
    "portal",
    "dialog",
    () => ({ node, tag: 30 }),
    () => true,
  )
  f.registry.flush()
  const before = f.registry.bindings()[0]
  node = {}
  f.registry.flush()
  const after = f.registry.bindings()[0]
  expect(after.bindingId).toBe(before.bindingId)
  expect(after.memberTargets[0].targetTag).toBe(30)
  expect(after.memberTargets[0].id).not.toBe(before.memberTargets[0].id)
  remove()
  f.registry.flush()
  expect(f.registry.bindings()[0].memberTargets).toEqual([])
})

it("keeps explicit parent entry authoritative and does not borrow an absent parent", () => {
  const f = setup()
  f.registry.register("child", description(30, { parentId: "parent", entryAllowed: false }))
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([])
  const remove = f.registry.register("parent", description(20))
  f.registry.flush()
  expect(f.registry.bindings().find(({ id }) => id === "child")).toMatchObject({
    parentId: "parent",
    entryAllowed: false,
  })
  remove.unregister()
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([])
})

it("rejects foreign/stale failure reports and notifies a current failure without changing native binding revision", () => {
  const f = setup()
  f.registry.register("dialog", description(20))
  f.registry.flush()
  const revision = f.registry.revision(),
    snapshot = f.registry.snapshot()
  const status = {
    ownerId: "scope",
    windowId: "window",
    epoch: 1,
    revision,
    ready: false,
    error: "original-root-not-focusable",
  }
  expect(f.registry.acceptStatus({ ...status, windowId: "foreign" })).toBe(false)
  expect(f.registry.error()).toBe("")
  expect(f.registry.acceptStatus(status)).toBe(false)
  expect(f.registry.error()).toBe(status.error)
  expect(f.registry.revision()).toBe(revision)
  expect(f.registry.snapshot()).toBeGreaterThan(snapshot)
})

it("retires window epochs and obsolete registration cleanups without removing a replacement owner", () => {
  const f = setup(),
    old = f.registry.register("dialog", description(20))
  f.registry.flush()
  const binding = f.registry.bindings()[0].bindingId
  f.ready(2)
  f.registry.flush()
  expect(f.registry.bindings()[0].bindingId).not.toBe(binding)
  f.registry.register("dialog", description(21))
  old.unregister()
  f.registry.flush()
  expect(f.registry.bindings()[0].targetTag).toBe(21)
  f.registry.dispose()
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([])
})

it("keeps the enclosing owner boundary and its sticky request after a requesting Dialog unmounts", () => {
  const f = setup(),
    body = {}
  f.registry.registerOwner("panel", {
    parentId: "",
    target: () => ({ node: body, tag: 10 }),
    reserved: () => false,
    canAct: () => true,
  })
  const dialog = f.registry.register("dialog", description(20, { ownerId: "panel" }))
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([
    expect.objectContaining({
      id: "panel",
      targetTag: 10,
      entryAllowed: false,
      entryTargets: [expect.objectContaining({ targetTag: 20, allowed: true })],
    }),
  ])
  expect(f.registry.hasEntryFor(10)).toBe(true)
  dialog.unregister()
  f.registry.flush()
  expect(f.registry.bindings()).toEqual([expect.objectContaining({ id: "panel", targetTag: 10, entryTargets: [] })])
})

it("reserves initial explicit parent entry without removing the enclosing native containment boundary", () => {
  const f = setup(),
    body = {}
  let reserved = true
  f.registry.registerOwner("panel", {
    parentId: "",
    target: () => ({ node: body, tag: 10 }),
    reserved: () => reserved,
    canAct: () => true,
  })
  f.registry.register("dialog", description(20, { ownerId: "panel" }))
  f.registry.flush()
  const lease = f.registry.bindings()[0].bindingId
  expect(f.registry.bindings()[0].entryTargets[0].allowed).toBe(false)
  reserved = false
  f.registry.flush()
  expect(f.registry.bindings()[0].bindingId).toBe(lease)
  expect(f.registry.bindings()[0].entryTargets[0].allowed).toBe(false)
  f.registry.register("later-dialog", description(21, { ownerId: "panel" }))
  f.registry.flush()
  expect(f.registry.bindings()[0].entryTargets[1].allowed).toBe(true)
})
