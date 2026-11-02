import type { View } from "react-native"

import { createNativeOrdinaryEditorKeys } from "../ordinaryEditorKeys"

const original = { _nativeTag: 17 } as unknown as View
const setup = () => {
  const registry = createNativeOrdinaryEditorKeys("scope", () => ({ windowId: "window", epoch: 1, active: true }))
  const options = { original, current: () => original, canAct: () => true }
  const acknowledge = () => {
    const binding = registry.bindings()[0]
    registry.acceptStatus({
      ...binding,
      ownerId: "scope",
      target: 17,
      windowId: "window",
      epoch: 1,
      sequence: 1,
      ready: true,
      windowActive: true,
      error: "",
    })
    return binding
  }
  return { registry, options, acknowledge }
}

it("marks toolbar-only target and subtree purposes without changing registration lease shape", () => {
  const f = setup()
  const lease = f.registry.register("toolbar", { ...f.options, subtree: true, toolbar: true, receive: jest.fn() })
  expect(Object.keys(lease).sort()).toEqual(["receive", "unregister"])
  expect(f.registry.bindings()[0]).toMatchObject({ subtree: true, toolbarTargetOnly: true, toolbarSubtreeOnly: true })
  lease.unregister()
  expect(f.registry.bindings()).toEqual([])
  f.registry.dispose()
})
it("preserves a legacy exact target while restricting only the newly added toolbar fallback", () => {
  const f = setup(),
    receive = jest.fn()
  const exact = f.registry.register("exact", { ...f.options, receive })
  const binding = f.acknowledge()
  const before = f.registry.snapshot()
  const toolbar = f.registry.register("toolbar", { ...f.options, subtree: true, toolbar: true, receive: jest.fn() })
  expect(f.registry.snapshot()).toBeGreaterThan(before)
  expect(f.registry.bindings()[0]).toMatchObject({
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    subtree: true,
    toolbarTargetOnly: false,
    toolbarSubtreeOnly: true,
  })
  const event = {
    target: original,
    currentTarget: original,
    persist: jest.fn(),
    nativeEvent: {
      ...binding,
      kind: "keyboard",
      ownerId: "scope",
      target: 17,
      windowId: "window",
      epoch: 1,
      eventId: 1,
      phase: "down",
      cancelled: false,
    },
  } as unknown as Parameters<typeof exact.receive>[0]
  expect(exact.receive(event)).toBe(true)
  expect(receive.mock.calls[0][0]).toBe(event)
  toolbar.unregister()
  expect(f.registry.bindings()[0]).toMatchObject({
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    subtree: false,
    toolbarTargetOnly: false,
    toolbarSubtreeOnly: false,
  })
  expect(Object.keys(exact).sort()).toEqual(["receive", "unregister"])
  f.registry.dispose()
})
it("retains legacy logical subtree fallback and only restricts it after the legacy observer retires", () => {
  const f = setup(),
    receive = jest.fn()
  const legacy = f.registry.register("legacy", { ...f.options, subtree: true, receive })
  const binding = f.acknowledge()
  f.registry.register("toolbar", { ...f.options, subtree: true, toolbar: true, receive: jest.fn() })
  expect(f.registry.bindings()[0]).toMatchObject({ subtree: true, toolbarTargetOnly: false, toolbarSubtreeOnly: false })
  const editor = { _nativeTag: 43 } as unknown as View
  const event = {
    target: editor,
    currentTarget: original,
    persist: jest.fn(),
    nativeEvent: {
      ...binding,
      kind: "keyboard",
      ownerId: "scope",
      target: 43,
      observerBindings: JSON.stringify([binding]),
      windowId: "window",
      epoch: 1,
      eventId: 1,
      phase: "down",
      cancelled: false,
    },
  } as unknown as Parameters<typeof legacy.receive>[0]
  expect(legacy.receive(event)).toBe(true)
  expect(receive.mock.calls[0][0]).toBe(event)
  legacy.unregister()
  expect(f.registry.bindings()[0]).toMatchObject({
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    subtree: true,
    toolbarTargetOnly: true,
    toolbarSubtreeOnly: true,
  })
  expect(legacy.receive(event)).toBe(false)
  f.registry.dispose()
})
