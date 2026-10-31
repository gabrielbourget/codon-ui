import { act, render, screen } from "@testing-library/react-native"
import { useLayoutEffect, useSyncExternalStore } from "react"

import { NativeFloatingLayerHost, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import { useNativeKeyboardObservation, useNativeKeyScope, useNativeMenuPointerPolicy } from "../NativeKeyboardScope"
import type { TNativeMenuPointerEvent } from "../nativeMenuPointers"

type THost = ReturnType<typeof useNativeFloatingHost>
const PointerProbe = ({
  enabled,
  observe,
  retire,
}: {
  enabled: boolean
  observe: (event: TNativeMenuPointerEvent) => void
  retire: () => void
}) => {
  const scope = useNativeKeyScope()!
  useSyncExternalStore(scope.subscribe, scope.snapshot, scope.snapshot)
  const binding = (target: number, descriptorId = "") =>
    JSON.stringify({
      ownerId: `owner-${target}`,
      rootId: `root-${target}`,
      rootRevision: "original-root",
      target,
      surfaceId: 1,
      windowId: scope.acknowledgedSession().windowId,
      epoch: 1,
      sequence: 1,
      descriptorId,
      descriptorRevision: descriptorId ? "original-descriptor" : "",
      metadataTarget: descriptorId ? 110 : target,
    })
  useNativeMenuPointerPolicy({
    enabled,
    current: () => true,
    observe,
    retire,
    parentTarget: 10,
    triggerTarget: 11,
    submenuTarget: 20,
    parentBinding: binding(100),
    triggerBinding: binding(100, "trigger"),
    submenuBinding: binding(200),
  })
  return null
}
type TLease = ReturnType<THost["layers"]["register"]>
const Probe = ({ observe }: { observe: (host: THost) => void }) => {
  const host = useNativeFloatingHost()
  useLayoutEffect(() => observe(host), [host, observe])
  return null
}
const root = () => screen.getByTestId("host")
const acknowledge = async (epoch = 1, windowId = "native-window") => {
  const report = (ready: boolean) => {
    const props = root().props
    return props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId,
        epoch,
        policyRevision: props.policyRevision,
        ready,
        windowActive: true,
      },
    })
  }
  await act(() => report(false))
  await act(() => report(true))
}
const packet = (extra: Record<string, unknown> = {}) => {
  const props = root().props
  return {
    nativeEvent: {
      kind: "keyboard",
      ownerId: props.ownerId,
      policyId: props.policies[0].id,
      target: 1,
      focusedTarget: -1,
      windowId: props.acceptedWindowId,
      epoch: props.acceptedEpoch,
      policyRevision: props.policyRevision,
      key: "Escape",
      nativeCode: 0,
      characters: "",
      phase: "down",
      repeat: false,
      cancelled: false,
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      capsLock: false,
      nativeModifierData: "0",
      nativeDefaultHandled: true,
      timestamp: 0,
      ...extra,
    },
  }
}
const setup = async (protectedLayer = false) => {
  let host: THost | undefined
  const dismiss = jest.fn()
  const result = await render(
    <NativeFloatingLayerHost testID="host">
      <Probe
        observe={(next) => {
          host = next
        }}
      />
    </NativeFloatingLayerHost>,
  )
  const options = {
    parent: null,
    isOpen: true,
    isModal: false,
    isKeyboardDismissDisabled: protectedLayer,
    onDismiss: dismiss,
  }
  let layer: TLease
  await act(() => {
    layer = host!.layers.register("layer", options)
  })
  await act(() => {
    layer!.entered(layer!.state().generation)
  })
  return { host: host!, layer: layer!, options, dismiss, result }
}

it("admits Escape only after native window/policy acknowledgment and keeps the owner authoritative", async () => {
  const f = await setup()
  const initial = packet()
  await act(() => root().props.onNativeScopedKey(initial))
  expect(f.dismiss).not.toHaveBeenCalled()
  await acknowledge()
  const current = packet()
  await act(() => root().props.onNativeScopedKey(current))
  expect(f.dismiss.mock.calls).toEqual([["keyboard"]])
  expect(f.layer.state().active).toBe(true)
  await act(() => root().props.onNativeScopedKey(packet({ repeat: true })))
  await act(() => root().props.onNativeScopedKey(packet({ phase: "up", cancelled: true })))
  expect(f.dismiss).toHaveBeenCalledTimes(1)
})

it("keeps protected and transitioning layers shielding the containing window", async () => {
  const f = await setup(true)
  await acknowledge()
  const protectedPacket = packet()
  await act(() => root().props.onNativeScopedKey(protectedPacket))
  expect(f.dismiss).not.toHaveBeenCalled()
  await act(() => f.layer.update({ ...f.options, isKeyboardDismissDisabled: false }))
  await acknowledge()
  await act(() => root().props.onNativeScopedKey(protectedPacket))
  expect(f.dismiss).not.toHaveBeenCalled()
  await act(() => root().props.onNativeScopedKey(packet()))
  expect(f.dismiss).toHaveBeenCalledTimes(1)
  const enteringDismiss = jest.fn()
  let entering: TLease
  await act(() => {
    entering = f.host.layers.register("entering", {
      ...f.options,
      parent: "layer",
      isKeyboardDismissDisabled: false,
      onDismiss: enteringDismiss,
    })
  })
  await acknowledge()
  const enteringPacket = packet()
  await act(() => root().props.onNativeScopedKey(enteringPacket))
  expect(enteringDismiss).not.toHaveBeenCalled()
  expect(f.dismiss).toHaveBeenCalledTimes(1)
  await act(() => {
    entering!.entered(entering!.state().generation)
  })
  await acknowledge()
  await act(() => root().props.onNativeScopedKey(enteringPacket))
  expect(enteringDismiss).not.toHaveBeenCalled()
  await act(() => root().props.onNativeScopedKey(packet()))
  expect(enteringDismiss).toHaveBeenCalledTimes(1)
})

it("retires the old child packet before exposing its parent, including after fresh acknowledgment", async () => {
  const f = await setup()
  const childDismiss = jest.fn()
  let child: TLease
  await act(() => {
    child = f.host.layers.register("child", {
      ...f.options,
      parent: "layer",
      capturesOutside: false,
      onDismiss: childDismiss,
    })
  })
  await act(() => {
    child!.entered(child!.state().generation)
  })
  await acknowledge()
  const childPacket = packet()
  await act(() => root().props.onNativeScopedKey(childPacket))
  expect(childDismiss).toHaveBeenCalledTimes(1)
  expect(f.dismiss).not.toHaveBeenCalled()
  await act(() => {
    child!.unregister()
  })
  await acknowledge()
  await act(() => root().props.onNativeScopedKey(childPacket))
  expect(f.dismiss).not.toHaveBeenCalled()
  await act(() => root().props.onNativeScopedKey(packet()))
  expect(f.dismiss).toHaveBeenCalledTimes(1)
})

it("rejects retired native windows and retained callbacks after unmount", async () => {
  const f = await setup()
  await acknowledge()
  const old = packet()
  const callback = root().props.onNativeScopedKey
  const props = root().props
  await act(() =>
    props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: props.acceptedWindowId,
        epoch: 2,
        policyRevision: props.policyRevision,
        ready: false,
        windowActive: false,
      },
    }),
  )
  await act(() => callback(old))
  expect(f.dismiss).not.toHaveBeenCalled()
  await acknowledge(3, "replacement-window")
  await act(() => callback(old))
  expect(f.dismiss).not.toHaveBeenCalled()
  const fresh = packet()
  await f.result.unmount()
  await act(() => callback(fresh))
  expect(f.dismiss).not.toHaveBeenCalled()
})

it("keeps passive delivery independent of consuming policy revisions and retains the original event", async () => {
  const observed = jest.fn()
  const Observer = () => {
    useNativeKeyboardObservation({ isEnabled: true, lifetimeKey: "live", canAct: () => true, onKeyDown: observed })
    return null
  }
  let host: THost | undefined
  await render(
    <NativeFloatingLayerHost testID="host">
      <Observer />
      <Probe
        observe={(next) => {
          host = next
        }}
      />
    </NativeFloatingLayerHost>,
  )
  await acknowledge()
  for (let attempt = 0; attempt < 2; attempt++) {
    await act(() => {
      const props = root().props
      props.onNativeObservationStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: props.acceptedWindowId,
          epoch: props.acceptedEpoch,
          observationRevision: props.observationRevision,
          ready: true,
          windowActive: true,
        },
      })
    })
  }
  const before = root().props.observationRevision
  await act(() => {
    host!.layers.register("new-consuming-policy", {
      parent: null,
      isOpen: true,
      isModal: false,
      isKeyboardDismissDisabled: false,
      onDismiss: jest.fn(),
    })
  })
  const props = root().props
  expect(props.observationRevision).toBe(before)
  const event = {
    nativeEvent: {
      ownerId: props.ownerId,
      windowId: props.acceptedWindowId,
      epoch: props.acceptedEpoch,
      observationRevision: props.observationRevision,
      eventId: 1,
      observerIds: props.observations.map(({ id }: { id: string }) => id),
      cancelled: false,
      code: "KeyE",
      key: "q",
      repeat: true,
      defaultCaptured: false,
    },
  }
  await act(() => props.onNativeObservedKey(event))
  expect(observed).toHaveBeenCalledWith(event)
  expect(observed.mock.calls[0][0]).toBe(event)
})

it("connects Menu policy revisions and original packets to the native host without changing passive pointer revisions", async () => {
  const observe = jest.fn(),
    retire = jest.fn()
  const node = (enabled: boolean) => (
    <NativeFloatingLayerHost testID="host">
      <PointerProbe {...{ enabled, observe, retire }} />
    </NativeFloatingLayerHost>
  )
  await render(node(true))
  expect(root().props.menuPointerPolicies).toEqual([])
  await acknowledge()
  const props = root().props,
    passiveRevision = props.pointerRevision
  expect(props.menuPointerPolicies).toHaveLength(1)
  expect(JSON.parse(props.menuPointerPolicies[0].triggerBinding).descriptorId).toBe("trigger")
  let sequence = 0
  const event = (phase: "status" | "handoff"): TNativeMenuPointerEvent =>
    ({
      nativeEvent: {
        ownerId: props.ownerId,
        windowId: props.acceptedWindowId,
        epoch: props.acceptedEpoch,
        revision: props.menuPointerRevision,
        policyId: props.menuPointerPolicies[0].id,
        sequence: ++sequence,
        phase,
        ready: true,
        suppressed: false,
        observationId: phase === "handoff" ? 9 : 0,
        pointerType: phase === "handoff" ? "mouse" : "unknown",
        pageX: 40,
        pageY: 80,
        timestamp: 10000,
        target: 11,
        hitPath: [11, 10, 1],
        nativeButtons: "0",
        nativeModifiers: "0",
        geometry: "{}",
        error: "",
      },
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    }) as unknown as TNativeMenuPointerEvent
  const callback = props.onNativeMenuPointer
  const early = event("handoff")
  await act(() => callback(early))
  expect(observe).not.toHaveBeenCalled()
  await act(() => callback(event("status")))
  const original = event("handoff")
  await act(() => callback(original))
  expect(observe).toHaveBeenLastCalledWith(original)
  expect(observe.mock.calls.at(-1)![0]).toBe(original)
  expect(original.preventDefault).not.toHaveBeenCalled()
  await screen.rerender(node(false))
  expect(root().props.menuPointerPolicies).toEqual([])
  expect(root().props.pointerRevision).toBe(passiveRevision)
  await act(() => callback(original))
  expect(observe).toHaveBeenCalledTimes(2)
  await screen.rerender(node(true))
  expect(root().props.menuPointerPolicies[0].id).not.toBe(props.menuPointerPolicies[0].id)
  const retainedCallback = root().props.onNativeMenuPointer
  await screen.unmount()
  await act(() => retainedCallback(original))
  expect(observe).toHaveBeenCalledTimes(2)
  expect(retire).toHaveBeenCalled()
})
