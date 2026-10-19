import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput } from "react-native"
import type { GestureResponderEvent, View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyScope } from "../../input/keyScope"
import type { TNativeActivationEvent, TNativeFocusEvent, TNativeKeyboardEvent } from "../../input/types"
import { NativeMotionConfig } from "../config"
import { NativeMotionInteractions } from "../interactions/NativeMotionInteractions"
import type { TNativeMotionHoverEvent } from "../interactions/types"
import { MotionGlobalConfig, frameData, time } from "../kernel"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerOptions, TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: {
    requestKeyboardFocus: jest.fn(),
    requestContainerFocus: jest.fn(),
    requestKeyboardBlur: jest.fn(),
    inspectAccessibility: jest.fn(),
  },
}))
let mockScope: TNativeKeyScope | null = null
jest.mock("../../input/NativeKeyboardScope", () => ({
  ...jest.requireActual("../../input/NativeKeyboardScope"),
  useNativeKeyScope: () => mockScope,
}))
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
const flush = async (timestamp = 1016) => {
  await act(() => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
  })
}
const event = <Data,>(nativeEvent: Data) => {
  let prevented = false
  return {
    nativeEvent,
    target: 17,
    currentTarget: 17,
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  }
}
const touch = (x = 20, y = 30, timestamp = 1) =>
  event({
    target: 17,
    identifier: 0,
    pageX: x,
    pageY: y,
    locationX: x,
    locationY: y,
    timestamp,
  }) as unknown as GestureResponderEvent
const hover = (pointerType = "mouse", x = 20) =>
  event({ pointerType, pageX: x, pageY: 30 }) as unknown as TNativeMotionHoverEvent
const key = (key = "Enter", nativeCode = 66, extra: Record<string, unknown> = {}) =>
  event({
    kind: "keyboard",
    key,
    nativeCode,
    nativeDefaultHandled: true,
    cancelled: false,
    repeat: false,
    ...extra,
  }) as unknown as TNativeKeyboardEvent
const activation = () =>
  event({
    kind: "activation",
    source: "ios-accessibility-activate",
    target: 17,
    observedAt: 1,
  }) as unknown as TNativeActivationEvent
// Rectangle/window events here are explicit models. No native geometry or window is observed.
const fixture = (props: TNativeMotionOwnerProps = {}, more: Partial<TNativeMotionOwnerOptions> = {}) => {
  const settings: TNativeMotionOwnerOptions = {
    props: { initial: { opacity: 1 }, ...props },
    base: {},
    config: { skipAnimations: true },
    reduced: false,
    canAct: () => true,
    ...more,
  }
  const owner = new NativeMotionOwner(settings)
  const rectangle = jest.fn(() => ({ x: 10, y: 20, width: 80, height: 40 }))
  owner.attach({ getBoundingClientRect: rectangle } as unknown as View)
  const errors = jest.fn()
  const interactions = new NativeMotionInteractions(owner, owner.captureAttachmentLease, errors)
  const dispose = () => {
    interactions.retire()
    owner.detach()
  }
  return { owner, settings, rectangle, interactions, errors, dispose }
}
beforeEach(() => {
  mockScope = null
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
})
afterEach(async () => {
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("defers tap callbacks to postRender with original events and independently captured points", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn()
  const f = fixture({ whileTap: { opacity: 0.2 }, onTapStart: start, onTap: complete, onTapCancel: cancel })
  const down = touch(),
    up = touch(70, 80)
  f.interactions.start(down, "pointer")
  expect(f.owner.animationState.getState().whileTap.isActive).toBe(true)
  f.interactions.move(touch(40, 50))
  f.interactions.end(up, true)
  expect(f.owner.animationState.getState().whileTap.isActive).toBe(false)
  expect(start).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
  await flush()
  expect(start).toHaveBeenCalledWith(down, { point: { x: 20, y: 30 } })
  expect(complete).toHaveBeenCalledWith(up, { point: { x: 70, y: 80 } })
  expect(start.mock.calls[0][0]).toBe(down)
  expect(complete.mock.calls[0][0]).toBe(up)
  expect(cancel).not.toHaveBeenCalled()
  expect(f.errors).not.toHaveBeenCalled()
  f.dispose()
})

it("keeps focus-visible, hover and tap priorities independent through the actual value backend", async () => {
  const f = fixture({ whileHover: { opacity: 0.7 }, whileTap: { opacity: 0.4 }, whileFocus: { opacity: 0.1 } })
  await f.owner.animationState.animateChanges()
  f.interactions.hoverStart(hover("touch"))
  expect(f.owner.animationState.getState().whileHover.isActive).toBe(false)
  f.interactions.hoverStart(hover())
  await flush()
  expect(f.owner.getValue("opacity")?.get()).toBe(0.7)
  f.interactions.start(touch(), "pointer")
  await flush(1032)
  expect(f.owner.getValue("opacity")?.get()).toBe(0.4)
  f.interactions.focus(event({ isFocusVisible: false }) as unknown as TNativeFocusEvent)
  expect(f.owner.animationState.getState().whileFocus.isActive).toBe(false)
  f.interactions.focus(event({ isFocusVisible: true }) as unknown as TNativeFocusEvent)
  await flush(1048)
  expect(f.owner.animationState.getState().whileFocus.isActive).toBe(true)
  expect(f.owner.getValue("opacity")?.get()).toBe(0.4)
  f.interactions.end(touch(), true)
  await flush(1064)
  expect(f.owner.getValue("opacity")?.get()).toBe(0.7)
  f.interactions.hoverEnd(hover())
  await flush(1080)
  expect(f.owner.getValue("opacity")?.get()).toBe(0.1)
  f.interactions.blur()
  await flush(1096)
  expect(f.owner.getValue("opacity")?.get()).toBe(1)
  expect(f.errors).not.toHaveBeenCalled()
  f.dispose()
})

it("defers held hover leave until the original pointer release and cancels that deferral on reentry", async () => {
  const start = jest.fn(),
    end = jest.fn()
  const f = fixture({ whileHover: { opacity: 0.5 }, onHoverStart: start, onHoverEnd: end })
  f.interactions.hoverStart(hover())
  f.interactions.hoverPointerDown()
  f.interactions.hoverEnd(hover("mouse", 90))
  await flush()
  expect(end).not.toHaveBeenCalled()
  expect(f.owner.animationState.getState().whileHover.isActive).toBe(true)
  f.interactions.hoverStart(hover("mouse", 25))
  const inside = hover("mouse", 25)
  f.interactions.hoverPointerUp(inside)
  await flush(1032)
  expect(start).toHaveBeenCalledTimes(2)
  expect(end).not.toHaveBeenCalled()
  f.interactions.hoverPointerDown()
  f.interactions.hoverEnd(hover("mouse", 90))
  const outside = hover("mouse", 100)
  f.interactions.hoverPointerUp(outside)
  await flush(1048)
  expect(end).toHaveBeenCalledWith(outside, { point: { x: 100, y: 30 } })
  expect(end.mock.calls[0][0]).toBe(outside)
  expect(f.owner.animationState.getState().whileHover.isActive).toBe(false)
  f.dispose()
})

it.each([
  ["Enter", 66],
  [" ", 62],
] as const)(
  "uses original %s key events and an actual-ref rectangle request without synthetic pointer events",
  async (name, code) => {
    const start = jest.fn(),
      complete = jest.fn(),
      cancel = jest.fn()
    const f = fixture({ onTapStart: start, onTap: complete, onTapCancel: cancel })
    f.interactions.keyDown(key(name, code, { repeat: true }))
    f.interactions.keyDown(key(name, code, { nativeDefaultHandled: false }))
    expect(f.rectangle).not.toHaveBeenCalled()
    const down = key(name, code),
      up = key(name, code)
    f.interactions.keyDown(down)
    f.interactions.keyDown(key(name, code, { repeat: true }))
    f.interactions.activation(activation())
    f.interactions.keyUp(key(name, code + 1))
    expect(complete).not.toHaveBeenCalled()
    f.interactions.keyUp(up)
    await flush()
    expect(start).toHaveBeenCalledTimes(1)
    expect(start).toHaveBeenCalledWith(down, { point: { x: 50, y: 40 } })
    expect(complete).toHaveBeenCalledTimes(1)
    expect(complete.mock.calls[0][0]).toBe(up)
    expect(cancel).not.toHaveBeenCalled()
    f.dispose()
  },
)

it("cancels native cancelled-key and blurred-key cycles with original cancellation events", async () => {
  const cancel = jest.fn(),
    complete = jest.fn()
  const f = fixture({ onTapCancel: cancel, onTap: complete })
  const cancelled = key("Enter", 66, { cancelled: true })
  f.interactions.keyDown(key())
  f.interactions.keyUp(cancelled)
  const next = key()
  f.interactions.keyDown(next)
  f.interactions.blur()
  await flush()
  expect(cancel.mock.calls.map((call) => call[0])).toEqual([cancelled, next])
  expect(complete).not.toHaveBeenCalled()
  f.dispose()
})

it("preserves standalone native activation identity and rejects unavailable rectangle data", async () => {
  const start = jest.fn(),
    complete = jest.fn()
  const f = fixture({ onTapStart: start, onTap: complete })
  const native = activation()
  f.interactions.activation(native)
  await flush()
  expect(start.mock.calls[0][0]).toBe(native)
  expect(complete.mock.calls[0][0]).toBe(native)
  f.rectangle.mockReturnValue({ x: Number.NaN, y: 0, width: 10, height: 10 })
  f.interactions.activation(activation())
  await flush(1032)
  expect(f.errors.mock.calls[0][0]).toEqual(
    expect.objectContaining({ message: "Native motion: invalid native activation rectangle" }),
  )
  expect(complete).toHaveBeenCalledTimes(1)
  f.dispose()
})

it("drops retired callback jobs and prevents a stale tap from succeeding on a replacement attachment", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn()
  const f = fixture({ onTapStart: start, onTap: complete, onTapCancel: cancel })
  f.interactions.start(touch(), "pointer")
  f.owner.attach({} as View)
  f.interactions.refresh()
  f.interactions.end(touch(), true)
  await flush()
  expect(start).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  f.interactions.start(touch(), "pointer")
  f.interactions.retire()
  await flush(1032)
  expect(start).not.toHaveBeenCalled()
  f.dispose()
})

it("uses current callbacks on cancellation and retains focus while own drag suppresses tap/hover", async () => {
  const old = jest.fn(),
    current = jest.fn()
  const f = fixture({ onTapCancel: old, whileFocus: { opacity: 0.1 }, whileHover: { opacity: 0.5 } })
  const down = touch()
  f.interactions.start(down, "pointer")
  f.owner.commitProps({
    ...f.settings,
    props: { whileFocus: { opacity: 0.1 }, whileDrag: { opacity: 0.3 }, onTapCancel: current },
  })
  await f.owner.animationState.setActive("whileDrag", true)
  f.interactions.refresh()
  f.interactions.focus(event({ isFocusVisible: true }) as unknown as TNativeFocusEvent)
  f.interactions.start(touch(), "pointer")
  f.interactions.hoverStart(hover())
  await flush()
  expect(current).toHaveBeenCalledWith(down, { point: { x: 20, y: 30 } })
  expect(old).not.toHaveBeenCalled()
  expect(f.owner.animationState.getState().whileFocus.isActive).toBe(true)
  expect(f.owner.animationState.getState().whileTap.isActive).toBe(false)
  expect(f.owner.animationState.getState().whileHover.isActive).toBe(false)
  f.dispose()
})

it("connects original responder events through real RN Pressability and preserves the held-empty editor/root", async () => {
  const ref = createRef<View>(),
    start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn(),
    grant = jest.fn(),
    release = jest.fn(),
    change = jest.fn()
  const content = (enabled: boolean) => (
    <NativeMotionConfig skipAnimations>
      <NativeMotionOwnerHost
        ref={ref}
        testID="root"
        onResponderGrant={grant}
        onResponderRelease={release}
        motion={{
          initial: { opacity: 1 },
          ...(enabled ? { whileTap: { opacity: 0.2 }, onTapStart: start, onTap: complete, onTapCancel: cancel } : {}),
        }}
      >
        <TextInput testID="editor" value="" onChangeText={change} />
      </NativeMotionOwnerHost>
    </NativeMotionConfig>
  )
  await render(content(false))
  const original = ref.current,
    editor = screen.getByTestId("editor")
  expect(screen.getByTestId("root").props.onStartShouldSetResponder(touch())).toBe(false)
  await screen.rerender(content(true))
  expect(ref.current).toBe(original)
  const down = touch(),
    up = touch(25, 35, 2)
  expect(screen.getByTestId("root").props.onStartShouldSetResponder(down)).toBe(true)
  await act(() => screen.getByTestId("root").props.onResponderGrant(down))
  await flush()
  expect(StyleSheet.flatten(screen.getByTestId("root").props.style).opacity).toBe(0.2)
  await act(() => screen.getByTestId("root").props.onResponderRelease(up))
  await flush(1032)
  expect(start.mock.calls[0][0]).toBe(down)
  expect(complete.mock.calls[0][0]).toBe(up)
  expect(grant).toHaveBeenCalledWith(down)
  expect(release).toHaveBeenCalledWith(up)
  expect(cancel).not.toHaveBeenCalled()
  await screen.rerender(content(false))
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByTestId("root").props.onStartShouldSetResponder(touch())).toBe(false)
  await screen.unmount()
})

it("preserves caller responder negotiation/default prevention and native termination cancellation", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn(),
    request = jest.fn(() => false)
  await render(
    <NativeMotionOwnerHost
      testID="root"
      onStartShouldSetResponder={request}
      motion={{ onTapStart: start, onTap: complete, onTapCancel: cancel }}
    />,
  )
  const root = () => screen.getByTestId("root")
  const down = touch()
  expect(root().props.onStartShouldSetResponder(down)).toBe(false)
  expect(request).toHaveBeenCalledWith(down)
  down.preventDefault()
  await act(() => root().props.onResponderGrant(down))
  await flush()
  expect(start).not.toHaveBeenCalled()
  const next = touch(),
    terminated = touch(90)
  await act(() => root().props.onResponderGrant(next))
  await act(() => root().props.onResponderTerminate(terminated))
  await flush(1032)
  expect(cancel).toHaveBeenCalledWith(terminated, { point: { x: 90, y: 30 } })
  expect(complete).not.toHaveBeenCalled()
  await screen.unmount()
})

it("cancels a modeled inactive scope but rejects cancellation callbacks after its epoch changes", async () => {
  let active = true,
    epoch = 1
  const listeners = new Set<() => void>()
  mockScope = {
    ownerId: "scope-model",
    acknowledgedSession: () => ({ windowId: "window-model", epoch }),
    isWindowActive: () => active,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } as unknown as TNativeKeyScope
  const start = jest.fn(),
    cancel = jest.fn(),
    complete = jest.fn()
  await render(
    <NativeMotionOwnerHost testID="root" motion={{ onTapStart: start, onTap: complete, onTapCancel: cancel }} />,
  )
  const down = touch()
  await act(() => screen.getByTestId("root").props.onResponderGrant(down))
  await act(() => {
    active = false
    ;[...listeners].forEach((listener) => listener())
  })
  await flush()
  expect(start).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalledWith(down, { point: { x: 20, y: 30 } })
  await act(() => {
    active = true
    ;[...listeners].forEach((listener) => listener())
  })
  await act(() => screen.getByTestId("root").props.onResponderGrant(touch()))
  await act(() => {
    epoch++
    ;[...listeners].forEach((listener) => listener())
  })
  await flush(1032)
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(complete).not.toHaveBeenCalled()
  await screen.unmount()
})

it("keeps static previews non-interactive without adding accessibility grouping or changing author focusability", async () => {
  const start = jest.fn()
  await render(
    <NativeMotionConfig isStatic>
      <NativeMotionOwnerHost testID="root" focusable={false} motion={{ onTapStart: start }}>
        <TextInput testID="editor" value="" />
      </NativeMotionOwnerHost>
    </NativeMotionConfig>,
  )
  const root = screen.getByTestId("root")
  expect(root.props.onStartShouldSetResponder(touch())).toBe(false)
  expect(root.props.nativePressable).toBe(false)
  expect(root.props.keyboardFocusable).toBe(false)
  expect(root.props.accessible).not.toBe(true)
  expect(root.props.capturedKeys).toEqual([])
  await act(() => root.props.onPointerEnter(hover()))
  await flush()
  expect(start).not.toHaveBeenCalled()
  await screen.unmount()
})

it("preserves authored keys and existing tabIndex precedence without claiming activation keys on a nonfocusable root", async () => {
  const content = (tabIndex?: -1 | 0) => (
    <NativeMotionOwnerHost
      testID="root"
      focusable={false}
      tabIndex={tabIndex}
      capturedKeys={["KeyQ"]}
      motion={{ onTap: jest.fn() }}
    />
  )
  await render(content())
  for (const tabIndex of [undefined, 0, -1] as const) {
    await screen.rerender(content(tabIndex))
    const root = screen.getByTestId("root")
    expect(root.props.nativePressable).toBe(true)
    expect(root.props.keyboardFocusable).toBe(tabIndex === 0)
    expect(root.props.capturedKeys).toEqual(
      tabIndex === 0 ? ["KeyQ", ...nativeKeyTokens("Enter"), ...nativeKeyTokens(" ")] : ["KeyQ"],
    )
    expect(root.props.onStartShouldSetResponder(touch())).toBe(true)
  }
  await screen.unmount()
})
