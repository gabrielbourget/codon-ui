import { NativeCollectionActions, type TNativeCollectionActionAdmission } from "../actions"
import { NativeCollectionModel, nativeCollectionOwnerBinding } from "../model"
import {
  createNativeCollectionSnapshot,
  copyNativeCollectionNodeIdentity,
  type TNativeCollectionItem,
} from "../snapshot"

const item = (key: string): TNativeCollectionItem<object> => ({
  key,
  type: "item",
  value: {},
  props: {},
  rendered: key,
  textValue: key,
})
const setup = (items = [item("a")]) => {
  let receive: (accepted: boolean) => void = () => {}
  let bindingRevision = "current"
  const cancel = jest.fn()
  const admission: TNativeCollectionActionAdmission = {
    registerOwner: () => () => {},
    ownerLifetimeFor: () => "source-model-window",
    bindingFor: (scope) => JSON.stringify([scope, bindingRevision]),
    request: jest.fn((_scope, _binding, _target, callback) => {
      receive = callback
      return cancel
    }),
    subscribe: () => () => {},
    getSnapshot: () => 0,
  }
  const model = new NativeCollectionModel<object>("owner")
  const snapshot = model.prepare(createNativeCollectionSnapshot(items))
  const retire = model.commit(snapshot)
  const actions = new NativeCollectionActions(model, admission, snapshot)
  actions.connect()
  return {
    model,
    snapshot,
    actions,
    admission,
    cancel,
    retire,
    receive: (accepted = true) => receive(accepted),
    changeBinding: () => {
      bindingRevision = "replacement"
    },
  }
}

it("admits once only after the visible-host adapter acknowledges the exact original target", () => {
  const state = setup(),
    action = jest.fn(),
    settled = jest.fn()
  const node = state.snapshot.collection.getItem("a")!
  expect(state.actions.request(node, 42, action, settled)).toBe(true)
  expect(state.admission.request).toHaveBeenCalledWith(
    expect.objectContaining({
      ownerId: "owner",
      generation: state.model.generation,
      revision: state.snapshot.revision,
    }),
    state.actions.bindingFor(node),
    42,
    expect.any(Function),
  )
  expect(action).not.toHaveBeenCalled()
  state.receive()
  state.receive()
  expect(action).toHaveBeenCalledTimes(1)
  expect(settled.mock.calls).toEqual([["accepted"]])
})

it.each(["retire", "revision", "binding", "native-rejection"])("rejects a late callback after %s", (kind) => {
  const state = setup(),
    action = jest.fn(),
    settled = jest.fn()
  state.actions.request(state.snapshot.collection.getItem("a")!, 42, action, settled)
  if (kind === "retire") state.retire()
  if (kind === "revision") state.model.commit(state.model.prepare(createNativeCollectionSnapshot([item("a")])))
  if (kind === "binding") state.changeBinding()
  state.receive(kind !== "native-rejection")
  state.receive()
  expect(action).not.toHaveBeenCalled()
  expect(settled.mock.calls).toEqual([["rejected"]])
  if (kind === "retire" || kind === "revision") expect(state.cancel).toHaveBeenCalledTimes(1)
})

it("retains admission for filtered/state clones but rejects foreign and replaced logical nodes", () => {
  const state = setup(),
    original = state.snapshot.collection.getItem("a")!
  const filtered = state.snapshot.collection.filter(() => true).getItem("a")!
  const cloned = copyNativeCollectionNodeIdentity(original, { ...original })
  expect(state.actions.bindingFor(filtered)).toBe(state.actions.bindingFor(original))
  expect(state.actions.bindingFor(cloned)).toBe(state.actions.bindingFor(original))
  const foreign = createNativeCollectionSnapshot([item("a")]).getItem("a")!
  expect(state.actions.bindingFor(foreign)).toBe("")
  const changed = createNativeCollectionSnapshot([item("a")], state.snapshot.collection).getItem("a")!
  expect(state.actions.bindingFor(changed)).toBe("")
})

it("fails closed without an adapter, before commit, and for non-materialized target handles", () => {
  const state = setup(),
    node = state.snapshot.collection.getItem("a")!,
    action = jest.fn()
  const missing = new NativeCollectionActions(state.model, null, state.snapshot)
  expect(missing.request(node, 42, action)).toBe(false)
  for (const target of [0, -1, NaN, 1.5, 2147483648]) expect(state.actions.request(node, target, action)).toBe(false)
  state.retire()
  expect(state.actions.request(node, 42, action)).toBe(false)
  expect(state.admission.request).not.toHaveBeenCalled()
  expect(action).not.toHaveBeenCalled()
})

it("supports empty-root actions and excludes business payloads from the explicit owner binding", () => {
  const state = setup([]),
    action = jest.fn()
  expect(JSON.parse(nativeCollectionOwnerBinding(state.snapshot))).toEqual({
    ownerId: "owner",
    generation: state.model.generation,
    revision: state.snapshot.revision,
    items: [],
  })
  expect(state.actions.request(null, 42, action)).toBe(true)
  state.receive()
  expect(action).toHaveBeenCalledTimes(1)
  const populated = setup([{ ...item("private business key"), value: { secret: "private value" } }])
  const wire = nativeCollectionOwnerBinding(populated.snapshot)
  expect(wire).not.toContain("private")
  expect(wire).not.toContain("metadataTarget")
})

it("consumes reentrant actions once and surfaces caller failures after settling them", () => {
  const state = setup(),
    settled = jest.fn()
  state.actions.request(
    null,
    42,
    () => {
      state.retire()
      throw new Error("caller failed")
    },
    settled,
  )
  expect(() => state.receive()).toThrow("caller failed")
  state.receive()
  expect(settled.mock.calls).toEqual([["failed"]])
})

it("does not publish or admit a candidate model until commit and ignores stale cleanup", () => {
  const state = setup(),
    action = jest.fn()
  const candidate = state.model.prepare(createNativeCollectionSnapshot([item("next")]))
  const actions = new NativeCollectionActions(state.model, state.admission, candidate)
  expect(actions.request(null, 42, action)).toBe(false)
  expect(state.model.getSnapshot()).toBe(state.snapshot)
  state.model.commit(candidate)
  state.retire()
  expect(state.model.getSnapshot()).toBe(candidate)
  expect(actions.request(null, 42, action)).toBe(true)
  state.receive()
  expect(action).toHaveBeenCalledTimes(1)
})
