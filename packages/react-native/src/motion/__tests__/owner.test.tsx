import { act, render, screen } from "@testing-library/react-native"
import { createRef } from "react"
import { AccessibilityInfo, StyleSheet, TextInput, TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import type { TNativeKeyScope } from "../../input/keyScope"
import { nativeAnimationControls } from "../animation"
import { NativeMotionConfig } from "../config"
import { JSAnimation, MotionGlobalConfig, frameData, motionValue, time } from "../kernel"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerOptions } from "../owner/NativeMotionOwner"
import { NativeMotionOwnerHost } from "../owner/NativeMotionOwnerHost"
import type { NativeValueAnimation } from "../value/NativeValueAnimation"
import { NativeMotionVisualState } from "../visual/state"

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
let sequence = 0
const flush = async (timestamp = 1016) => {
  await act(() => {
    frameData.timestamp = timestamp
    time.set(timestamp)
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(timestamp))
  })
}
it("binds native viewport records to source animation without replacing the original held-empty editor", async () => {
  // Preset refs, native receipt/query responses and the window are explicit
  // models; actual React/source animation and ref composition execute.
  const root = createRef<View>(),
    editor = createRef<TextInput>(),
    change = jest.fn(),
    enter = jest.fn()
  jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(71)
  const backend = jest.fn((encoded: string) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({
      ...request,
      kind: "native-viewport",
      surfaceId: 1,
      fabricRevision: "2",
      time: 1000,
      isIntersecting: true,
      intersectionRatio: 1,
      rootBounds: [0, 0, 300, 200],
      boundingClientRect: [10, 20, 100, 50],
      intersectionRect: [10, 20, 100, 50],
    })
  })
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getViewportSnapshot: backend } as never)
  await render(
    <NativeMotionOwnerHost
      ref={root}
      testID="viewport-owner"
      style={{ opacity: 1 }}
      motion={{ whileInView: { opacity: 0.3 }, transition: { duration: 0.1, ease: "linear" }, onViewportEnter: enter }}
    >
      <TextInput ref={editor} testID="viewport-editor" value="" onChangeText={change} />
    </NativeMotionOwnerHost>,
  )
  const originalRoot = root.current,
    originalEditor = editor.current
  Object.assign(originalRoot!, { isConnected: true, ownerDocument: {} })
  const props = screen.getByTestId("viewport-owner").props
  await act(() =>
    props.onNativeMotionGeometry({
      nativeEvent: geometryPacket({
        ownerId: props.ownerId,
        bindingId: props.nativeMotionGeometryBinding,
        commitRevision: props.nativeMotionGeometryRevision ?? "",
        scopeOwnerId: "",
        epoch: 0,
        kind: "frame",
      }),
    }),
  )
  await flush(1000)
  await flush(1016)
  await flush(1150)
  await flush(1166)
  expect(enter).toHaveBeenCalledTimes(1)
  expect(enter.mock.calls[0][0].target).toBe(originalRoot)
  expect(root.current).toBe(originalRoot)
  expect(editor.current).toBe(originalEditor)
  expect(screen.getByTestId("viewport-editor").props.value).toBe("")
  expect(change).not.toHaveBeenCalled()
  expect(StyleSheet.flatten(screen.getByTestId("viewport-owner").props.style).opacity).toBeCloseTo(0.3)
  await screen.unmount()
})
beforeEach(() => {
  mockScope = null
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(false)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++sequence
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
// Explicit ref/order models exercise owner code only; no native document/window is observed.
const modeledRef = (position = 4) => ({ compareDocumentPosition: jest.fn(() => position) }) as unknown as View
const options = (overrides: Partial<TNativeMotionOwnerOptions> = {}): TNativeMotionOwnerOptions => ({
  props: {},
  base: {},
  config: {},
  reduced: false,
  canAct: () => true,
  ...overrides,
})

it("applies ordered initial labels/custom zero and initial=false endpoints without mutating caller values", () => {
  const definition = jest.fn((custom: unknown) => ({ x: typeof custom === "number" ? custom : 0, opacity: [1, 0] }))
  const owner = new NativeMotionOwner(
    options({ props: { initial: ["first", "second"], custom: 0, variants: { first: { x: 10 }, second: definition } } }),
  )
  expect(definition).toHaveBeenCalledWith(0, {}, {})
  expect(owner.getValue("x")?.get()).toBe(0)
  expect(owner.getValue("opacity")?.get()).toBe(1)
  const blocked = new NativeMotionOwner(
    options({ props: { initial: false, animate: { x: [0, 100], transitionEnd: { opacity: 0 } } } }),
  )
  expect(blocked.getValue("x")?.get()).toBe(100)
  expect(blocked.getValue("opacity")?.get()).toBe(0)
})

it("connects real source controls/value driver/configuration to the original native host and empty editor", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  const ref = createRef<View>(),
    start = jest.fn(),
    complete = jest.fn(),
    request = jest.fn()
  const motion = {
    initial: { x: 0, opacity: 1 },
    animate: controls,
    onAnimationStart: start,
    onAnimationComplete: complete,
  }
  await render(
    <NativeMotionConfig transition={{ duration: 0.1, ease: "linear" }}>
      <NativeMotionOwnerHost ref={ref} testID="owner" motion={motion}>
        <TextInput testID="editor" value="" onChangeText={request} />
      </NativeMotionOwnerHost>
    </NativeMotionConfig>,
  )
  const actual = ref.current,
    editor = screen.getByTestId("editor")
  const definition = { x: 100, opacity: 0 }
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start(definition)
  })
  expect(start).toHaveBeenCalledWith(definition, undefined, undefined)
  expect(start.mock.calls[0][0]).toBe(definition)
  await flush(1050)
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style)).toMatchObject({
    opacity: 0.5,
    transform: [{ translateX: 50 }],
  })
  await flush(1100)
  await pending
  expect(complete).toHaveBeenCalledWith(definition, undefined, undefined)
  expect(complete.mock.calls[0][0]).toBe(definition)
  expect(ref.current).toBe(actual)
  expect(screen.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(request).not.toHaveBeenCalled()
  await screen.unmount()
  stop()
})

it("uses scoped skip without changing global animation flags", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  await render(
    <NativeMotionConfig skipAnimations>
      <NativeMotionOwnerHost testID="owner" motion={{ initial: { x: 0 }, animate: controls }} />
    </NativeMotionConfig>,
  )
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, transition: { duration: 20 } })
  })
  await flush()
  await pending
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style).transform).toEqual([{ translateX: 100 }])
  expect(MotionGlobalConfig.skipAnimations).not.toBe(true)
  await screen.unmount()
  stop()
})

it("reduces positional motion while preserving configured opacity timing", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  await render(
    <NativeMotionConfig reducedMotion="always" transition={{ duration: 0.1, ease: "linear" }}>
      <NativeMotionOwnerHost testID="owner" motion={{ initial: { x: 0, opacity: 1 }, animate: controls }} />
    </NativeMotionConfig>,
  )
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, opacity: 0 })
  })
  await flush(1050)
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style)).toMatchObject({
    opacity: 0.5,
    transform: [{ translateX: 100 }],
  })
  await flush(1100)
  await pending
  await screen.unmount()
  stop()
})

it("keeps an ongoing owner lease through a caller ref/callback handoff", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  const first = jest.fn(),
    next = jest.fn(),
    firstComplete = jest.fn(),
    currentComplete = jest.fn()
  const initial = { x: 0 }
  await render(
    <NativeMotionOwnerHost
      ref={first}
      testID="owner"
      motion={{ initial, animate: controls, onAnimationComplete: firstComplete }}
    />,
  )
  const actual = first.mock.calls[0][0]
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, transition: { duration: 0.1, ease: "linear" } })
  })
  await flush(1050)
  await screen.rerender(
    <NativeMotionOwnerHost
      ref={next}
      testID="owner"
      motion={{ initial, animate: controls, onAnimationComplete: currentComplete }}
    />,
  )
  expect(next).toHaveBeenCalledWith(actual)
  await flush(1100)
  await pending
  expect(firstComplete).not.toHaveBeenCalled()
  expect(currentComplete).toHaveBeenCalledTimes(1)
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style).transform).toEqual([{ translateX: 100 }])
  await screen.unmount()
  stop()
})

it("retires unresolved owned bindings and can resolve fresh geometry on a new attachment", async () => {
  let initial = 20
  const geometry = jest
    .fn()
    .mockImplementationOnce(() => new Promise(() => {}))
    .mockImplementationOnce((_name: string, frames: readonly unknown[]) =>
      Promise.resolve({ keyframes: [frames[0], 100], finalKeyframe: "auto" }),
    )
  const settings = options({ readValue: () => initial, resolveGeometry: geometry })
  const owner = new NativeMotionOwner(settings),
    controls = nativeAnimationControls(),
    stop = controls.mount()
  owner.attach(modeledRef())
  const unsubscribe = controls.subscribe(owner)
  void controls.start({ width: "auto" })
  expect(owner.getBindings()).not.toHaveProperty("width")
  owner.detach()
  expect(owner.getValue("width")).toBeUndefined()
  initial = 64
  owner.attach(modeledRef())
  const pending = controls.start({ width: "auto", transition: { duration: 0.1, ease: "linear" } })
  await (owner.getValue("width")!.animation as NativeValueAnimation).ready
  expect(owner.getBaseTarget("width")).toBe(64)
  expect(owner.getBindings()).toHaveProperty("width")
  await flush(1100)
  await pending
  owner.detach()
  unsubscribe()
  stop()
})

it("retires old attachment cleanup after scope invalidation and preserves a replacement attachment", () => {
  const owner = new NativeMotionOwner(options()),
    first = modeledRef(),
    next = modeledRef()
  const retire = owner.attach(first)
  const old = owner.captureAnimationLease()
  owner.invalidate()
  expect(old()).toBe(false)
  retire()
  expect(owner.current).toBeNull()
  owner.attach(first)
  const stale = owner.attach(next)
  retire()
  expect(owner.current).toBe(next)
  stale()
  expect(owner.current).toBeNull()
})

it("does not destroy, rewind or stop a caller-owned animation that has another subscriber", async () => {
  const value = motionValue<unknown>(3),
    destroyed = jest.spyOn(value, "destroy")
  const external = value.on("change", () => {})
  const owner = new NativeMotionOwner(options({ values: { x: value } }))
  owner.attach(modeledRef())
  void value.start(
    (complete) =>
      new JSAnimation<unknown>({
        keyframes: [3, 10],
        duration: 100,
        motionValue: value,
        onUpdate: (next) => value.set(next),
        onComplete: complete,
      }),
  )
  owner.detach()
  await flush(1050)
  expect(value.isAnimating()).toBe(true)
  owner.attach(modeledRef())
  expect(value.get()).not.toBe(0)
  owner.detach()
  external()
  value.stop()
  expect(destroyed).not.toHaveBeenCalled()
  value.destroy()
})

it("honors an explicit initial request and replays it only on a real attachment replacement", () => {
  const value = motionValue<unknown>(3)
  const owner = new NativeMotionOwner(options({ values: { x: value }, props: { initial: { x: 0 } } }))
  expect(value.get()).toBe(0)
  owner.attach(modeledRef())
  value.set(7)
  owner.detach()
  owner.attach(modeledRef())
  expect(value.get()).toBe(0)
  expect(owner.latestValues.x).toBe(0)
  owner.detach()
  value.destroy()
})

it("does not seed non-variant children from a parent's blocked initial state", () => {
  const parent = new NativeMotionOwner(options({ props: { initial: false, animate: { opacity: 1 } } }))
  const child = new NativeMotionOwner(options({ props: { animate: { x: 100 } } }), parent)
  expect(child.getValue("x")).toBeUndefined()
})

it("uses native-ref order and rejects missing/disconnected document comparisons", () => {
  const first = new NativeMotionOwner(options()),
    second = new NativeMotionOwner(options())
  const ref = modeledRef(4)
  first.attach(ref)
  second.attach(modeledRef())
  expect(first.sortNodePosition(second)).toBe(-1)
  expect(ref.compareDocumentPosition).toHaveBeenCalledWith(second.current)
  first.detach()
  first.attach(modeledRef(2))
  expect(first.sortNodePosition(second)).toBe(1)
  first.detach()
  first.attach(modeledRef(1))
  expect(() => first.sortNodePosition(second)).toThrow(/disconnected/)
  first.detach()
  first.attach({} as View)
  expect(() => first.sortNodePosition(second)).toThrow(/ordering unavailable/)
  first.detach()
  second.detach()
})

it("registers through the nearest variant node and retires its entering membership", () => {
  const parent = new NativeMotionOwner(options({ props: { variants: { visible: { opacity: 1 } } } }))
  parent.attach(modeledRef())
  const middle = new NativeMotionOwner(options(), parent)
  middle.attach(modeledRef())
  const child = new NativeMotionOwner(options({ props: { variants: { visible: { opacity: 1 } } } }), middle)
  child.attach(modeledRef())
  expect(parent.variantChildren?.has(child)).toBe(true)
  expect(middle.enteringChildren?.has(child)).toBe(true)
  child.detach()
  expect(parent.variantChildren?.has(child)).toBe(false)
  expect(middle.enteringChildren?.has(child)).toBe(false)
  middle.detach()
  parent.detach()
})

it("rejects absent native initial reads instead of guessing a starting value", async () => {
  const owner = new NativeMotionOwner(options()),
    controls = nativeAnimationControls(),
    stop = controls.mount()
  owner.attach(modeledRef())
  const unsubscribe = controls.subscribe(owner)
  await expect(controls.start({ height: 100 })).rejects.toThrow(/actual native initial-value reader unavailable/)
  expect(owner.getBindings()).not.toHaveProperty("height")
  owner.detach()
  unsubscribe()
  stop()
})

it("does not publish hydrated initial geometry while resolution is pending or fails", async () => {
  let reject!: (reason: Error) => void
  const geometry = jest.fn(
    () =>
      new Promise<never>((_resolve, fail) => {
        reject = fail
      }),
  )
  const owner = new NativeMotionOwner(options({ readValue: () => 20, resolveGeometry: geometry }))
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  owner.attach(modeledRef())
  const unsubscribe = controls.subscribe(owner)
  const pending = controls.start({ width: "auto" })
  expect(geometry).toHaveBeenCalled()
  expect(owner.getValue("width")?.get()).toBe(20)
  expect(owner.getBindings()).not.toHaveProperty("width")
  reject(new Error("native unavailable"))
  await expect(pending).rejects.toThrow("native unavailable")
  expect(owner.getBindings()).not.toHaveProperty("width")
  owner.detach()
  unsubscribe()
  stop()
})

it("drops stale visual jobs and accepts fresh work after a lease replacement", async () => {
  const value = motionValue(0),
    update = jest.fn()
  let generation = 1
  const state = new NativeMotionVisualState({ opacity: value }, update, () => {
    const captured = generation
    return () => captured === generation
  })
  state.attach()
  value.set(0.2)
  generation++
  await flush()
  expect(state.getSnapshot().opacity).toBe(0)
  expect(update).not.toHaveBeenCalled()
  value.set(0.4)
  await flush(1032)
  expect(state.getSnapshot().opacity).toBe(0.4)
  expect(update).toHaveBeenCalledTimes(1)
  value.set(0.6)
  generation++
  value.set(0.8)
  await flush(1048)
  expect(state.getSnapshot().opacity).toBe(0.8)
  state.detach()
  value.destroy()
})

it("awaits first source window acknowledgment and keeps later key-policy metadata out of animation leases", async () => {
  let session = { windowId: "", epoch: 0 },
    active: boolean | null = null
  const listeners = new Set<() => void>()
  mockScope = {
    ownerId: "scope-model",
    acknowledgedSession: () => session,
    isWindowActive: () => active,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  } as unknown as TNativeKeyScope
  const controls = nativeAnimationControls(),
    stop = controls.mount(),
    start = jest.fn()
  await render(
    <NativeMotionOwnerHost testID="owner" motion={{ initial: { x: 0 }, animate: controls, onAnimationStart: start }} />,
  )
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, transition: { duration: 0.1, ease: "linear" } })
  })
  expect(start).not.toHaveBeenCalled()
  await act(() => {
    session = { windowId: "modeled-window", epoch: 2 }
    active = true
    ;[...listeners].forEach((listener) => listener())
  })
  expect(start).toHaveBeenCalledTimes(1)
  await flush(1050)
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style).transform).toEqual([{ translateX: 50 }])
  await act(() => {
    ;[...listeners].forEach((listener) => listener())
  })
  await flush(1100)
  await pending
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style).transform).toEqual([{ translateX: 100 }])
  expect(start).toHaveBeenCalledTimes(1)
  await screen.unmount()
  stop()
})

it("retires a waiting request without letting it animate a replacement ref", async () => {
  let active = false
  const settings = options({ canAct: () => active, waitForInitialWindow: () => true, props: { initial: { x: 0 } } })
  const owner = new NativeMotionOwner(settings),
    controls = nativeAnimationControls(),
    stop = controls.mount()
  owner.attach(modeledRef())
  const unsubscribe = controls.subscribe(owner)
  const pending = controls.start({ x: 100 })
  active = true
  owner.attach(modeledRef())
  owner.configure(settings)
  await pending
  expect(owner.getValue("x")?.get()).toBe(0)
  expect(owner.getValue("x")?.isAnimating()).toBe(false)
  owner.detach()
  unsubscribe()
  stop()
})

it("retains the fixed initial-window readiness deadline", async () => {
  jest.useFakeTimers()
  const owner = new NativeMotionOwner(options({ canAct: () => false, waitForInitialWindow: () => true }))
  const controls = nativeAnimationControls(),
    stop = controls.mount()
  owner.attach(modeledRef())
  const unsubscribe = controls.subscribe(owner)
  const pending = expect(controls.start({ x: 100 })).rejects.toThrow(/5000ms/)
  jest.advanceTimersByTime(5000)
  await pending
  owner.detach()
  unsubscribe()
  stop()
  jest.runOnlyPendingTimers()
  jest.useRealTimers()
})

it("reconciles current caller data after an eligibility loss without replaying the stale visual job", async () => {
  const value = motionValue<unknown>(0)
  let active = true
  const settings = options({ values: { opacity: value }, canAct: () => active })
  const owner = new NativeMotionOwner(settings)
  owner.attach(modeledRef())
  const state = new NativeMotionVisualState(owner.getBindings(), undefined, owner.captureVisualLease)
  state.attach()
  value.set(0.2)
  active = false
  owner.configure(settings)
  await flush()
  expect(state.getSnapshot().opacity).toBe(0)
  value.set(0.6)
  active = true
  owner.configure(settings)
  state.configure(owner.getBindings())
  expect(state.getSnapshot().opacity).toBe(0.6)
  state.detach()
  owner.detach()
  value.destroy()
})

it.each([false, true])("applies a live reduction change with explicit transition override %s", async (override) => {
  const controls = nativeAnimationControls(),
    stop = controls.mount(),
    started = jest.fn(),
    completed = jest.fn()
  const initial = { x: 0, opacity: 1 }
  const transition = { duration: 0.1, ease: "linear" as const, ...(override ? { reduceMotion: false } : {}) }
  const motion = { initial, animate: controls, onAnimationStart: started, onAnimationComplete: completed }
  await render(
    <NativeMotionConfig reducedMotion="never" transition={transition}>
      <NativeMotionOwnerHost testID="owner" motion={motion} />
    </NativeMotionConfig>,
  )
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, opacity: 0 })
  })
  await flush(1050)
  await screen.rerender(
    <NativeMotionConfig reducedMotion="always" transition={transition}>
      <NativeMotionOwnerHost testID="owner" motion={motion} />
    </NativeMotionConfig>,
  )
  await flush(1075)
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style)).toMatchObject({
    opacity: 0.25,
    transform: [{ translateX: override ? 75 : 100 }],
  })
  expect(started).toHaveBeenCalledTimes(1)
  await flush(1100)
  await pending
  expect(completed).toHaveBeenCalledTimes(1)
  await screen.unmount()
  stop()
})

it("finishes current owned animations when scoped skip is enabled", async () => {
  const controls = nativeAnimationControls(),
    stop = controls.mount(),
    completed = jest.fn()
  const motion = { initial: { x: 0 }, animate: controls, onAnimationComplete: completed }
  await render(
    <NativeMotionConfig>
      <NativeMotionOwnerHost testID="owner" motion={motion} />
    </NativeMotionConfig>,
  )
  let pending!: Promise<unknown[]>
  await act(() => {
    pending = controls.start({ x: 100, transition: { duration: 1, ease: "linear" } })
  })
  await flush(1050)
  await screen.rerender(
    <NativeMotionConfig skipAnimations>
      <NativeMotionOwnerHost testID="owner" motion={motion} />
    </NativeMotionConfig>,
  )
  await flush(1066)
  await pending
  expect(StyleSheet.flatten(screen.getByTestId("owner").props.style).transform).toEqual([{ translateX: 100 }])
  expect(completed).toHaveBeenCalledTimes(1)
  await screen.unmount()
  stop()
})
