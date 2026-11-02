import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import * as RN from "react-native"

import { createNativeOrdinaryEditorKeys, NativeOrdinaryEditorKeysContext } from "../../../input/ordinaryEditorKeys"
import type { TNativeSwitcherRootKeyEvent } from "../rootKeys"
import { ToggleSwitcher } from "../ToggleSwitcher"

let mockSequence = 24000
const mockActors = new Map<string, RN.View & { nativeTag: number }>()
jest.mock("../../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest
    .requireActual("react")
    .forwardRef((props: Record<string, unknown>, ref: import("react").Ref<RN.View>) => {
      const React = jest.requireActual<typeof import("react")>("react")
      const [original] = React.useState(() => ({
        _nativeTag: ++mockSequence,
        nativeTag: mockSequence,
        isConnected: true,
        focus: jest.fn(),
        setNativeProps: jest.fn(),
        measure: jest.fn(),
      }))
      React.useImperativeHandle(ref, () => original as unknown as RN.View, [original])
      mockActors.set(String(props.ownerId), original as unknown as RN.View & { nativeTag: number })
      return React.createElement(jest.requireActual("react-native").View, props)
    }),
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
    queryMotionGeometry: jest.fn(),
    sampleMotionColors: jest.fn(),
  },
}))
const items = [
  { id: "a", label: "First", accessibilityLabel: "First" },
  { id: "b", label: "Second", accessibilityLabel: "Second" },
]
beforeEach(() => {
  mockActors.clear()
  jest.spyOn(RN.AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true)
})
afterEach(() => jest.restoreAllMocks())
const setup = () => {
  const session = { active: true, windowId: "window:1", epoch: 1 }
  const registry = createNativeOrdinaryEditorKeys("switcher-scope", () => session)
  let sequence = 0
  const acknowledge = () => {
    for (const binding of registry.bindings())
      registry.acceptStatus({
        ...binding,
        ownerId: "switcher-scope",
        target: binding.targetTag,
        windowId: session.windowId,
        epoch: session.epoch,
        sequence: ++sequence,
        ready: true,
        windowActive: session.active,
        error: "",
      })
  }
  const packet = (root: RN.View, target: RN.View, eventId: number, phase: "down" | "up" = "down", key = "Enter") => {
    const binding = registry
      .bindings()
      .find((row) => row.targetTag === jest.requireActual<typeof RN>("react-native").findNodeHandle(target))!
    let prevented = false,
      stopped = false
    return {
      nativeEvent: {
        ...binding,
        observerBindings: JSON.stringify(registry.bindings().filter((row) => row.subtree)),
        ownerId: "switcher-scope",
        target: jest.requireActual<typeof RN>("react-native").findNodeHandle(target),
        windowId: session.windowId,
        epoch: session.epoch,
        eventId,
        kind: "keyboard",
        key,
        code: key === "Enter" ? "Enter" : "KeyA",
        location: 0,
        nativeCode: key === "Enter" ? 13 : 29,
        characters: key,
        phase,
        repeat: false,
        cancelled: false,
        isComposing: false,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        capsLock: false,
        nativeModifierData: "0",
        nativeDefaultHandled: true,
        timestamp: eventId,
      },
      target,
      currentTarget: root,
      persist: jest.fn(),
      preventDefault: () => {
        prevented = true
      },
      isDefaultPrevented: () => prevented,
      stopPropagation: () => {
        stopped = true
      },
      isPropagationStopped: () => stopped,
    } as unknown as TNativeSwitcherRootKeyEvent
  }
  return { session, registry, acknowledge, packet }
}

it("uses the existing original key capture/target/bubble route and preserves current records and controlled veto", async () => {
  const value = setup(),
    ref = createRef<RN.View>(),
    change = jest.fn()
  let veto = true
  const order: string[] = [],
    events: TNativeSwitcherRootKeyEvent[] = []
  const capture = (event: TNativeSwitcherRootKeyEvent) => {
    expect(event.currentTarget).toBe(ref.current)
    order.push("capture:" + event.nativeEvent.phase)
    events.push(event)
    if (veto && event.nativeEvent.phase === "down") event.preventDefault()
  }
  const bubble = (event: TNativeSwitcherRootKeyEvent) => {
    expect(event.currentTarget).toBe(ref.current)
    order.push("bubble:" + event.nativeEvent.phase)
    events.push(event)
  }
  await render(
    <NativeOrdinaryEditorKeysContext.Provider value={value.registry}>
      <ToggleSwitcher
        ref={ref}
        items={items}
        selectedKey="a"
        onSelectionChange={change}
        onKeyDownCapture={capture}
        onKeyDown={bubble}
        onKeyUpCapture={capture}
        onKeyUp={bubble}
      />
    </NativeOrdinaryEditorKeysContext.Provider>,
  )
  value.acknowledge()
  const root = screen.getByTestId("toggle-switcher"),
    option = screen.getByRole("button", { name: "Second" })
  const original = mockActors.get(option.props.ownerId)!
  const down = value.packet(ref.current!, original, 1)
  const up = value.packet(ref.current!, original, 2, "up")
  await act(() => {
    for (const event of [down, up]) {
      event.currentTarget = ref.current!
      root.props.onNativeOrdinaryEditorKeyCapture(event)
      if (!event.isPropagationStopped()) {
        order.push("target:" + event.nativeEvent.phase)
        event.currentTarget = original
        option.props.onNativeOrdinaryEditorKey(event)
      }
      if (!event.isPropagationStopped()) {
        event.currentTarget = ref.current!
        root.props.onNativeOrdinaryEditorKey(event)
      }
    }
  })
  expect(order).toEqual(["capture:down", "target:down", "bubble:down", "capture:up", "target:up", "bubble:up"])
  expect(events).toEqual([down, down, up, up])
  expect(events.every((event) => event.target === original)).toBe(true)
  expect(change).not.toHaveBeenCalled()
  expect(option.props.accessibilityState.checked).toBe(false)
  veto = false
  const acceptedDown = value.packet(ref.current!, original, 3)
  const acceptedUp = value.packet(ref.current!, original, 4, "up")
  await act(() => {
    for (const event of [acceptedDown, acceptedUp]) {
      event.currentTarget = ref.current!
      root.props.onNativeOrdinaryEditorKeyCapture(event)
      event.currentTarget = original
      option.props.onNativeOrdinaryEditorKey(event)
      event.currentTarget = ref.current!
      root.props.onNativeOrdinaryEditorKey(event)
    }
  })
  expect(change.mock.calls).toEqual([["b"]])
  expect(option.props.accessibilityState.checked).toBe(false)
})

it("updates root callbacks without replacing originals and rejects removed targets, foreign windows and detached roots", async () => {
  const value = setup(),
    ref = createRef<RN.View>(),
    first = jest.fn(),
    next = jest.fn()
  const node = (callback: typeof first, reduced = false) => (
    <NativeOrdinaryEditorKeysContext.Provider value={value.registry}>
      <ToggleSwitcher ref={ref} items={reduced ? items.slice(0, 1) : items} selectedKey="a" onKeyDown={callback} />
    </NativeOrdinaryEditorKeysContext.Provider>
  )
  const view = await render(node(first))
  value.acknowledge()
  const originalRoot = ref.current!,
    option = screen.getByRole("button", { name: "Second" }),
    original = mockActors.get(option.props.ownerId)!
  const event = value.packet(originalRoot, original, 1, "down", "a")
  await act(() => screen.getByTestId("toggle-switcher").props.onNativeOrdinaryEditorKey(event))
  expect(first.mock.calls[0][0]).toBe(event)
  await view.rerender(node(next))
  expect(ref.current).toBe(originalRoot)
  value.acknowledge()
  const current = value.packet(originalRoot, original, 2, "down", "a")
  await act(() => screen.getByTestId("toggle-switcher").props.onNativeOrdinaryEditorKey(current))
  expect(next.mock.calls[0][0]).toBe(current)
  const originalForeign = value.packet(originalRoot, original, 3, "down", "a")
  const foreign = { ...originalForeign, nativeEvent: { ...originalForeign.nativeEvent, windowId: "foreign" } }
  await act(() => screen.getByTestId("toggle-switcher").props.onNativeOrdinaryEditorKey(foreign))
  expect(next).toHaveBeenCalledTimes(1)
  const removed = value.packet(originalRoot, original, 4, "down", "a")
  await view.rerender(node(next, true))
  value.acknowledge()
  const receive = screen.getByTestId("toggle-switcher").props.onNativeOrdinaryEditorKey
  await act(() => receive(removed))
  expect(next).toHaveBeenCalledTimes(1)
  await view.unmount()
  await act(() => receive(removed))
  expect(ref.current).toBeNull()
  expect(next).toHaveBeenCalledTimes(1)
})
