import { act, fireEvent, render } from "@testing-library/react-native"
import { createRef, useContext, useInsertionEffect } from "react"
import type { TextInput } from "react-native"

import { Stepper, type StepperProps } from "../../.."
import { NativeFormRegistryContext } from "../../../form/context"
import { NativeFormRegistry } from "../../../form/registry"
import {
  createNativeOriginalEditorWheelPolicies,
  NativeOriginalEditorWheelContext,
  type TNativeEditorWheelData,
  type TNativeEditorWheelStatus,
} from "../../../input/originalEditorWheel"
import { NativeFloatingWindowContext } from "../../../overlays/floating/scope"

jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestKeyboardBlur: jest.fn(), inspectAccessibility: jest.fn() },
}))
const names = { accessibilityLabel: "Quantity", incrementLabel: "Add quantity", decrementLabel: "Reduce quantity" }
beforeEach(() => {
  jest.useFakeTimers()
  const tags = new WeakMap<object, number>()
  let sequence = 100
  jest.spyOn(jest.requireActual("react-native"), "findNodeHandle").mockImplementation((value: unknown) => {
    if (!value || typeof value !== "object") return null
    if (!tags.has(value)) tags.set(value, ++sequence)
    return tags.get(value)!
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})
const setup = async (initial: Partial<StepperProps> = {}) => {
  const session = { windowId: "wheel-window", epoch: 1, active: true }
  const fallback = createNativeOriginalEditorWheelPolicies("fixture-wheel", () => session)
  const form = new NativeFormRegistry(),
    editor = createRef<TextInput>()
  let floatingAllowed = true
  let registry = fallback,
    nativeSequence = 0,
    props = initial
  // Before the disjoint scope/provider patch is integrated, the explicit context
  // exercises this registry/consumer only. A real inner provider takes precedence.
  const Probe = () => {
    const current = useContext(NativeOriginalEditorWheelContext)
    useInsertionEffect(() => {
      if (current) registry = current
    })
    return null
  }
  const content = () => (
    <NativeFloatingWindowContext.Provider value={() => floatingAllowed}>
      <NativeOriginalEditorWheelContext.Provider value={fallback}>
        <NativeFormRegistryContext.Provider value={form}>
          <Stepper {...names} ref={editor} PlusIcon={<Probe />} {...props} />
        </NativeFormRegistryContext.Provider>
      </NativeOriginalEditorWheelContext.Provider>
    </NativeFloatingWindowContext.Provider>
  )
  const view = await render(content())
  const root = () => view.getByTestId("stepper")
  const acknowledgeScope = async (epoch = session.epoch, active = true) => {
    session.epoch = epoch
    session.active = active
    for (const ready of [false, active]) {
      const scope = root().props
      await act(() =>
        scope.onNativeScopeStatus({
          nativeEvent: {
            ownerId: scope.ownerId,
            windowId: session.windowId,
            epoch,
            policyRevision: scope.policyRevision,
            ready,
            windowActive: active,
          },
        }),
      )
    }
    registry.syncSession()
  }
  const binding = () => registry.bindings()[0]
  const acknowledge = async (changes: Partial<TNativeEditorWheelStatus> = {}) => {
    const entry = binding()
    const packet: TNativeEditorWheelStatus = {
      ownerId: registry.ownerId,
      bindingId: entry.bindingId,
      bindingRevision: entry.bindingRevision,
      target: entry.targetTag,
      groupTarget: entry.groupTarget,
      windowId: session.windowId,
      epoch: session.epoch,
      sequence: ++nativeSequence,
      ready: true,
      windowActive: session.active,
      sourceKind: "android-generic-motion",
      error: "",
      ...changes,
    }
    await act(() => {
      registry.receiveStatus(packet)
    })
    return packet
  }
  const frame = (changes: Partial<TNativeEditorWheelData> = {}): TNativeEditorWheelData => {
    const entry = binding()
    return {
      ownerId: registry.ownerId,
      bindingId: entry.bindingId,
      bindingRevision: entry.bindingRevision,
      target: entry.targetTag,
      groupTarget: entry.groupTarget,
      focusedTarget: entry.groupTarget + 1000,
      windowId: session.windowId,
      epoch: session.epoch,
      sequence: ++nativeSequence,
      timestamp: nativeSequence,
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
    }
  }
  const send = async (packet: TNativeEditorWheelData) => {
    let accepted = false
    await act(() => {
      accepted = registry.receive(packet)
    })
    return accepted
  }
  return {
    view,
    editor,
    form,
    root,
    binding,
    frame,
    send,
    acknowledge,
    acknowledgeScope,
    registry: () => registry,
    setFloatingActive: async (next: boolean) => {
      floatingAllowed = next
      await view.rerender(content())
    },
    update: async (next: Partial<StepperProps>) => {
      props = next
      await view.rerender(content())
    },
  }
}

it("ST-WHEEL-01 enrolls the actual editor and noncollapsible owned group without a public wheel/stock event projection", async () => {
  const f = await setup({ defaultValue: 2 })
  expect(f.binding().targetTag).toBe(jest.requireActual("react-native").findNodeHandle(f.editor.current))
  expect(f.binding().groupTarget).toBeGreaterThan(0)
  expect(f.view.getByTestId("stepper-group").props.collapsable).toBe(false)
  expect(f.root().props.isWheelDisabled).toBeUndefined()
  expect(f.view.getByTestId("stepper-input").props.onWheel).toBeUndefined()
  expect(f.view.getByTestId("stepper-input").props.onScroll).toBeUndefined()
})
it.each([
  [1, 2.5],
  [-1, 1.5],
  [100000, 2.5],
  [-100000, 1.5],
] as const)(
  "ST-WHEEL-02 positive increments/negative decrements exactly once for deltaY=%s",
  async (deltaY, expected) => {
    const change = jest.fn()
    const f = await setup({ value: 2, step: 0.5, onChange: change })
    await f.acknowledgeScope()
    await f.acknowledge()
    const original = f.editor.current,
      packet = f.frame({ deltaY, deltaX: 0.1, sourceKind: "trackpad" })
    expect(await f.send(packet)).toBe(true)
    expect(await f.send(packet)).toBe(false)
    expect(change.mock.calls).toEqual([[expected]])
    expect(f.view.getByTestId("stepper-input")).toHaveDisplayValue("2")
    expect(f.editor.current).toBe(original)
  },
)
it("ST-WHEEL-03 leaves native horizontal/zero and at-bound consumption truthful without a numeric request", async () => {
  const change = jest.fn(),
    f = await setup({ defaultValue: 2, maxValue: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  expect(await f.send(f.frame({ deltaX: 2, deltaY: 1 }))).toBe(true)
  expect(await f.send(f.frame({ deltaX: 0, deltaY: 0 }))).toBe(true)
  expect(await f.send(f.frame())).toBe(true)
  expect(change).not.toHaveBeenCalled()
  expect(f.view.getByTestId("stepper-input")).toHaveDisplayValue("2")
})
it.each(["isWheelDisabled", "isDisabled", "isReadOnly"] as const)(
  "ST-WHEEL-04 %s unregisters wheel work; restoration cannot adopt the saved frame",
  async (flag) => {
    const change = jest.fn(),
      f = await setup({ value: 2, onChange: change })
    await f.acknowledgeScope()
    await f.acknowledge()
    const old = f.frame(),
      revision = f.binding().bindingRevision
    await f.update({ value: 2, onChange: change, [flag]: true })
    expect(f.registry().bindings()).toEqual([])
    expect(await f.send(old)).toBe(false)
    await f.update({ value: 2, onChange: change })
    await f.acknowledgeScope()
    await f.acknowledge()
    expect(f.binding().bindingRevision).not.toBe(revision)
    expect(await f.send(old)).toBe(false)
    expect(await f.send(f.frame())).toBe(true)
    expect(change.mock.calls).toEqual([[3]])
  },
)
it("ST-WHEEL-05 wheel toggling/callback updates preserve original editor and ordinary keyboard binding identities", async () => {
  const first = jest.fn(),
    latest = jest.fn(),
    f = await setup({ value: 2, onChange: first })
  await f.acknowledgeScope()
  await f.acknowledge()
  const original = f.editor.current,
    wheel = f.binding(),
    keys = f.root().props.policies,
    ordinary = f.root().props.ordinaryEditorBindings
  await f.update({ value: 3, onChange: latest })
  expect(f.binding()).toEqual(wheel)
  expect(f.root().props.policies).toEqual(keys)
  expect(f.root().props.ordinaryEditorBindings).toEqual(ordinary)
  expect(await f.send(f.frame())).toBe(true)
  expect(first).not.toHaveBeenCalled()
  expect(latest.mock.calls).toEqual([[4]])
  await f.update({ value: 3, onChange: latest, isWheelDisabled: true })
  expect(f.root().props.policies).toEqual(keys)
  expect(f.root().props.ordinaryEditorBindings).toEqual(ordinary)
  expect(f.editor.current).toBe(original)
})
it("ST-WHEEL-06 accepts native-attested button/group focus without requiring editor-only focus", async () => {
  const change = jest.fn(),
    f = await setup({ value: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  jest.spyOn(f.editor.current!, "isFocused").mockReturnValue(false)
  const packet = f.frame()
  expect(packet.focusedTarget).not.toBe(f.binding().targetTag)
  expect(await f.send(packet)).toBe(true)
  expect(change.mock.calls).toEqual([[3]])
})
it("ST-WHEEL-07 Ctrl, touch/unknown sources and unconsumed frames never request a number", async () => {
  const change = jest.fn(),
    f = await setup({ value: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  for (const changes of [
    { ctrlKey: true },
    { sourceKind: "touch" },
    { sourceKind: "unavailable" },
    { nativeDefaultHandled: false },
  ])
    expect(await f.send(f.frame(changes))).toBe(false)
  expect(change).not.toHaveBeenCalled()
})
it("ST-WHEEL-08 unsupported UIKit remains unavailable rather than using a weaker gesture substitute", async () => {
  const change = jest.fn(),
    f = await setup({ value: 2, onChange: change })
  await f.acknowledgeScope()
  const status = await f.acknowledge({
    ready: false,
    sourceKind: "unavailable",
    error: "uikit-original-editor-wheel-predefault-unproven",
  })
  expect(f.registry().status(f.binding().bindingId)).toEqual({ ready: false, packet: status })
  expect(await f.send(f.frame())).toBe(false)
  expect(change).not.toHaveBeenCalled()
})
it("ST-WHEEL-09 same-value Form reset retires old wheel admission and fresh source updates remain usable", async () => {
  const change = jest.fn(),
    f = await setup({ defaultValue: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  const old = f.frame(),
    binding = f.binding(),
    original = f.editor.current
  await act(() => [...f.form.fields.values()][0].reset("native"))
  await f.acknowledgeScope()
  await f.acknowledge()
  expect(f.binding().bindingRevision).not.toBe(binding.bindingRevision)
  expect(await f.send(old)).toBe(false)
  expect(change).not.toHaveBeenCalled()
  expect(await f.send(f.frame())).toBe(true)
  expect(change.mock.calls).toEqual([[3]])
  expect(f.editor.current).toBe(original)
})
it("ST-WHEEL-10 model/window/unmount retirement cannot deliver a saved consumed frame", async () => {
  const change = jest.fn(),
    f = await setup({ value: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  const old = f.frame()
  await f.update({ value: 2, step: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  expect(await f.send(old)).toBe(false)
  const windowFrame = f.frame()
  await f.acknowledgeScope(2, false)
  await f.acknowledgeScope(2, true)
  expect(await f.send(windowFrame)).toBe(false)
  await f.acknowledge()
  const terminal = f.frame(),
    registry = f.registry()
  await f.view.unmount()
  expect(registry.receive(terminal)).toBe(false)
  expect(change).not.toHaveBeenCalled()
})
it("ST-WHEEL-11 wheel stepping uses current raw numeric draft and keeps ordinary native edit observers intact", async () => {
  const change = jest.fn(),
    raw = jest.fn(),
    f = await setup({ defaultValue: 2, step: 0.5, onChange: change, onChangeText: raw })
  await f.acknowledgeScope()
  await f.acknowledge()
  await fireEvent.changeText(f.view.getByTestId("stepper-input"), "7.25")
  expect(await f.send(f.frame())).toBe(true)
  expect(raw.mock.calls).toEqual([["7.25"]])
  expect(change.mock.calls).toEqual([[7.5]])
  expect(f.view.getByTestId("stepper-input")).toHaveDisplayValue("7.5")
})

it("ST-WHEEL-12 a committed floating-window guard removes native admission and cannot resurrect its old frame", async () => {
  const change = jest.fn(),
    f = await setup({ value: 2, onChange: change })
  await f.acknowledgeScope()
  await f.acknowledge()
  const old = f.frame(),
    binding = f.binding()
  await f.setFloatingActive(false)
  expect(f.registry().bindings()).toEqual([])
  expect(await f.send(old)).toBe(false)
  await f.setFloatingActive(true)
  await f.acknowledge()
  expect(f.binding().bindingRevision).not.toBe(binding.bindingRevision)
  expect(await f.send(old)).toBe(false)
  expect(await f.send(f.frame())).toBe(true)
  expect(change.mock.calls).toEqual([[3]])
})
