import { act, render, screen } from "@testing-library/react-native"
import { createRef, useCallback, useState } from "react"
import { TextInput } from "react-native"

import { NativeKeyboardScope } from "../NativeKeyboardScope"
import type { TNativeOrdinaryEditorKeyEvent } from "../ordinaryEditorKeys"
import { useNativeOriginalEditorKeyPolicy, type TNativeOriginalEditorActionFrame } from "../originalEditorKeyPolicy"

const originalRef = createRef<TextInput>()
const Harness = ({
  readonly = false,
  action,
  observe,
}: {
  readonly?: boolean
  action: jest.Mock
  observe: jest.Mock
}) => {
  const [original, setOriginal] = useState<TextInput | null>(null)
  const ref = useCallback((value: TextInput | null) => {
    originalRef.current = value
    setOriginal(value)
  }, [])
  const receive = useNativeOriginalEditorKeyPolicy(original, {
    enabled: true,
    actionEnabled: !readonly,
    lifetimeKey: "configuration",
    tokens: ["0000:ArrowUp"],
    current: () => originalRef.current,
    canAct: () => true,
    onAction: action,
    receive: observe,
  })
  const nativeProps = { ref, testID: "editor", onNativeOrdinaryEditorKey: receive }
  return <TextInput {...nativeProps} value="raw draft" editable={!readonly} />
}
const host = () => screen.getByTestId("host")
const editor = () => screen.getByTestId("editor")
const acknowledge = async () => {
  for (const ready of [false, true]) {
    await act(() =>
      host().props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: host().props.ownerId,
          windowId: "window",
          epoch: 1,
          policyRevision: host().props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const props = host().props,
    binding = props.ordinaryEditorBindings[0]
  await act(() =>
    props.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...binding,
        ownerId: props.ownerId,
        target: 17,
        windowId: "window",
        epoch: 1,
        sequence: 1,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
}
const packets = (dispatchId: number) => {
  const props = host().props,
    binding = props.ordinaryEditorBindings[0],
    policy = props.policies[0]
  const data = {
    kind: "keyboard",
    ownerId: props.ownerId,
    policyId: policy?.id ?? "disabled",
    target: 9,
    focusedTarget: 17,
    windowId: "window",
    epoch: 1,
    policyRevision: props.policyRevision,
    key: "ArrowUp",
    nativeCode: 19,
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
    nativeDefaultHandled: !!policy,
    timestamp: dispatchId,
  }
  const frame = { ...data, ...binding, targetTag: 17, dispatchId, admitted: !!policy, isComposing: false }
  const internal = { nativeEvent: { ...data, originalEditorAction: JSON.stringify(frame) } }
  const original = {
    target: originalRef.current,
    currentTarget: originalRef.current,
    persist: jest.fn(),
    preventDefault: jest.fn(),
    nativeEvent: {
      ...data,
      ...binding,
      target: 17,
      eventId: dispatchId,
      code: "ArrowUp",
      location: 0,
      isComposing: false,
      observerBindings: "[]",
      originalEditorAction: JSON.stringify(frame),
    },
  }
  return { internal, original }
}
let find: jest.SpyInstance
beforeEach(() => {
  find = jest
    .spyOn(jest.requireActual("react-native"), "findNodeHandle")
    .mockImplementation((node: unknown) => (node === originalRef.current ? 17 : 9))
})
afterEach(() => find.mockRestore())
it("mounts the actual private hook on the original core editor and requests before public observation", async () => {
  const order: string[] = [],
    action = jest.fn((_frame: TNativeOriginalEditorActionFrame) => order.push("numeric")),
    observe = jest.fn((_event: TNativeOrdinaryEditorKeyEvent) => order.push("key"))
  await render(
    <NativeKeyboardScope captureEnabled testID="host">
      <Harness action={action} observe={observe} />
    </NativeKeyboardScope>,
  )
  await acknowledge()
  const original = originalRef.current,
    event = packets(1)
  expect(editor().props.value).toBe("raw draft")
  expect(host().props.policies[0]).toMatchObject({ originalEditorAction: true, targetTag: 17 })
  expect(host().props.ordinaryEditorBindings[0]).toHaveProperty("originalEditorAction", true)
  await act(() => host().props.onNativeScopedKey(event.internal))
  await act(() => editor().props.onNativeOrdinaryEditorKey(event.original))
  expect(order).toEqual(["numeric", "key"])
  expect(observe.mock.calls[0][0]).toBe(event.original)
  expect(observe.mock.calls[0][0].nativeEvent).toBe(event.original.nativeEvent)
  expect(action.mock.calls[0][0]).not.toHaveProperty("nativeEvent")
  expect(originalRef.current).toBe(original)
})
it("keeps readonly observation and original refs while native numeric capture is disabled", async () => {
  const action = jest.fn(),
    observe = jest.fn()
  await render(
    <NativeKeyboardScope captureEnabled testID="host">
      <Harness readonly action={action} observe={observe} />
    </NativeKeyboardScope>,
  )
  await acknowledge()
  const original = originalRef.current,
    event = packets(1)
  expect(host().props.policies).toEqual([])
  expect(host().props.ordinaryEditorBindings[0]).toHaveProperty("originalEditorAction", true)
  expect(host().props.ordinaryEditorBindings).toHaveLength(1)
  expect(editor().props.editable).toBe(false)
  await act(() => editor().props.onNativeOrdinaryEditorKey(event.original))
  expect(observe.mock.calls[0][0]).toBe(event.original)
  expect(action).not.toHaveBeenCalled()
  expect(originalRef.current).toBe(original)
})
