import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput } from "react-native"
import type { GestureResponderEvent, View } from "react-native"

import { nativeKeyTokens } from "../../input/keyScope"
import type { TNativeKeyScope } from "../../input/keyScope"
import { NativeKeyboardScope } from "../../input/NativeKeyboardScope"
import type { TNativeWindowPointerEvent } from "../../input/nativeWindowPointers"
import type { TNativeActivationEvent, TNativeFocusEvent, TNativeKeyboardEvent } from "../../input/types"
import { NativeMotionConfig } from "../config"
import { NativeMotionInteractions } from "../interactions/NativeMotionInteractions"
import type { TNativeMotionHoverEvent, TNativeMotionPanEvent } from "../interactions/types"
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
  jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(17)
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

// Window packets are explicit source models; no actual UIKit/Android dispatch is claimed.
const acknowledgePointers = async () => {
  const host = () => screen.getByTestId("window-scope")
  await act(() =>
    host().props.onNativeScopeStatus({
      nativeEvent: {
        ownerId: host().props.ownerId,
        windowId: "modeled-window",
        epoch: 1,
        policyRevision: host().props.policyRevision,
        ready: true,
        windowActive: true,
      },
    }),
  )
  await act(() =>
    host().props.onNativePointerStatus({
      nativeEvent: {
        ownerId: host().props.ownerId,
        windowId: "modeled-window",
        epoch: 1,
        revision: host().props.pointerRevision,
        ready: true,
        error: "",
      },
    }),
  )
}
let windowSequence = 0
const windowPacket = (phase: "start" | "end" | "cancel" | "activation", depth = 0) => {
  const host = screen.getByTestId("window-scope")
  return event({
    ownerId: host.props.ownerId,
    windowId: "modeled-window",
    epoch: 1,
    sequence: ++windowSequence,
    phase,
    pointerId: phase === "activation" ? -1 : 1,
    pointerType: phase === "activation" ? "virtual" : "touch",
    isPrimary: true,
    button: 0,
    buttons: phase === "start" ? 1 : 0,
    nativeButtons: "0",
    nativeModifiers: "0",
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    pageX: 20,
    pageY: 30,
    timestamp: windowSequence,
    target: 17,
    registrations: host.props.pointerRegistrations.map((entry: { id: string; targetTag: number }) => ({
      ...entry,
      ownerId: host.props.ownerId,
      epoch: 1,
      revision: host.props.pointerRevision,
      depth,
    })),
  }) as unknown as TNativeWindowPointerEvent
}
const deliverWindow = async (packet: TNativeWindowPointerEvent) => {
  await act(() => screen.getByTestId("window-scope").props.onNativeWindowPointer(packet))
}
it("connects original window packets while preserving the held-empty editor, root and caller responder behavior", async () => {
  const ref = createRef<View>(),
    start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn(),
    grant = jest.fn(),
    release = jest.fn(),
    change = jest.fn()
  const content = (enabled: boolean) => (
    <NativeKeyboardScope testID="window-scope" captureEnabled>
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
    </NativeKeyboardScope>
  )
  await render(content(false))
  const original = ref.current,
    editor = screen.getByTestId("editor")
  expect(screen.getByTestId("root").props.onStartShouldSetResponder).toBeUndefined()
  await screen.rerender(content(true))
  await acknowledgePointers()
  expect(ref.current).toBe(original)
  const down = windowPacket("start"),
    up = windowPacket("end")
  await deliverWindow(down)
  await flush()
  expect(StyleSheet.flatten(screen.getByTestId("root").props.style).opacity).toBe(0.2)
  await deliverWindow(up)
  await flush(1032)
  expect(start.mock.calls[0][0]).toBe(down)
  expect(complete.mock.calls[0][0]).toBe(up)
  expect(grant).not.toHaveBeenCalled()
  expect(release).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  await screen.rerender(content(false))
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(change).not.toHaveBeenCalled()
  expect(screen.getByTestId("window-scope").props.pointerRegistrations).toHaveLength(1)
  await screen.unmount()
})
it("preserves caller responder negotiation and handles actual window cancellation independently", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    cancel = jest.fn(),
    request = jest.fn(() => false),
    grant = jest.fn()
  await render(
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost
        testID="root"
        onStartShouldSetResponder={request}
        onResponderGrant={grant}
        motion={{ onTapStart: start, onTap: complete, onTapCancel: cancel }}
      />
    </NativeKeyboardScope>,
  )
  await acknowledgePointers()
  const root = screen.getByTestId("root"),
    responder = touch()
  expect(root.props.onStartShouldSetResponder(responder)).toBe(false)
  expect(request).toHaveBeenCalledWith(responder)
  await act(() => root.props.onResponderGrant(responder))
  expect(grant).toHaveBeenCalledWith(responder)
  await flush()
  expect(start).not.toHaveBeenCalled()
  const down = windowPacket("start"),
    cancelled = windowPacket("cancel")
  await deliverWindow(down)
  await deliverWindow(cancelled)
  await flush(1032)
  expect(start).toHaveBeenCalledWith(down, { point: { x: 20, y: 30 } })
  expect(cancel).toHaveBeenCalledWith(cancelled, { point: { x: 20, y: 30 } })
  expect(complete).not.toHaveBeenCalled()
  await screen.unmount()
})
it("keeps original Android click delivery separate from physical tap and genuine virtual activation", async () => {
  const tap = jest.fn(),
    nativeClick = jest.fn()
  await render(
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost testID="root" onNativeActivation={nativeClick} motion={{ onTap: tap }} />
    </NativeKeyboardScope>,
  )
  await acknowledgePointers()
  await deliverWindow(windowPacket("start"))
  await deliverWindow(windowPacket("end"))
  await flush()
  expect(tap).toHaveBeenCalledTimes(1)
  const root = screen.getByTestId("root")
  const physical = event({
    kind: "activation",
    ownerId: root.props.ownerId,
    target: 17,
    source: "android-click",
    observedAt: 10,
    activationId: 1,
    scopeOwnerId: "",
    windowId: "modeled-window",
    epoch: 1,
  })
  await act(() => root.props.onNativeActivation(physical))
  await flush(1032)
  expect(nativeClick).toHaveBeenCalledWith(physical)
  expect(tap).toHaveBeenCalledTimes(1)
  const virtual = windowPacket("activation")
  await deliverWindow(virtual)
  await flush(1048)
  expect(tap).toHaveBeenCalledTimes(2)
  expect(tap.mock.calls[1][0]).toBe(virtual)
  await screen.unmount()
})
it("captures tap targeting/propagation at feature mount while reading current callbacks", async () => {
  const before = jest.fn(),
    after = jest.fn()
  const content = (changed: boolean) => (
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost
        testID="root"
        motion={{ globalTapTarget: !changed, propagate: { tap: changed }, onTapStart: changed ? after : before }}
      />
    </NativeKeyboardScope>
  )
  await render(content(false))
  await acknowledgePointers()
  const initial = screen.getByTestId("window-scope").props.pointerRegistrations
  await screen.rerender(content(true))
  expect(screen.getByTestId("window-scope").props.pointerRegistrations).toEqual(initial)
  const outside = windowPacket("start", -1)
  await deliverWindow(outside)
  await flush()
  expect(before).not.toHaveBeenCalled()
  expect(after).toHaveBeenCalledWith(outside, { point: { x: 20, y: 30 } })
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
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost testID="root" motion={{ onTapStart: start, onTap: complete, onTapCancel: cancel }} />
    </NativeKeyboardScope>,
  )
  await acknowledgePointers()
  const down = windowPacket("start")
  await deliverWindow(down)
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
  await deliverWindow(windowPacket("start"))
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
  expect(root.props.onStartShouldSetResponder).toBeUndefined()
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
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost
        testID="root"
        focusable={false}
        tabIndex={tabIndex}
        capturedKeys={["KeyQ"]}
        motion={{ onTap: jest.fn() }}
      />
    </NativeKeyboardScope>
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
    expect(root.props.onStartShouldSetResponder).toBeUndefined()
  }
  await screen.unmount()
})

it("retains tap registration/options through absent props, including an in-flight original press", async () => {
  const first = jest.fn(),
    current = jest.fn(),
    cancelled = jest.fn(),
    ref = createRef<View>()
  const content = (phase: number) => (
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionOwnerHost
        ref={ref}
        testID="root"
        motion={{
          globalTapTarget: phase === 0,
          propagate: { tap: phase > 0 },
          ...(phase === 0
            ? { onTapStart: first, onTapCancel: cancelled }
            : phase === 2
              ? { onTap: current, onTapCancel: cancelled }
              : {}),
        }}
      >
        <TextInput testID="lifetime-editor" value="" />
      </NativeMotionOwnerHost>
    </NativeKeyboardScope>
  )
  await render(content(0))
  await acknowledgePointers()
  const original = ref.current,
    editor = screen.getByTestId("lifetime-editor"),
    registrations = screen.getByTestId("window-scope").props.pointerRegistrations
  const down = windowPacket("start", -1),
    up = windowPacket("end", -1)
  await deliverWindow(down)
  await flush()
  await screen.rerender(content(1))
  expect(screen.getByTestId("window-scope").props.pointerRegistrations).toEqual(registrations)
  expect(screen.getByTestId("root").props.keyboardFocusable).toBe(false)
  await screen.rerender(content(2))
  await deliverWindow(up)
  await flush(1032)
  expect(current).toHaveBeenCalledWith(up, { point: { x: 20, y: 30 } })
  expect(cancelled).not.toHaveBeenCalled()
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("lifetime-editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  await screen.unmount()
})
it("retains hover enter/end lifetime through absent callbacks", async () => {
  const before = jest.fn(),
    after = jest.fn()
  const content = (phase: number) => (
    <NativeMotionOwnerHost
      testID="root"
      motion={phase === 0 ? { onHoverStart: before } : phase === 2 ? { onHoverEnd: after } : {}}
    />
  )
  await render(content(0))
  await screen.rerender(content(1))
  await act(() => screen.getByTestId("root").props.onPointerEnter(hover()))
  await screen.rerender(content(2))
  const leave = hover("mouse", 50)
  await act(() => screen.getByTestId("root").props.onPointerLeave(leave))
  await flush()
  expect(before).not.toHaveBeenCalled()
  expect(after).toHaveBeenCalledWith(leave, { point: { x: 50, y: 30 } })
  await screen.unmount()
})
it("retains a mounted pan session started without callbacks for later current handlers", async () => {
  const before = jest.fn(),
    after = jest.fn()
  const content = (phase: number) => (
    <NativeMotionOwnerHost
      testID="root"
      motion={phase === 0 ? { onPan: before } : phase === 2 ? { onPan: after } : {}}
    />
  )
  const pointer = (x: number) =>
    event({
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      pageX: x,
      pageY: 30,
      timestamp: x,
    }) as unknown as TNativeMotionPanEvent
  await render(content(0))
  await screen.rerender(content(1))
  await act(() => screen.getByTestId("root").props.onPointerDown(pointer(20)))
  await act(() => screen.getByTestId("root").props.onPointerMove(pointer(40)))
  await flush()
  await screen.rerender(content(2))
  const moved = pointer(60)
  await act(() => screen.getByTestId("root").props.onPointerMove(moved))
  await flush(1032)
  expect(before).not.toHaveBeenCalled()
  expect(after).toHaveBeenCalledWith(
    moved,
    expect.objectContaining({ point: { x: 60, y: 30 }, offset: { x: 40, y: 0 } }),
  )
  await screen.unmount()
})
it("retains source static-preview focus defaults without installing a tap observer", async () => {
  await render(
    <NativeKeyboardScope testID="window-scope" captureEnabled>
      <NativeMotionConfig isStatic>
        <NativeMotionOwnerHost testID="root" motion={{ onTap: jest.fn() }} />
      </NativeMotionConfig>
    </NativeKeyboardScope>,
  )
  expect(screen.getByTestId("root").props.keyboardFocusable).toBe(true)
  expect(screen.getByTestId("root").props.nativePressable).toBe(false)
  expect(screen.getByTestId("root").props.capturedKeys).toEqual([])
  expect(screen.getByTestId("window-scope").props.pointerRegistrations).toEqual([])
  await screen.unmount()
})

it("keeps the mounted focus feature active through absent whileFocus props until an actual blur", async () => {
  const f = fixture({ whileFocus: { opacity: 0.5 } })
  f.owner.configure({ ...f.settings, props: {} })
  f.interactions.focus(event({ isFocusVisible: true }) as unknown as TNativeFocusEvent)
  f.interactions.refresh()
  expect(f.owner.animationState.getState().whileFocus.isActive).toBe(true)
  f.interactions.blur()
  expect(f.owner.animationState.getState().whileFocus.isActive).toBe(false)
  f.dispose()
})
