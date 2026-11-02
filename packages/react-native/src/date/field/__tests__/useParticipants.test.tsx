import { act, render, screen } from "@testing-library/react-native"
import { useRef, useState, type RefObject } from "react"
import type * as RN from "react-native"

import { registerNativeFocusTarget } from "../../../input/focus"
import { NativeFocusHost } from "../../../input/NativeFocusView"
import { NativeKeyboardScope } from "../../../input/NativeKeyboardScope"
import {
  NativeOrdinaryFieldGroupKeysContext,
  NativeOrdinaryFocusParticipantsContext,
} from "../../../input/ordinaryEditorKeys"
import type { TNativeKeyboardEvent } from "../../../input/types"
import { useNativeDateFieldParticipants } from "../useParticipants"

let refs: { root: RN.View | null; extra: RefObject<RN.View | null>; independent: RefObject<RN.View | null> }
const Probe = ({
  leaf,
  group,
  independent,
  listed = true,
  subtree = false,
  rootKey,
}: {
  leaf: jest.Mock
  group: jest.Mock
  independent: jest.Mock
  listed?: boolean
  subtree?: boolean
  rootKey?: jest.Mock
}) => {
  const extra = useRef<RN.View | null>(null)
  const independentRef = useRef<RN.View | null>(null)
  const [root, setRoot] = useState<RN.View | null>(null)
  refs = { root, extra, independent: independentRef }
  const participants = useNativeDateFieldParticipants({
    root,
    participants: listed ? [extra] : [],
    requiresHost: listed,
    disabled: false,
    key: group,
  })
  return (
    <NativeOrdinaryFieldGroupKeysContext.Provider value={subtree}>
      <NativeOrdinaryFocusParticipantsContext.Provider value={participants.observes}>
        <NativeFocusHost
          ref={setRoot}
          testID="root"
          focusable={false}
          onNativeOrdinaryEditorKey={participants.receive}
          onKeyDown={rootKey}
        >
          <NativeFocusHost ref={extra} testID="extra" onKeyDown={leaf} />
          <NativeFocusHost ref={independentRef} testID="independent" onKeyDown={independent} />
        </NativeFocusHost>
      </NativeOrdinaryFocusParticipantsContext.Provider>
    </NativeOrdinaryFieldGroupKeysContext.Provider>
  )
}
beforeEach(() => {
  const tags = new WeakMap<object, number>()
  let serial = 20
  jest.spyOn(jest.requireActual<typeof RN>("react-native"), "findNodeHandle").mockImplementation((target) => {
    if (!target || typeof target !== "object") return typeof target === "number" ? target : null
    if (!tags.has(target)) tags.set(target, ++serial)
    return tags.get(target)!
  })
})
afterEach(() => jest.restoreAllMocks())
it("shares a FocusView publisher, retains actual leaf/root events and leaves unlisted controls independent", async () => {
  const leaf = jest.fn(),
    group = jest.fn(),
    independent = jest.fn()
  await render(
    <NativeKeyboardScope captureEnabled testID="host">
      <Probe leaf={leaf} group={group} independent={independent} />
    </NativeKeyboardScope>,
  )
  for (const ready of [false, true, true]) {
    const props = screen.getByTestId("host").props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "window",
          epoch: 1,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const props = screen.getByTestId("host").props
  expect(props.ordinaryEditorBindings).toHaveLength(3)
  expect(props.policies).toHaveLength(1)
  const binding = props.ordinaryEditorBindings.find(
    (value: { targetTag: number }) =>
      value.targetTag === jest.requireActual<typeof RN>("react-native").findNodeHandle(refs.extra.current),
  )
  const observer = props.ordinaryEditorBindings.find((value: { subtree: boolean }) => value.subtree)
  for (const value of props.ordinaryEditorBindings)
    await act(() =>
      props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...value,
          target: value.targetTag,
          ownerId: props.ownerId,
          windowId: "window",
          epoch: 1,
          sequence: 1,
          ready: true,
          windowActive: true,
          error: "",
        },
      }),
    )
  // The test renderer has no native ReadOnlyNode hierarchy; model the observed originals explicitly.
  Object.assign(refs.root!, { childNodes: [refs.extra.current] })
  const event = {
    target: refs.extra.current,
    currentTarget: refs.extra.current,
    persist: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...binding,
      observerBindings: JSON.stringify([observer]),
      target: binding.targetTag,
      ownerId: props.ownerId,
      windowId: "window",
      epoch: 1,
      eventId: 1,
      kind: "keyboard",
      key: "ArrowLeft",
      phase: "down",
      cancelled: false,
    },
  } as unknown as TNativeKeyboardEvent
  await act(() => screen.getByTestId("extra").props.onNativeOrdinaryEditorKey(event))
  expect(leaf.mock.calls[0][0]).toBe(event)
  Object.assign(event, { currentTarget: refs.root })
  await act(() => screen.getByTestId("root").props.onNativeOrdinaryEditorKey(event))
  expect(group.mock.calls[0][0]).toBe(event)
  expect(event.target).toBe(refs.extra.current)
  const own = screen.getByTestId("independent").props
  await act(() => own.onNativeKey({ nativeEvent: { kind: "keyboard", ownerId: own.ownerId, phase: "down" } }))
  expect(independent).not.toHaveBeenCalled()
  expect(group).toHaveBeenCalledTimes(1)
  const independentBinding = props.ordinaryEditorBindings.find(
    (value: { targetTag: number }) =>
      value.targetTag === jest.requireActual<typeof RN>("react-native").findNodeHandle(refs.independent.current),
  )
  const independentEvent = {
    ...event,
    target: refs.independent.current,
    currentTarget: refs.independent.current,
    nativeEvent: { ...event.nativeEvent, ...independentBinding, target: independentBinding.targetTag, eventId: 2 },
  }
  await act(() => screen.getByTestId("independent").props.onNativeOrdinaryEditorKey(independentEvent))
  // A portalled control can retain React event ancestry without native containment.
  expect(independent.mock.calls[0][0]).toBe(independentEvent)
  Object.assign(independentEvent, { currentTarget: refs.root })
  await act(() => screen.getByTestId("root").props.onNativeOrdinaryEditorKey(independentEvent))
  expect(group.mock.calls[1][0]).toBe(independentEvent)
  expect(props.policies[0].targetTag).toBe(binding.targetTag)
  const replacement = {} as RN.View
  const release = registerNativeFocusTarget(replacement, { canFocus: () => true, focus: () => {}, blur: () => {} })
  refs.extra.current = replacement
  // A native structural observation refreshes ref-based policies without an
  // explicit rerender by the field's caller.
  await act(() =>
    screen.getByTestId("host").props.onNativeOrdinaryEditorStatus({
      nativeEvent: {
        ...observer,
        ownerId: props.ownerId,
        target: observer.targetTag,
        windowId: "window",
        epoch: 1,
        sequence: 2,
        ready: true,
        windowActive: true,
        error: "",
      },
    }),
  )
  expect(screen.getByTestId("host").props.policies[0].targetTag).toBe(
    jest.requireActual<typeof RN>("react-native").findNodeHandle(replacement),
  )
  release()
})
it("requires the approved host when explicit participants are requested", async () => {
  await expect(render(<Probe leaf={jest.fn()} group={jest.fn()} independent={jest.fn()} />)).rejects.toThrow(
    "NativeFloatingLayerHost",
  )
})

it("retains original descendant callbacks for an owned nonfocusable group while surrounding native views keep direct keys", async () => {
  const rootKey = jest.fn(),
    group = jest.fn()
  const node = (subtree: boolean) => (
    <NativeKeyboardScope captureEnabled testID="host">
      <Probe leaf={jest.fn()} independent={jest.fn()} group={group} rootKey={rootKey} subtree={subtree} />
    </NativeKeyboardScope>
  )
  const view = await render(node(true))
  for (const ready of [false, true, true]) {
    const props = screen.getByTestId("host").props
    await act(() =>
      props.onNativeScopeStatus({
        nativeEvent: {
          ownerId: props.ownerId,
          windowId: "window",
          epoch: 1,
          policyRevision: props.policyRevision,
          ready,
          windowActive: true,
        },
      }),
    )
  }
  const props = screen.getByTestId("host").props
  const binding = props.ordinaryEditorBindings.find(
    (value: { targetTag: number }) =>
      value.targetTag === jest.requireActual<typeof RN>("react-native").findNodeHandle(refs.extra.current),
  )
  for (const value of props.ordinaryEditorBindings)
    await act(() =>
      props.onNativeOrdinaryEditorStatus({
        nativeEvent: {
          ...value,
          ownerId: props.ownerId,
          target: value.targetTag,
          windowId: "window",
          epoch: 1,
          sequence: 1,
          ready: true,
          windowActive: true,
          error: "",
        },
      }),
    )
  const event = {
    target: refs.extra.current,
    currentTarget: refs.root,
    persist: jest.fn(),
    isPropagationStopped: () => false,
    nativeEvent: {
      ...binding,
      ownerId: props.ownerId,
      target: binding.targetTag,
      observerBindings: JSON.stringify(
        props.ordinaryEditorBindings.filter((value: { subtree: boolean }) => value.subtree),
      ),
      windowId: "window",
      epoch: 1,
      eventId: 1,
      phase: "down",
      kind: "keyboard",
      cancelled: false,
    },
  }
  await act(() => screen.getByTestId("root").props.onNativeOrdinaryEditorKey(event))
  expect(rootKey).toHaveBeenCalledWith(event)
  expect(group).toHaveBeenCalledWith(event)
  rootKey.mockClear()
  await view.rerender(node(false))
  Object.assign(event.nativeEvent, { eventId: 2 })
  await act(() => screen.getByTestId("root").props.onNativeOrdinaryEditorKey(event))
  expect(rootKey).not.toHaveBeenCalled()
})
