import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, TextInput } from "react-native"
import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import type { TNativeKeyScope } from "../../input/keyScope"
import { decodeNativeMotionGeometry, readNativeMotionGeometry } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { dispatchNativeGestureWindow } from "../../input/nativeGestureObservation"
import type { TNativeInteractionEvent } from "../../input/types"
import { NativeMotionConfig } from "../config"
import { NativeDragControls } from "../interactions/NativeDragControls"
import { NativeMotionDrag } from "../interactions/NativeMotionDrag"
import { NativeMotionInteractions } from "../interactions/NativeMotionInteractions"
import type { TNativeMotionPointerEvent } from "../interactions/types"
import { MotionGlobalConfig, frameData, motionValue, time } from "../kernel"
import { readNativeMotionTargetGeometry } from "../measurement/targetGeometry"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerOptions, TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"

// Explicit native geometry/ref/event models; these cases establish source behavior, not installed delivery.
const mockObservers = new Map<unknown, Set<(record: TNativeMotionGeometryRecord | undefined) => void>>()
jest.mock("../../input/motionGeometry", () => ({
  ...jest.requireActual("../../input/motionGeometry"),
  readNativeMotionGeometry: jest.fn(),
  observeNativeMotionGeometry: (view: unknown, listener: (record: TNativeMotionGeometryRecord | undefined) => void) => {
    const listeners = mockObservers.get(view) ?? new Set()
    mockObservers.set(view, listeners)
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}))
jest.mock("../measurement/targetGeometry", () => ({ readNativeMotionTargetGeometry: jest.fn() }))
jest.mock("../../input/specs/CUIFocusViewNativeComponent", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
  Commands: { requestKeyboardFocus: jest.fn(), requestContainerFocus: jest.fn(), requestKeyboardBlur: jest.fn() },
}))
const record = (x = 10, width = 100): TNativeMotionGeometryRecord => {
  const snapshot = geometrySnapshot()
  snapshot.untransformed = { ...snapshot.untransformed, box: [x, 20, width, 50] }
  snapshot.model = { ...snapshot.model, box: [x, 20, width, 50] }
  snapshot.layout = [x, 20, width, 50]
  return { ...geometryPacket(), snapshot: decodeNativeMotionGeometry(JSON.stringify(snapshot)) }
}
const pointer = (x = 0, y = 0, extra: Record<string, unknown> = {}) =>
  ({
    nativeEvent: { pointerId: 1, pointerType: "touch", isPrimary: true, pageX: x, pageY: y, button: 0, ...extra },
    persist: jest.fn(),
    isDefaultPrevented: () => false,
  }) as unknown as TNativeMotionPointerEvent
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
const turn = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
const flush = async (timestamp = 1016) => {
  await act(async () => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
    await turn()
  })
}
const disposals = new Set<() => void>()
const fixture = (
  props: TNativeMotionOwnerProps,
  extra: Partial<TNativeMotionOwnerOptions> = {},
  scope: TNativeKeyScope | null = null,
) => {
  const options: TNativeMotionOwnerOptions = {
    props,
    base: {},
    config: {},
    reduced: false,
    canAct: () => true,
    ...extra,
  }
  const owner = new NativeMotionOwner(options)
  const target = { getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 50 }) } as unknown as View
  owner.attach(target)
  const errors = jest.fn(),
    drag = new NativeMotionDrag(owner, errors, () => scope)
  drag.refresh()
  const dispose = () => {
    drag.retire()
    owner.detach()
    disposals.delete(dispose)
  }
  disposals.add(dispose)
  return { owner, drag, errors, options, target, dispose }
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++frameId
    frames.set(id, callback)
    return id
  })
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.mocked(readNativeMotionGeometry).mockImplementation(async () => record())
  jest.mocked(readNativeMotionTargetGeometry).mockImplementation(async () => ({
    kind: "native-target-geometry",
    requestId: "model",
    ownerSnapshot: record().snapshot!,
    targetSnapshot: { ...record().snapshot!, model: { box: [0, 0, 300, 200], quad: [0, 0, 300, 0, 300, 200, 0, 200] } },
    sampleTarget: 72,
    nativeOwnerIdentity: "model",
    observedAt: 100,
    ownerId: "owner",
    bindingId: "binding",
    target: 71,
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    attachmentRevision: 1,
    nativeViewRevision: "initial",
  }))
})
afterEach(async () => {
  for (const dispose of [...disposals]) dispose()
  await flush(30000)
  frames.clear()
  mockObservers.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it("moves the owned x/y values with original events, threshold, callback phases and whileDrag priority", async () => {
  const start = jest.fn(),
    move = jest.fn(),
    end = jest.fn()
  const f = fixture({ drag: true, dragMomentum: false, onDragStart: start, onDrag: move, onDragEnd: end })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(2))
  await flush()
  expect(start).not.toHaveBeenCalled()
  const moved = pointer(8, 6)
  f.drag.move(moved)
  await flush(1032)
  expect(f.owner.getValue("x")!.get()).toBe(8)
  expect(f.owner.getValue("y")!.get()).toBe(6)
  expect(start.mock.calls[0][0]).toBe(moved)
  expect(move.mock.calls[0][0]).toBe(moved)
  expect(f.owner.animationState.getState().whileDrag.isActive).toBe(true)
  const up = pointer(10, 9)
  f.drag.finish(up)
  expect(end).not.toHaveBeenCalled()
  await flush(1048)
  expect(end.mock.calls[0][0]).toBe(up)
  expect(f.drag.isDragging).toBe(false)
  expect(f.errors).not.toHaveBeenCalled()
})
it.each([false, 0, { left: 0, right: 0.5 }])("honors numeric relative bounds and elastic %p", async (elastic) => {
  const f = fixture({ drag: "x", dragConstraints: { left: -10, right: 20 }, dragElastic: elastic })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(40, 80))
  await flush()
  expect(f.owner.getValue("x")!.get()).toBe(typeof elastic === "object" ? 30 : 20)
  expect(f.owner.getValue("y")!.get()).toBe(0)
})
it("locks direction only beyond ten units, preferring y, and skips the direction-discovery frame", async () => {
  const direction = jest.fn(),
    f = fixture({ drag: true, dragDirectionLock: true, onDirectionLock: direction })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(10, 10))
  await flush()
  expect(direction).not.toHaveBeenCalled()
  f.drag.move(pointer(20, 12))
  await flush(1032)
  expect(direction).toHaveBeenCalledWith("y")
  expect(f.owner.getValue("y")!.get()).toBe(0)
  f.drag.move(pointer(40, 30))
  await flush(1048)
  expect(f.owner.getValue("x")!.get()).toBe(0)
  expect(f.owner.getValue("y")!.get()).toBe(30)
})
it("does not acquire an occupied axis later in the same rejected gesture", async () => {
  const a = fixture({ drag: "x" }),
    b = fixture({ drag: "x" }),
    c = fixture({ drag: "y" })
  await turn()
  for (const f of [a, b, c]) {
    f.drag.start(pointer())
    await turn()
    f.drag.move(pointer(20, 20))
    await flush()
  }
  expect(a.drag.isDragging).toBe(true)
  expect(b.drag.isDragging).toBe(false)
  expect(c.drag.isDragging).toBe(true)
  a.drag.cancel()
  b.drag.move(pointer(50))
  await flush(1032)
  expect(b.drag.isDragging).toBe(false)
  b.drag.start(pointer())
  await turn()
  b.drag.move(pointer(30))
  await flush(1048)
  expect(b.drag.isDragging).toBe(true)
})
it("supports propagation and external axis MotionValues without replacing or destroying them", async () => {
  const value = motionValue(12),
    destroy = jest.spyOn(value, "destroy")
  const a = fixture({ drag: "x" }),
    b = fixture({ drag: "x", dragPropagation: true, _dragX: value })
  await turn()
  for (const f of [a, b]) {
    f.drag.start(pointer())
    await turn()
    f.drag.move(pointer(20))
    await flush()
  }
  expect(value.get()).toBe(32)
  expect(b.owner.getValue("x")).toBeUndefined()
  b.dispose()
  expect(destroy).not.toHaveBeenCalled()
})
it("converts percentage origins using the measured layout width", async () => {
  const f = fixture({ drag: "x", initial: { x: "25%" } })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(15))
  await flush()
  expect(f.owner.getValue("x")!.get()).toBe(40)
})
it("reads actual-ref constraints, permits callback overrides and never writes mounted measurement styles", async () => {
  const target = { getBoundingClientRect: () => ({ width: 300, height: 200 }) } as unknown as View
  const measured = jest.fn(() => ({ left: 0, right: 12 }))
  const f = fixture({
    drag: "x",
    dragConstraints: { current: target },
    onMeasureDragConstraints: measured,
    dragElastic: false,
  })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(40))
  await flush()
  expect(readNativeMotionTargetGeometry).toHaveBeenCalledWith(f.target, target, expect.any(Object))
  expect(measured).toHaveBeenCalledWith({ left: -10, right: 190, top: -20, bottom: 130 })
  expect(f.owner.getValue("x")!.get()).toBe(12)
  expect(f.errors).not.toHaveBeenCalled()
})
it("buffers the latest movement until native geometry resolves and discards it after stop", async () => {
  let resolve!: (value: TNativeMotionGeometryRecord) => void
  jest.mocked(readNativeMotionGeometry).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const f = fixture({ drag: true, onDragStart: jest.fn() })
  f.drag.start(pointer())
  f.drag.move(pointer(30))
  await flush()
  expect(f.drag.isDragging).toBe(false)
  resolve(record())
  await turn()
  await flush(1032)
  expect(f.owner.getValue("x")!.get()).toBe(30)
  f.drag.cancel()
  jest.mocked(readNativeMotionGeometry).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  f.owner.attach({} as View)
  f.drag.refresh()
  f.drag.start(pointer())
  f.drag.move(pointer(100))
  f.drag.stop()
  resolve(record())
  await turn()
  await flush(1048)
  expect(f.drag.isDragging).toBe(false)
})
it("snapToCursor uses the actual model center and retains the existing translation", async () => {
  const f = fixture({ drag: "x", initial: { x: 15 } })
  await turn()
  f.drag.start(pointer(100), { snapToCursor: true })
  await turn()
  expect(f.owner.getValue("x")!.get()).toBe(55)
})
it("runs real source-owned release inertia and emits transition completion once", async () => {
  const completed = jest.fn(),
    f = fixture({ drag: "x", onDragTransitionEnd: completed })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(10))
  await flush(1016)
  f.drag.move(pointer(30))
  await flush(1032)
  f.drag.finish(pointer(35))
  await flush(1048)
  await flush(1064)
  expect(f.owner.getValue("x")!.get() as number).toBeGreaterThan(30)
  for (let i = 0; i < 100; i++) await flush(1080 + i * 100)
  expect(completed).toHaveBeenCalledTimes(1)
  expect(f.errors).not.toHaveBeenCalled()
})
it("retains the pinned raw cursor point while configured transforms apply to measured boxes and pan offsets", async () => {
  const f = fixture(
    { drag: "x", initial: { x: 15 } },
    { config: { transformPagePoint: (point) => ({ x: point.x * 2, y: point.y * 2 }) } },
  )
  await turn()
  f.drag.start(pointer(100), { snapToCursor: true })
  await turn()
  expect(f.owner.getValue("x")!.get()).toBe(-5)
})
it("snap-to-origin can limit just one axis while the other retains its released position", async () => {
  const f = fixture({ drag: true, dragMomentum: false, dragSnapToOrigin: "x" })
  await turn()
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(30, 40))
  await flush()
  f.drag.finish(pointer(30, 40))
  for (let i = 0; i < 80; i++) await flush(1032 + i * 100)
  expect(f.owner.getValue("x")!.get()).toBeCloseTo(0)
  expect(f.owner.getValue("y")!.get()).toBe(40)
})
it("compensates an actual layout/scroll delta while preserving the current pointer offset", async () => {
  const f = fixture({ drag: "x" })
  await turn()
  mockObservers.get(f.target)?.forEach((listener) => listener(record()))
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(30))
  await flush()
  mockObservers.get(f.target)?.forEach((listener) => listener(record(20)))
  expect(f.owner.getValue("x")!.get()).toBe(20)
  f.drag.move(pointer(40))
  await flush(1032)
  expect(f.owner.getValue("x")!.get()).toBe(30)
})
it("retires controls, queued callbacks and owned inertia after owner replacement or scope loss", async () => {
  let live = true
  const controls = new NativeDragControls(),
    end = jest.fn(),
    f = fixture({ drag: true, dragControls: controls, onDragEnd: end }, { canAct: () => live })
  await turn()
  controls.start(pointer())
  await turn()
  f.drag.move(pointer(10))
  await flush()
  controls.stop()
  live = false
  f.drag.refresh()
  await flush(1032)
  expect(end).not.toHaveBeenCalled()
  expect(f.drag.isDragging).toBe(false)
  f.dispose()
  controls.start(pointer())
  expect(f.drag.isDragging).toBe(false)
})
it("delivers manual controls through existing bubbling events in the matching native window", async () => {
  const scope = {
    acknowledgedSession: () => ({ windowId: "window", epoch: 2 }),
    isWindowActive: () => true,
  } as TNativeKeyScope
  const f = fixture({ drag: "x" }, {}, scope)
  await turn()
  f.drag.start(pointer())
  await turn()
  const foreign = { ...scope, acknowledgedSession: () => ({ windowId: "other", epoch: 2 }) } as TNativeKeyScope
  dispatchNativeGestureWindow(foreign, pointer(90), "move")
  await flush()
  expect(f.owner.getValue("x")!.get()).toBe(0)
  dispatchNativeGestureWindow(scope, pointer(20), "move")
  await flush(1032)
  expect(f.owner.getValue("x")!.get()).toBe(20)
  dispatchNativeGestureWindow(scope, pointer(25), "cancel")
  expect(f.drag.isDragging).toBe(false)
})
it("leaves non-drag animations and axis bindings untouched", async () => {
  const f = fixture({ animate: { opacity: 1 } })
  await turn()
  f.drag.refresh()
  expect(f.owner.getValue("x")).toBeUndefined()
  expect(f.owner.getValue("y")).toBeUndefined()
  expect(readNativeMotionGeometry).not.toHaveBeenCalled()
})
it("keeps the original host/ref/empty editor and declines drag from a native TextInput node", async () => {
  const ref = createRef<View>(),
    changed = jest.fn(),
    start = jest.fn()
  await render(
    <NativeMotionOwnerHost ref={ref} testID="root" motion={{ drag: "x", onDragStart: start }}>
      <TextInput testID="editor" value="" onChangeText={changed} />
    </NativeMotionOwnerHost>,
  )
  const root = () => screen.getByTestId("root"),
    original = ref.current,
    editor = screen.getByTestId("editor")
  const down = pointer()
  Object.assign(down, { target: { nodeName: "RN:TextInput", parentElement: original } })
  await act(() => root().props.onPointerDown(down))
  await act(() => root().props.onPointerMove(pointer(30)))
  await flush()
  expect(start).not.toHaveBeenCalled()
  await act(() => root().props.onPointerDown(pointer()))
  await turn()
  await act(() => root().props.onPointerMove(pointer(20)))
  await flush(1032)
  expect(start).toHaveBeenCalledTimes(1)
  expect(ref.current).toBe(original)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(changed).not.toHaveBeenCalled()
  await screen.unmount()
})

it("preserves position progress when an actual constraint container resizes", async () => {
  let width = 300
  const target = { getBoundingClientRect: () => ({ width, height: 200 }) } as unknown as View
  const f = fixture({ drag: "x", dragConstraints: { current: target }, dragMomentum: false, dragElastic: false })
  await turn()
  mockObservers.get(f.target)?.forEach((listener) => listener(record()))
  f.drag.start(pointer())
  await turn()
  f.drag.move(pointer(90))
  await flush()
  f.drag.cancel()
  expect(f.owner.getValue("x")!.get()).toBe(90)
  width = 500
  const prior = jest.mocked(readNativeMotionTargetGeometry).getMockImplementation()!
  jest.mocked(readNativeMotionTargetGeometry).mockImplementation(async (...args) => {
    const data = await prior(...args)
    return {
      ...data,
      targetSnapshot: { ...data.targetSnapshot, model: { ...data.targetSnapshot.model, box: [0, 0, 500, 200] } },
    }
  })
  mockObservers.get(f.target)?.forEach((listener) => listener(record()))
  await turn()
  expect(f.owner.getValue("x")!.get()).toBe(190)
})
it("cancel skips release callbacks while stop uses the latest original event", async () => {
  const end = jest.fn(),
    controls = new NativeDragControls(),
    f = fixture({ drag: true, dragControls: controls, onDragEnd: end })
  await turn()
  controls.start(pointer())
  await turn()
  f.drag.move(pointer(20))
  await flush()
  controls.cancel()
  await flush(1032)
  expect(end).not.toHaveBeenCalled()
  controls.start(pointer())
  await turn()
  const last = pointer(40)
  f.drag.move(last)
  await flush(1048)
  controls.stop()
  await flush(1064)
  expect(end).toHaveBeenCalledTimes(1)
  expect(end.mock.calls[0][0]).toBe(last)
})
it("cancels an existing tap even when the drag lock is released before activation delivery", async () => {
  const tap = jest.fn(),
    cancel = jest.fn(),
    f = fixture({ drag: "x", onTap: tap, onTapCancel: cancel })
  const interaction = new NativeMotionInteractions(f.owner, f.owner.captureAnimationLease, f.errors)
  await turn()
  const down = pointer()
  interaction.start(down as unknown as TNativeInteractionEvent, "pointer")
  f.drag.start(down)
  await turn()
  f.drag.move(pointer(20))
  await flush()
  f.drag.stop()
  interaction.end(pointer(20) as unknown as TNativeInteractionEvent, true, "pointer")
  await flush(1032)
  expect(tap).not.toHaveBeenCalled()
  expect(cancel).toHaveBeenCalledTimes(1)
  interaction.retire()
})
it("rejects null ref constraints and exiting owners without creating a replacement rectangle", async () => {
  const f = fixture({ drag: "x", dragConstraints: { current: null } })
  await turn()
  expect(f.errors).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining("mounted native ref") }),
  )
  const exiting = fixture({ drag: true }, { presence: { isPresent: false } })
  await turn()
  exiting.drag.start(pointer())
  exiting.drag.move(pointer(30))
  await flush()
  expect(exiting.drag.isDragging).toBe(false)
})
it("manual-only listeners retain controls and static preview never starts drag", async () => {
  const controls = new NativeDragControls(),
    start = jest.fn()
  await render(
    <NativeMotionOwnerHost
      testID="root"
      motion={{ drag: "x", dragListener: false, dragControls: controls, onDragStart: start }}
    />,
  )
  await act(() => screen.getByTestId("root").props.onPointerDown(pointer()))
  await act(() => screen.getByTestId("root").props.onPointerMove(pointer(30)))
  await flush()
  expect(start).not.toHaveBeenCalled()
  await act(() => controls.start(pointer()))
  await turn()
  await act(() => screen.getByTestId("root").props.onPointerMove(pointer(20)))
  await flush(1032)
  expect(start).toHaveBeenCalledTimes(1)
  await screen.unmount()
  start.mockClear()
  await render(
    <NativeMotionConfig isStatic>
      <NativeMotionOwnerHost testID="static" motion={{ drag: true, dragControls: controls, onDragStart: start }} />
    </NativeMotionConfig>,
  )
  await act(() => controls.start(pointer()))
  await turn()
  await act(() => screen.getByTestId("static").props.onPointerMove(pointer(30)))
  await flush(1048)
  expect(start).not.toHaveBeenCalled()
  await screen.unmount()
})
