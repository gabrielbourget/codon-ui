import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, TextInput } from "react-native"
import type { GestureResponderEvent, View } from "react-native"

import type { TNativeKeyScope } from "../../input/keyScope"
import { NativeMotionConfig } from "../config"
import { NativeMotionPan } from "../interactions/NativeMotionPan"
import { NativePanSession } from "../interactions/NativePanSession"
import type { TNativeMotionPointerEvent } from "../interactions/types"
import { MotionGlobalConfig, frame, frameData, time } from "../kernel"
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
const pointer = (x = 0, y = 0, extra: Record<string, unknown> = {}) => {
  let prevented = false
  return {
    nativeEvent: {
      pageX: x,
      pageY: y,
      pointerId: 7,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      buttons: 1,
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      ...extra,
    },
    persist: jest.fn(),
    preventDefault: () => {
      prevented = true
    },
    isDefaultPrevented: () => prevented,
  } as unknown as TNativeMotionPointerEvent
}
const touch = (x = 0, y = 0, identifier: number | string = 7, identifiers: (number | string)[] = [identifier]) =>
  ({
    nativeEvent: {
      pageX: x,
      pageY: y,
      identifier,
      target: 17,
      touches: identifiers.map((identifier) => ({ identifier })),
      changedTouches: [{ identifier }],
    },
    persist: jest.fn(),
    isDefaultPrevented: () => false,
  }) as unknown as GestureResponderEvent
const fixture = (props: TNativeMotionOwnerProps, extra: Partial<TNativeMotionOwnerOptions> = {}) => {
  const settings: TNativeMotionOwnerOptions = {
    props,
    base: {},
    config: {},
    reduced: false,
    canAct: () => true,
    ...extra,
  }
  const owner = new NativeMotionOwner(settings)
  // Explicit source ref/eligibility model. This does not observe native pointer/window delivery.
  owner.attach({} as View)
  const errors = jest.fn(),
    pan = new NativeMotionPan(owner, errors)
  const dispose = () => {
    pan.retire()
    owner.detach()
  }
  return { owner, settings, errors, pan, dispose }
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

it("starts exactly at the pinned threshold, retains original events and schedules update before postRender end", async () => {
  const phases: string[] = [],
    session = jest.fn().mockImplementation(() => phases.push("session")),
    start = jest.fn().mockImplementation(() => phases.push("start")),
    move = jest.fn().mockImplementation(() => phases.push("move")),
    end = jest.fn().mockImplementation(() => phases.push("end"))
  const f = fixture({ onPanSessionStart: session, onPanStart: start, onPan: move, onPanEnd: end })
  const down = pointer(),
    small = pointer(2.9),
    threshold = pointer(3),
    up = pointer(7, 2)
  f.pan.start(down)
  f.pan.move(small)
  expect(session).not.toHaveBeenCalled()
  await flush()
  expect(session.mock.calls[0][0]).toBe(down)
  expect(start).not.toHaveBeenCalled()
  f.pan.move(threshold)
  await flush(1032)
  expect(start.mock.calls[0][0]).toBe(threshold)
  expect(start.mock.calls[0][1]).toEqual({
    point: { x: 3, y: 0 },
    delta: { x: 3, y: 0 },
    offset: { x: 3, y: 0 },
    velocity: { x: 0, y: 0 },
  })
  f.pan.finish(up)
  expect(end).not.toHaveBeenCalled()
  frame.render(() => phases.push("render"))
  await flush(1048)
  expect(end.mock.calls[0][0]).toBe(up)
  expect(phases).toEqual(["session", "start", "move", "render", "end"])
  expect(f.errors).not.toHaveBeenCalled()
  f.dispose()
})

it("coalesces native moves per frame and re-transforms the raw point while a parent transform changes", async () => {
  let scale = 1
  const move = jest.fn(),
    f = fixture(
      { onPan: move },
      { config: { transformPagePoint: (point) => ({ x: point.x * scale, y: point.y * scale }) } },
    )
  f.pan.start(pointer())
  f.pan.move(pointer(4))
  const latest = pointer(6)
  f.pan.move(latest)
  await flush()
  expect(move).toHaveBeenCalledTimes(1)
  expect(move.mock.calls[0][0]).toBe(latest)
  expect(move.mock.calls[0][1].point.x).toBe(6)
  scale = 2
  await flush(1032)
  expect(move).toHaveBeenCalledTimes(2)
  expect(move.mock.calls[1][1]).toMatchObject({
    point: { x: 12, y: 0 },
    delta: { x: 6, y: 0 },
    offset: { x: 12, y: 0 },
  })
  f.dispose()
})

it("keeps the source recent-history velocity and excludes a stale hold origin from a flick", async () => {
  const move = jest.fn(),
    f = fixture({ onPan: move })
  f.pan.start(pointer())
  f.pan.move(pointer(10))
  await flush(2000)
  f.pan.move(pointer(20))
  await flush(2010)
  f.pan.move(pointer(30))
  await flush(2020)
  expect(move.mock.calls[1][1].velocity.x).toBe(10)
  expect(move.mock.calls[2][1].velocity.x).toBe(1000)
  f.dispose()
})

it("uses the last transformed move point on native cancel and the original cancel event", async () => {
  const end = jest.fn(),
    f = fixture({ onPanEnd: end })
  f.pan.start(pointer())
  f.pan.move(pointer(8, 9))
  await flush()
  const cancelled = pointer(999, 999)
  f.pan.finish(cancelled, true)
  await flush(1032)
  expect(end.mock.calls[0][0]).toBe(cancelled)
  expect(end.mock.calls[0][1]).toMatchObject({ point: { x: 8, y: 9 }, offset: { x: 8, y: 9 } })
  f.dispose()
})

it("does not invent pan start/end for a click or sub-threshold movement", async () => {
  const start = jest.fn(),
    end = jest.fn(),
    session = jest.fn(),
    f = fixture({ onPanSessionStart: session, onPanStart: start, onPanEnd: end })
  f.pan.start(pointer())
  f.pan.finish(pointer())
  await flush()
  f.pan.start(pointer())
  f.pan.move(pointer(2))
  await flush(1032)
  f.pan.finish(pointer(2))
  await flush(1048)
  expect(session).toHaveBeenCalledTimes(2)
  expect(start).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  f.dispose()
})

it("filters secondary starts and foreign native pointer identities without retiring the active pointer", async () => {
  const move = jest.fn(),
    end = jest.fn(),
    f = fixture({ onPan: move, onPanEnd: end })
  f.pan.start(pointer(0, 0, { isPrimary: false }))
  f.pan.move(pointer(10))
  await flush()
  expect(move).not.toHaveBeenCalled()
  f.pan.start(pointer())
  f.pan.start(pointer(0, 0, { pointerType: "mouse", button: 2 }))
  f.pan.move(pointer(10, 0, { pointerId: 8 }))
  f.pan.finish(pointer(10, 0, { pointerId: 8 }))
  const accepted = pointer(20, 0, { ctrlKey: true })
  f.pan.move(accepted)
  await flush(1032)
  expect(move).toHaveBeenCalledTimes(1)
  expect(move.mock.calls[0][0]).toBe(accepted)
  expect(accepted.nativeEvent.ctrlKey).toBe(true)
  f.pan.finish(pointer(30))
  await flush(1048)
  expect(end).toHaveBeenCalledTimes(1)
  f.dispose()
})

it("updates live callbacks without replacing the active session and drops queued work after owner replacement", async () => {
  const old = jest.fn(),
    current = jest.fn(),
    end = jest.fn(),
    f = fixture({ onPan: old, onPanEnd: end })
  f.pan.start(pointer())
  f.pan.move(pointer(5))
  f.owner.commitProps({ ...f.settings, props: { onPan: current, onPanEnd: end } })
  f.pan.refresh()
  await flush()
  expect(old).not.toHaveBeenCalled()
  expect(current).toHaveBeenCalledTimes(1)
  f.pan.finish(pointer(10))
  f.owner.attach({} as View)
  f.pan.refresh()
  await flush(1032)
  expect(end).not.toHaveBeenCalled()
  f.dispose()
})

it("ends the frame session on prop removal, guard loss or teardown without synthesizing a native cancel", async () => {
  let active = true
  const move = jest.fn(),
    end = jest.fn(),
    f = fixture({ onPan: move, onPanEnd: end }, { canAct: () => active })
  f.pan.start(pointer())
  f.pan.move(pointer(10))
  active = false
  f.pan.refresh()
  await flush()
  expect(move).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  active = true
  f.pan.start(pointer())
  f.pan.move(pointer(20))
  f.owner.commitProps({ ...f.settings, props: {} })
  f.pan.refresh()
  await flush(1032)
  expect(move).not.toHaveBeenCalled()
  f.dispose()
})

it("rejects invalid actual coordinates and transformed points without a zero-point fallback", () => {
  const error = jest.fn()
  expect(() => new NativePanSession(pointer(Number.NaN), {}, { isCurrent: () => true, onError: error })).toThrow(
    /finite native page/,
  )
  expect(
    () =>
      new NativePanSession(
        pointer(),
        {},
        { isCurrent: () => true, onError: error, transformPagePoint: () => ({ x: Infinity, y: 0 }) },
      ),
  ).toThrow(/finite transformed/)
  const f = fixture({ onPan: jest.fn() })
  f.pan.start(pointer())
  f.pan.move(pointer(Number.NaN))
  expect(f.errors).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Native pan: finite native page coordinates required" }),
  )
  f.dispose()
})

it("connects the existing raw native pointer host while preserving child responder ownership, original callbacks/ref/editor", async () => {
  const ref = createRef<View>(),
    start = jest.fn(),
    move = jest.fn(),
    end = jest.fn(),
    down = jest.fn(),
    rawMove = jest.fn(),
    up = jest.fn(),
    request = jest.fn()
  await render(
    <NativeMotionOwnerHost
      ref={ref}
      testID="root"
      onPointerDown={down}
      onPointerMove={rawMove}
      onPointerUp={up}
      motion={{ onPanStart: start, onPan: move, onPanEnd: end }}
    >
      <TextInput testID="editor" value="" onChangeText={request} />
    </NativeMotionOwnerHost>,
  )
  const original = ref.current,
    editor = screen.getByTestId("editor"),
    root = () => screen.getByTestId("root")
  expect(root().props.onStartShouldSetResponder(pointer())).toBe(false)
  const first = pointer(),
    shifted = pointer(10),
    released = pointer(15)
  await act(() => root().props.onPointerDown(first))
  await act(() => root().props.onPointerMove(shifted))
  await flush()
  await act(() => root().props.onPointerUp(released))
  await flush(1032)
  expect(down).toHaveBeenCalledWith(first)
  expect(rawMove).toHaveBeenCalledWith(shifted)
  expect(up).toHaveBeenCalledWith(released)
  expect(start.mock.calls[0][0]).toBe(shifted)
  expect(end.mock.calls[0][0]).toBe(released)
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  await screen.unmount()
})

it("honors the actual config point function and native pointer cancellation on the unchanged root", async () => {
  const end = jest.fn(),
    move = jest.fn(),
    transform = jest.fn((point: { x: number; y: number }) => ({ x: point.x * 2, y: point.y * 3 }))
  await render(
    <NativeMotionConfig transformPagePoint={transform}>
      <NativeMotionOwnerHost testID="root" motion={{ onPan: move, onPanEnd: end }} />
    </NativeMotionConfig>,
  )
  const root = () => screen.getByTestId("root"),
    cancelled = pointer(100)
  await act(() => root().props.onPointerDown(pointer()))
  await act(() => root().props.onPointerMove(pointer(4, 5)))
  await flush()
  await act(() => root().props.onPointerCancel(cancelled))
  await flush(1032)
  expect(move.mock.calls[0][1].point).toEqual({ x: 8, y: 15 })
  expect(end.mock.calls[0][0]).toBe(cancelled)
  expect(end.mock.calls[0][1].point).toEqual({ x: 8, y: 15 })
  await screen.unmount()
})

it("retires native scope/epoch jobs and disables pan in static preview", async () => {
  const listeners = new Set<() => void>()
  let active = true,
    epoch = 1
  mockScope = {
    ownerId: "pan-scope-model",
    acknowledgedSession: () => ({ windowId: "pan-window-model", epoch }),
    isWindowActive: () => active,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } as unknown as TNativeKeyScope
  const session = jest.fn(),
    move = jest.fn(),
    end = jest.fn()
  await render(
    <NativeMotionOwnerHost testID="root" motion={{ onPanSessionStart: session, onPan: move, onPanEnd: end }} />,
  )
  await act(() => screen.getByTestId("root").props.onPointerDown(pointer()))
  await act(() => screen.getByTestId("root").props.onPointerMove(pointer(10)))
  await act(() => {
    active = false
    epoch++
    ;[...listeners].forEach((listener) => listener())
  })
  await flush()
  expect(session).not.toHaveBeenCalled()
  expect(move).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  await screen.unmount()
  active = true
  await render(
    <NativeMotionConfig isStatic>
      <NativeMotionOwnerHost testID="root" motion={{ onPan: move }} />
    </NativeMotionConfig>,
  )
  await act(() => screen.getByTestId("root").props.onPointerDown(pointer()))
  await act(() => screen.getByTestId("root").props.onPointerMove(pointer(10)))
  await flush(1032)
  expect(move).not.toHaveBeenCalled()
  await screen.unmount()
})

it("uses bubbling touch events under the default SDK flags without taking the editor responder or replacing events", async () => {
  const ref = createRef<View>(),
    start = jest.fn(),
    move = jest.fn(),
    end = jest.fn(),
    caller = jest.fn(),
    request = jest.fn()
  await render(
    <NativeMotionOwnerHost
      ref={ref}
      testID="root"
      onTouchStart={caller}
      motion={{ onPanStart: start, onPan: move, onPanEnd: end }}
    >
      <TextInput testID="editor" value="" onChangeText={request} />
    </NativeMotionOwnerHost>,
  )
  const root = () => screen.getByTestId("root"),
    original = ref.current,
    editor = screen.getByTestId("editor")
  const down = touch(),
    shifted = touch(10, 5),
    cancelled = touch(999, 999, 7, [])
  expect(root().props.onStartShouldSetResponder(down)).toBe(false)
  expect(root().props.onStartShouldSetResponderCapture).toBeUndefined()
  await act(() => root().props.onTouchStart(down))
  await act(() => root().props.onTouchMove(shifted))
  await flush()
  await act(() => root().props.onTouchCancel(cancelled))
  await flush(1032)
  expect(caller).toHaveBeenCalledWith(down)
  expect(start.mock.calls[0][0]).toBe(shifted)
  expect(end.mock.calls[0][0]).toBe(cancelled)
  expect(end.mock.calls[0][1].point).toEqual({ x: 10, y: 5 })
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  await screen.unmount()
})

it.each(["pointer", "touch"] as const)(
  "keeps one session when %s delivery precedes the other existing native event stream",
  async (first) => {
    const start = jest.fn(),
      move = jest.fn(),
      end = jest.fn()
    await render(<NativeMotionOwnerHost testID="root" motion={{ onPanStart: start, onPan: move, onPanEnd: end }} />)
    const root = () => screen.getByTestId("root")
    const startTouch = touch(),
      startPointer = pointer(),
      touchMove = touch(10),
      pointerMove = pointer(10),
      touchEnd = touch(20, 0, 7, []),
      pointerEnd = pointer(20)
    await act(() => {
      if (first === "touch") {
        root().props.onTouchStart(startTouch)
        root().props.onPointerDown(startPointer)
      } else {
        root().props.onPointerDown(startPointer)
        root().props.onTouchStart(startTouch)
      }
      root().props.onPointerMove(pointerMove)
      root().props.onTouchMove(touchMove)
    })
    await flush()
    await act(() => {
      root().props.onPointerUp(pointerEnd)
      root().props.onTouchEnd(touchEnd)
    })
    await flush(1032)
    expect(start).toHaveBeenCalledTimes(1)
    expect(move).toHaveBeenCalledTimes(1)
    expect(end).toHaveBeenCalledTimes(1)
    expect(start.mock.calls[0][0]).toBe(first === "touch" ? touchMove : pointerMove)
    expect(end.mock.calls[0][0]).toBe(first === "touch" ? touchEnd : pointerEnd)
    await screen.unmount()
  },
)

it("ignores an added touch identity and preserves the already admitted original touch", async () => {
  const move = jest.fn(),
    end = jest.fn(),
    f = fixture({ onPan: move, onPanEnd: end })
  f.pan.start(touch())
  f.pan.start(touch(5, 5, 8, [7, 8]))
  f.pan.move(touch(80, 80, 8, [7, 8]))
  f.pan.finish(touch(80, 80, 8, [7]))
  const own = touch(10)
  f.pan.move(own)
  await flush()
  expect(move).toHaveBeenCalledTimes(1)
  expect(move.mock.calls[0][0]).toBe(own)
  f.pan.finish(touch(20, 0, 7, []))
  await flush(1032)
  expect(end).toHaveBeenCalledTimes(1)
  f.dispose()
})

it("preserves declared string touch IDs and numeric runtime IDs as distinct original identities", async () => {
  const move = jest.fn(),
    f = fixture({ onPan: move })
  f.pan.start(touch(0, 0, "7"))
  f.pan.move(touch(80, 80, 7))
  const declared = touch(10, 0, "7")
  f.pan.move(declared)
  await flush()
  expect(move).toHaveBeenCalledTimes(1)
  expect(move.mock.calls[0][0]).toBe(declared)
  expect(declared.nativeEvent.identifier).toBe("7")
  f.dispose()
})
