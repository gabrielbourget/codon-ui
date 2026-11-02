import { act, render, screen } from "@testing-library/react-native"
import { useLayoutEffect } from "react"
import type { TextInput } from "react-native"

import { NativeFloatingLayerHost, useNativeFloatingHost } from "../../overlays/floating/NativeFloatingLayerHost"
import type { TNativeKeyScope } from "../keyScope"
import { useNativeInputModalityWitness } from "../nativeInputModality"
import type { TNativeInputModalityWitness } from "../nativeInputModality"
import {
  NativeKeyboardScope,
  useNativeKeyboardObservation,
  useNativeKeyPolicy,
  useNativeKeyScope,
  useNativeWindowPointers,
} from "../NativeKeyboardScope"
import type { TNativeWindowPointers } from "../nativeWindowPointers"
import { useNativeOrdinaryEditorKeys, type TNativeOrdinaryEditorKeyEvent } from "../ordinaryEditorKeys"

type THost = ReturnType<typeof useNativeFloatingHost>
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

it("keeps passive pointer and keyboard transport without a Menu grace interception channel", async () => {
  await render(<NativeFloatingLayerHost testID="host" />)
  await acknowledge()
  const props = root().props
  expect(props).not.toHaveProperty("menuPointerPolicies")
  expect(props).not.toHaveProperty("menuPointerRevision")
  expect(props).not.toHaveProperty("onNativeMenuPointer")
  expect(props.onNativeWindowPointer).toEqual(expect.any(Function))
  expect(props.onNativeObservedKey).toEqual(expect.any(Function))
  expect(props.onNativeScopedKey).toEqual(expect.any(Function))
})

it("retires ordinary editor callbacks immediately when logical window ownership is disabled", async () => {
  // Explicit identity/status model; this case does not prove installed event delivery.
  const editor = { _nativeTag: 17 } as unknown as TextInput
  const observe = jest.fn()
  let deliver: ReturnType<typeof useNativeOrdinaryEditorKeys> | undefined
  const Editor = ({ policyEnabled }: { policyEnabled: boolean }) => {
    useNativeKeyPolicy({
      tokens: ["0000:ArrowUp"],
      targetTag: 17,
      excludeEditable: false,
      isEnabled: policyEnabled,
      lifetimeKey: "unrelated-policy",
      canAct: () => true,
      onKey: () => {},
    })
    const receive = useNativeOrdinaryEditorKeys(editor, true, "original", {
      current: () => editor,
      canAct: () => true,
      receive: observe,
    })
    useLayoutEffect(() => {
      deliver = receive
    })
    return null
  }
  const node = (captureEnabled: boolean, policyEnabled = false) => (
    <NativeKeyboardScope captureEnabled={captureEnabled} testID="host">
      <Editor policyEnabled={policyEnabled} />
    </NativeKeyboardScope>
  )
  const result = await render(node(true))
  await acknowledge()
  const props = root().props
  const binding = props.ordinaryEditorBindings[0]
  await act(() =>
    props.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        target: 17,
        ownerId: props.ownerId,
        windowId: "native-window",
        epoch: 1,
        sequence: 1,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
  const event = (eventId: number) =>
    ({
      nativeEvent: {
        ...binding,
        kind: "keyboard",
        ownerId: props.ownerId,
        target: 17,
        windowId: "native-window",
        epoch: 1,
        eventId,
        key: "z",
        code: "KeyZ",
        location: 0,
        nativeCode: 29,
        characters: "z",
        phase: "down",
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        nativeDefaultHandled: false,
        timestamp: eventId,
      },
      target: editor,
      currentTarget: editor,
      persist: jest.fn(),
    }) as unknown as TNativeOrdinaryEditorKeyEvent
  await act(() => deliver!(event(1)))
  expect(observe).toHaveBeenCalledTimes(1)
  // An unrelated pending policy revision must not suppress the editor observation.
  await result.rerender(node(true, true))
  await act(() => deliver!(event(2)))
  expect(observe).toHaveBeenCalledTimes(2)
  await result.rerender(node(false, true))
  // The actual native window is still reported active; no new status is delivered.
  await act(() => deliver!(event(3)))
  expect(observe).toHaveBeenCalledTimes(2)
})

it("publishes genuine accepted keyboard chronology after virtual activation and rejects exact same-packet replay", async () => {
  let input!: TNativeKeyScope,
    pointers!: TNativeWindowPointers,
    witness: TNativeInputModalityWitness | null = null
  const Probe = () => {
    input = useNativeKeyScope()!
    pointers = useNativeWindowPointers()!
    witness = useNativeInputModalityWitness(input)
    return null
  }
  const view = await render(
    <NativeKeyboardScope captureEnabled testID="host">
      <Probe />
    </NativeKeyboardScope>,
  )
  await act(() => {
    pointers.register("existing-consumer", {
      targetTag: 7,
      global: true,
      stopPropagation: true,
      current: () => true,
      start: () => true,
      move: jest.fn(),
      end: jest.fn(),
      activate: jest.fn(),
      retire: jest.fn(),
    })
    pointers.flush()
  })
  await acknowledge()
  await act(() =>
    root().props.onNativePointerStatus({
      nativeEvent: {
        ownerId: input.ownerId,
        ...input.acknowledgedSession(),
        revision: pointers.revision(),
        ready: true,
        error: "",
      },
    }),
  )
  const record = (timestamp: number) =>
    act(() =>
      root().props.onNativeInputModality({
        nativeEvent: { ownerId: input.ownerId, ...input.acknowledgedSession(), origin: "keyboard", timestamp },
      }),
    )
  await record(10)
  const originalKeyboard = input.lastInput()
  const first = witness as TNativeInputModalityWitness | null
  expect(first?.origin).toBe("keyboard")
  const data = {
    ownerId: input.ownerId,
    ...input.acknowledgedSession(),
    sequence: 1,
    phase: "activation",
    pointerType: "virtual",
    pointerId: -1,
    isPrimary: true,
    button: 0,
    buttons: 0,
    target: 7,
    pageX: 0,
    pageY: 0,
    timestamp: 1,
    registrations: pointers.registrations().map((entry) => ({
      ...entry,
      ownerId: input.ownerId,
      epoch: input.acknowledgedSession().epoch,
      revision: pointers.revision(),
      depth: -1,
    })),
  }
  await act(() => root().props.onNativeWindowPointer({ nativeEvent: data }))
  expect((witness as TNativeInputModalityWitness | null)?.origin).toBe("virtual")
  expect(input.lastInput()?.origin).toBe("keyboard")
  const virtual = witness
  await act(() => root().props.onNativeInputModality({ nativeEvent: originalKeyboard }))
  expect(witness).toBe(virtual)
  await record(11)
  expect((witness as TNativeInputModalityWitness | null)?.origin).toBe("keyboard")
  expect((witness as TNativeInputModalityWitness | null)!.revision).toBeGreaterThan(first!.revision)
  await view.unmount()
})
