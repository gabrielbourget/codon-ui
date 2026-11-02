import { act, render } from "@testing-library/react-native"
import { useCallback, useState } from "react"
import { TextInput, View, type View as TView } from "react-native"

import {
  createNativeOriginalEditorWheelPolicies,
  NativeOriginalEditorWheelContext,
  useNativeOriginalEditorWheelPolicy,
  type TNativeEditorWheelData,
  type TNativeEditorWheelStatus,
} from "../originalEditorWheel"

beforeEach(() => {
  const tags = new WeakMap<object, number>()
  let serial = 100
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((node: unknown) => {
    if (!node || typeof node !== "object") return null
    if ("_nativeTag" in node) return node._nativeTag
    if (!tags.has(node)) tags.set(node, ++serial)
    return tags.get(node)
  })
})
afterEach(() => jest.restoreAllMocks())

const setup = () => {
  const original = { _nativeTag: 17 } as unknown as TextInput
  const group = { _nativeTag: 18 } as unknown as TView
  const session = { windowId: "window", epoch: 1, active: true }
  let current: TextInput | null = original,
    currentGroup: TView | null = group,
    allowed = true
  const onAction = jest.fn()
  const registry = createNativeOriginalEditorWheelPolicies("wheel-owner", () => session)
  const lease = registry.register("owned", original, group, {
    current: () => current,
    currentGroup: () => currentGroup,
    canAct: () => allowed,
    onAction,
  })
  const binding = registry.bindings()[0]
  const status = (sequence = 1): TNativeEditorWheelStatus => ({
    ownerId: registry.ownerId,
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    target: binding.targetTag,
    groupTarget: binding.groupTarget,
    windowId: session.windowId,
    epoch: session.epoch,
    sequence: sequence * 2 - 1,
    ready: true,
    windowActive: true,
    sourceKind: "android-generic-motion",
    error: "",
  })
  const frame = (sequence = 1, changes: Partial<TNativeEditorWheelData> = {}): TNativeEditorWheelData => ({
    ownerId: registry.ownerId,
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    target: binding.targetTag,
    groupTarget: binding.groupTarget,
    focusedTarget: 19,
    windowId: session.windowId,
    epoch: session.epoch,
    sequence: sequence * 2,
    timestamp: sequence,
    deltaX: 0,
    deltaY: 1,
    rawAxisX: 0,
    rawAxisY: -1,
    sourceKind: "mouse",
    nativeDefaultHandled: true,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...changes,
  })
  return {
    original,
    group,
    session,
    registry,
    lease,
    binding,
    status,
    frame,
    onAction,
    replace: (next: TextInput | null) => {
      current = next
    },
    replaceGroup: (next: TView | null) => {
      currentGroup = next
    },
    allow: (next: boolean) => {
      allowed = next
    },
  }
}

it("publishes independent original/group wheel metadata and requires an actual matching acknowledgment", () => {
  const f = setup(),
    frame = f.frame()
  expect(f.registry.ownerId).toBe("wheel-owner")
  expect(f.binding).toMatchObject({ targetTag: 17, groupTarget: 18 })
  expect(f.binding.bindingId).toContain(":wheel:")
  expect(f.registry.receive(frame)).toBe(false)
  expect(f.registry.receiveStatus(f.status(2))).toBe(true)
  // A packet refused before readiness is terminal; an acknowledgment cannot replay it.
  expect(f.registry.receive(frame)).toBe(false)
  const fresh = f.frame(2)
  expect(f.registry.receive(fresh)).toBe(true)
  expect(f.onAction.mock.calls[0]).toEqual([1, fresh])
  expect(f.onAction.mock.calls[0][1]).toBe(fresh)
  expect(f.registry.status(f.binding.bindingId).ready).toBe(true)
  expect(fresh).not.toHaveProperty("nativeEvent")
})

it.each([
  [0, 1, 1],
  [0, -1, -1],
  [1, 100000, 1],
  [1, -100000, -1],
] as const)(
  "requests one step for predominant vertical %s/%s with exact raw frame identity",
  (deltaX, deltaY, direction) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    const frame = f.frame(1, {
      deltaX,
      deltaY,
      rawAxisX: 3.5,
      rawAxisY: -123,
      altKey: true,
      metaKey: true,
      shiftKey: true,
    })
    expect(f.registry.receive(frame)).toBe(true)
    expect(f.onAction.mock.calls).toEqual([[direction, frame]])
    expect(f.onAction.mock.calls[0][1]).toBe(frame)
    expect(f.registry.receive(frame)).toBe(false)
  },
)
it.each([
  [1, 0],
  [10, 1],
  [1, 1],
  [0, 0],
] as const)("retains truthful native consumption without action for axes %s/%s", (deltaX, deltaY) => {
  const f = setup()
  f.registry.receiveStatus(f.status())
  expect(f.registry.receive(f.frame(1, { deltaX, deltaY }))).toBe(true)
  expect(f.onAction).not.toHaveBeenCalled()
})
it.each(["ownerId", "bindingId", "bindingRevision", "target", "groupTarget", "windowId", "epoch"] as const)(
  "refuses foreign %s",
  (key) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    const frame = f.frame()
    expect(f.registry.receive({ ...frame, [key]: typeof frame[key] === "number" ? 999 : "foreign" })).toBe(false)
    expect(f.registry.receive(frame)).toBe(true)
    expect(f.onAction).toHaveBeenCalledTimes(1)
  },
)
it.each(["deltaX", "deltaY", "rawAxisX", "rawAxisY", "timestamp"] as const)(
  "rejects nonfinite %s rather than projecting a wheel event",
  (key) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    for (const value of [NaN, Infinity, -Infinity, "1", null])
      expect(f.registry.receive({ ...f.frame(), [key]: value })).toBe(false)
    expect(f.onAction).not.toHaveBeenCalled()
  },
)
it.each(["target", "groupTarget", "focusedTarget", "sequence", "epoch"] as const)(
  "requires valid native tag/serial %s",
  (key) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    for (const value of [-1, 0.5, NaN, Infinity, "17"])
      expect(f.registry.receive({ ...f.frame(), [key]: value })).toBe(false)
    if (key !== "epoch") expect(f.registry.receive({ ...f.frame(), [key]: 0 })).toBe(false)
    if (key.includes("Target") || key === "target")
      expect(f.registry.receive({ ...f.frame(), [key]: 2147483648 })).toBe(false)
    expect(f.onAction).not.toHaveBeenCalled()
  },
)
it.each(["nativeDefaultHandled", "altKey", "ctrlKey", "metaKey", "shiftKey"] as const)(
  "requires a genuine boolean %s",
  (key) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    expect(f.registry.receive({ ...f.frame(), [key]: 1 })).toBe(false)
    expect(f.onAction).not.toHaveBeenCalled()
  },
)
it("does not replay Ctrl-wheel or a normal unconsumed frame after its flags change", () => {
  const f = setup()
  f.registry.receiveStatus(f.status())
  expect(f.registry.receive(f.frame(1, { ctrlKey: true }))).toBe(false)
  expect(f.registry.receive(f.frame(1))).toBe(false)
  expect(f.registry.receive(f.frame(2, { nativeDefaultHandled: false }))).toBe(false)
  expect(f.registry.receive(f.frame(2))).toBe(false)
  expect(f.onAction).not.toHaveBeenCalled()
})
it("keeps unsupported UIKit/touch status explicitly unavailable without a substitute action", () => {
  const f = setup()
  const status = {
    ...f.status(),
    sourceKind: "uikit-pre-default-unavailable",
    ready: false,
    error: "modifier-and-default-ownership-unavailable",
  }
  expect(f.registry.receiveStatus(status)).toBe(true)
  expect(f.registry.status(f.binding.bindingId)).toEqual({ ready: false, packet: status })
  expect(f.registry.receive(f.frame())).toBe(false)
  f.registry.receiveStatus({ ...f.status(2), sourceKind: "touch" })
  expect(f.registry.status(f.binding.bindingId).ready).toBe(false)
  expect(f.registry.receive(f.frame(2, { sourceKind: "touch" }))).toBe(false)
  expect(f.onAction).not.toHaveBeenCalled()
})
it("snapshots unavailable status so mutation cannot invent source readiness", () => {
  const f = setup(),
    status = { ...f.status(), ready: false, sourceKind: "unavailable" }
  f.registry.receiveStatus(status)
  Object.assign(status, { ready: true, sourceKind: "android-generic-motion" })
  expect(f.registry.status(f.binding.bindingId).ready).toBe(false)
  expect(f.registry.status(f.binding.bindingId).packet?.ready).toBe(false)
  expect(f.registry.receive(f.frame())).toBe(false)
  expect(f.onAction).not.toHaveBeenCalled()
})
it("rejects stale status serials and cannot restore a retired window epoch", () => {
  const f = setup()
  f.registry.receiveStatus(f.status())
  const old = f.frame()
  f.session.active = false
  f.registry.syncSession()
  f.session.active = true
  f.registry.syncSession()
  expect(f.registry.receiveStatus(f.status())).toBe(false)
  expect(f.registry.receive(old)).toBe(false)
  f.registry.receiveStatus(f.status(2))
  expect(f.registry.receive(f.frame(2))).toBe(true)
  f.session.epoch = 2
  f.registry.syncSession()
  expect(f.registry.status(f.binding.bindingId).ready).toBe(false)
  expect(f.registry.receive(old)).toBe(false)
  f.registry.receiveStatus(f.status())
  expect(f.registry.receive(f.frame())).toBe(true)
})
it.each(["editor", "group", "guard"] as const)(
  "retires a refused %s frame even after current inputs return",
  (kind) => {
    const f = setup()
    f.registry.receiveStatus(f.status())
    if (kind === "editor") f.replace({ _nativeTag: 17 } as unknown as TextInput)
    if (kind === "group") f.replaceGroup({ _nativeTag: 18 } as unknown as TView)
    if (kind === "guard") f.allow(false)
    const old = f.frame()
    expect(f.registry.receive(old)).toBe(false)
    f.replace(f.original)
    f.replaceGroup(f.group)
    f.allow(true)
    expect(f.registry.receive(old)).toBe(false)
    f.registry.receiveStatus(f.status(2))
    expect(f.registry.receive(f.frame(2))).toBe(true)
  },
)
it("disposes subscriptions and never lets a replacement registration adopt an old native tag frame", () => {
  const f = setup(),
    changed = jest.fn()
  const release = f.registry.subscribe(changed)
  f.registry.receiveStatus(f.status())
  const old = f.frame()
  f.lease.unregister()
  f.registry.register("owned", f.original, f.group, {
    current: () => f.original,
    currentGroup: () => f.group,
    canAct: () => true,
    onAction: f.onAction,
  })
  expect(f.registry.bindings()[0].bindingRevision).not.toBe(f.binding.bindingRevision)
  expect(f.registry.receive(old)).toBe(false)
  expect(changed).toHaveBeenCalled()
  release()
  changed.mockClear()
  f.registry.dispose()
  expect(f.registry.bindings()).toEqual([])
  expect(f.registry.receive(old)).toBe(false)
  expect(f.registry.receiveStatus(f.status())).toBe(false)
  expect(changed).not.toHaveBeenCalled()
})
it.each([0, -1, 2147483648, NaN, Infinity])("refuses registration without actual positive Int32 tag %s", (tag) => {
  const f = setup()
  expect(() =>
    f.registry.register("bad", { _nativeTag: tag } as unknown as TextInput, f.group, {
      current: () => f.original,
      currentGroup: () => f.group,
      canAct: () => true,
      onAction: f.onAction,
    }),
  ).toThrow("actual editor and group")
})

it("commits hook callbacks without changing wheel identity and retires on enable/lifetime/host/unmount changes", async () => {
  const session = { windowId: "window", epoch: 1, active: true }
  const registry = createNativeOriginalEditorWheelPolicies("hook-owner", () => session)
  const first = jest.fn(),
    current = jest.fn()
  let original: TextInput | null = null,
    group: TView | null = null
  const Harness = ({
    enabled = true,
    lifetime = "model",
    callback = first,
    host = "a",
  }: {
    enabled?: boolean
    lifetime?: string
    callback?: typeof first
    host?: string
  }) => {
    const [editor, setEditor] = useState<TextInput | null>(null),
      [container, setContainer] = useState<TView | null>(null)
    const bind = useCallback((value: TextInput | null) => {
      original = value
      setEditor(value)
    }, [])
    const bindGroup = useCallback((value: TView | null) => {
      group = value
      setContainer(value)
    }, [])
    useNativeOriginalEditorWheelPolicy(editor, {
      enabled,
      lifetimeKey: lifetime,
      group: container,
      current: () => original,
      currentGroup: () => group,
      canAct: () => true,
      onAction: callback,
    })
    return (
      <View ref={bindGroup}>
        <TextInput key={host} ref={bind} />
      </View>
    )
  }
  const content = (props = {}) => (
    <NativeOriginalEditorWheelContext.Provider value={registry}>
      <Harness {...props} />
    </NativeOriginalEditorWheelContext.Provider>
  )
  const view = await render(content())
  const binding = registry.bindings()[0]
  const status: TNativeEditorWheelStatus = {
    ownerId: registry.ownerId,
    bindingId: binding.bindingId,
    bindingRevision: binding.bindingRevision,
    target: binding.targetTag,
    groupTarget: binding.groupTarget,
    windowId: "window",
    epoch: 1,
    sequence: 1,
    ready: true,
    windowActive: true,
    sourceKind: "android-generic-motion",
    error: "",
  }
  const frame: TNativeEditorWheelData = {
    ...status,
    sequence: 2,
    sourceKind: "mouse",
    focusedTarget: binding.groupTarget + 1,
    timestamp: 1,
    deltaX: 0,
    deltaY: 1,
    rawAxisX: 0,
    rawAxisY: -1,
    nativeDefaultHandled: true,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
  }
  registry.receiveStatus(status)
  await view.rerender(content({ callback: current }))
  expect(registry.bindings()).toEqual([binding])
  await act(() => {
    registry.receive(frame)
  })
  expect(first).not.toHaveBeenCalled()
  expect(current.mock.calls[0]).toEqual([1, frame])
  await view.rerender(content({ enabled: false, callback: current }))
  expect(registry.bindings()).toEqual([])
  await view.rerender(content({ callback: current }))
  expect(registry.bindings()[0].bindingRevision).not.toBe(binding.bindingRevision)
  expect(registry.receive({ ...frame, sequence: 2 })).toBe(false)
  const before = registry.bindings()[0]
  await view.rerender(content({ callback: current, lifetime: "reset" }))
  expect(registry.bindings()[0].bindingRevision).not.toBe(before.bindingRevision)
  const replacement = registry.bindings()[0]
  await view.rerender(content({ callback: current, lifetime: "reset", host: "b" }))
  expect(registry.bindings()[0].bindingRevision).not.toBe(replacement.bindingRevision)
  await view.unmount()
  expect(registry.bindings()).toEqual([])
  expect(registry.receive({ ...frame, sequence: 3 })).toBe(false)
})

it("accepts a native reactivation acknowledgment before JS scope activation while fencing old queued updates", () => {
  const f = setup()
  f.registry.receiveStatus(f.status())
  const old = f.frame()
  f.session.active = false
  f.registry.syncSession()
  f.registry.receiveStatus({ ...f.status(2), ready: false, windowActive: false })
  // Native publishStatus emits wheel readiness before the scope status callback.
  f.registry.receiveStatus(f.status(3))
  expect(f.registry.status(f.binding.bindingId).ready).toBe(false)
  expect(f.registry.receive(f.frame(3))).toBe(false)
  f.session.active = true
  f.registry.syncSession()
  expect(f.registry.status(f.binding.bindingId).ready).toBe(true)
  expect(f.registry.receive(old)).toBe(false)
  expect(f.registry.receive(f.frame(4))).toBe(true)
  expect(f.onAction.mock.calls).toEqual([[1, f.frame(4)]])
})

it("never lets a replacement registry with the same owner and native tags adopt a disposed registry frame", () => {
  const f = setup()
  f.registry.receiveStatus(f.status())
  const old = f.frame()
  f.registry.dispose()
  const current = createNativeOriginalEditorWheelPolicies(f.registry.ownerId, () => f.session)
  current.register("owned", f.original, f.group, {
    current: () => f.original,
    currentGroup: () => f.group,
    canAct: () => true,
    onAction: f.onAction,
  })
  const binding = current.bindings()[0]
  expect(binding.bindingRevision).not.toBe(f.binding.bindingRevision)
  current.receiveStatus({ ...f.status(), bindingId: binding.bindingId, bindingRevision: binding.bindingRevision })
  expect(current.receive(old)).toBe(false)
  const fresh = { ...old, bindingId: binding.bindingId, bindingRevision: binding.bindingRevision }
  expect(current.receive(fresh)).toBe(true)
  expect(f.onAction.mock.calls).toEqual([[1, fresh]])
})
