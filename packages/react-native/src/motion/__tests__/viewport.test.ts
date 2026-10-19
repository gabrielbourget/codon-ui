import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { frameData, MotionGlobalConfig, time } from "../kernel"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import { NativeMotionViewport } from "../viewport/NativeMotionViewport"
import { nativeViewportMargins, nativeViewportThreshold } from "../viewport/types"

// Actual source owner/observer/controller, with explicit native response/ref
// models. No Fabric intersection, native rendering or timing is measured.
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let frameId = 0
const fixtures: Array<() => void> = []
const turn = async () => {
  for (let index = 0; index < 16; index++) await Promise.resolve()
}
const flush = async (timestamp = 1000) => {
  time.set(timestamp)
  frameData.timestamp = timestamp
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(timestamp))
  await turn()
}
const setup = (props: TNativeMotionOwnerProps = {}, animate = false) => {
  const document = {},
    view = { isConnected: true, ownerDocument: document },
    root = { isConnected: true, ownerDocument: document }
  let live = true,
    revision = 0,
    intersecting = false,
    ratio = 0,
    windowId = "window"
  const owner = new NativeMotionOwner({ props, base: { opacity: 1 }, config: {}, reduced: false, canAct: () => live })
  owner.attach(view as unknown as View)
  const active = animate
    ? jest.spyOn(owner.animationState, "setActive")
    : jest.spyOn(owner.animationState, "setActive").mockResolvedValue(undefined)
  const observer = new NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => ({ ownerId: "scope", windowId, epoch: 2 }),
    dispatch: () => {},
  })
  const unregister = registerNativeMotionGeometryObserver(view as unknown as View, observer)
  const native = jest.fn((encoded: string) => {
    const request = JSON.parse(encoded)
    return JSON.stringify({
      ...request,
      kind: "native-viewport",
      surfaceId: 1,
      fabricRevision: "2",
      isIntersecting: intersecting,
      intersectionRatio: ratio,
      time: revision,
      rootBounds: [0, 0, 300, 200],
      boundingClientRect: [10, 20, 100, 50],
      intersectionRect: intersecting ? [10, 20, 100 * ratio, 50] : [0, 0, 0, 0],
    })
  })
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getViewportSnapshot: native } as never)
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((target) => (target === (view as unknown as View) ? 71 : 72))
  const error = jest.fn(),
    feature = new NativeMotionViewport(owner, error)
  feature.refresh()
  const send = (inside: boolean, fraction = inside ? 1 : 0, extra: Partial<ReturnType<typeof geometryPacket>> = {}) => {
    intersecting = inside
    ratio = fraction
    observer.receive(geometryPacket({ geometryRevision: ++revision, kind: "frame", windowId, ...extra }))
  }
  const update = (next: TNativeMotionOwnerProps) => {
    owner.commitProps({ props: next, base: { opacity: 1 }, config: {}, reduced: false, canAct: () => live })
    feature.refresh()
  }
  const dispose = () => {
    feature.detach()
    unregister()
    owner.detach()
  }
  fixtures.push(dispose)
  return {
    owner,
    feature,
    active,
    native,
    view,
    root,
    error,
    send,
    update,
    retire: () => {
      live = false
      owner.invalidate()
      feature.refresh()
    },
    changeWindow: () => {
      windowId = "new-window"
      observer.refreshScope()
      owner.invalidate()
      feature.refresh()
    },
  }
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  time.set(1000)
  frameData.timestamp = 1000
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback)
    return frameId
  })
})
afterEach(async () => {
  fixtures.splice(0).forEach((dispose) => dispose())
  await flush(10000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("keeps the pinned isIntersecting semantics for partial initial visibility even with amount=all", async () => {
  const enter = jest.fn(),
    leave = jest.fn(),
    f = setup({ viewport: { amount: "all" }, onViewportEnter: enter, onViewportLeave: leave })
  f.send(false)
  await flush()
  expect(leave).not.toHaveBeenCalled()
  f.send(true, 0.2)
  await flush()
  expect(enter).toHaveBeenCalledTimes(1)
  f.send(true, 1)
  await flush()
  f.send(true, 0.4)
  await flush()
  expect(enter).toHaveBeenCalledTimes(1)
  f.send(false)
  await flush()
  expect(leave).toHaveBeenCalledTimes(1)
  expect(f.active.mock.calls).toEqual([
    ["whileInView", true],
    ["whileInView", false],
  ])
  expect(enter.mock.calls[0][0]).toMatchObject({ target: f.view, intersectionRatio: 0.2, isIntersecting: true })
  expect(Object.isFrozen(enter.mock.calls[0][0])).toBe(true)
})
it("retains once across exits and reentries while preserving actual callback entry data", async () => {
  const enter = jest.fn(),
    leave = jest.fn(),
    f = setup({ viewport: { once: true }, onViewportEnter: enter, onViewportLeave: leave })
  f.send(true, 0)
  await flush()
  f.send(false)
  await flush()
  f.send(true, 0.5)
  await flush()
  expect(enter).toHaveBeenCalledTimes(2)
  expect(leave).not.toHaveBeenCalled()
  expect(f.active.mock.calls).toEqual([
    ["whileInView", true],
    ["whileInView", true],
  ])
})
it("uses latest committed handlers but keeps once captured until root/margin/amount changes", async () => {
  const first = jest.fn(),
    next = jest.fn(),
    leave = jest.fn(),
    f = setup({ viewport: { once: false }, onViewportEnter: first })
  f.send(true, 0.5)
  f.update({ viewport: { once: true }, onViewportEnter: next, onViewportLeave: leave })
  await flush()
  expect(first).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  f.send(false)
  await flush()
  expect(leave).toHaveBeenCalledTimes(1)
})
it("captures the actual root ref at observer start instead of following uncommitted ref.current changes", async () => {
  const root = { current: null as View | null },
    enter = jest.fn(),
    f = setup({ viewport: { root }, onViewportEnter: enter })
  root.current = f.root as unknown as View
  f.feature.refresh()
  f.send(true)
  await flush()
  expect(JSON.parse(f.native.mock.calls[0][0]).root).toBe(0)
  f.update({ viewport: { root, margin: "10% 2px" }, onViewportEnter: enter })
  f.send(true)
  await flush()
  expect(JSON.parse(f.native.mock.calls.at(-1)![0])).toMatchObject({
    root: 72,
    margins: nativeViewportMargins("10% 2px"),
  })
})
it.each(["owner", "window", "detach"])("retires queued entries after %s lifetime changes", async (kind) => {
  const enter = jest.fn(),
    f = setup({ onViewportEnter: enter })
  f.send(true)
  if (kind === "owner") f.retire()
  if (kind === "window") f.changeWindow()
  if (kind === "detach") f.feature.detach()
  await flush()
  expect(enter).not.toHaveBeenCalled()
})
it("binds whileInView to the actual numeric source animation owner", async () => {
  const f = setup({ whileInView: { opacity: 0.3 }, transition: { duration: 0.1, ease: "linear" } }, true)
  await f.owner.animationState.animateChanges()
  f.send(true)
  await flush(1000)
  await flush(1016)
  await flush(1150)
  await flush(1166)
  expect(f.owner.values.get("opacity")?.get()).toBeCloseTo(0.3)
  expect(f.error).not.toHaveBeenCalled()
})
it("accepts empty native view revisions without inventing an authority stamp", async () => {
  const f = setup({ onViewportEnter: jest.fn() })
  f.send(true, 1, { commitRevision: "" })
  await flush()
  expect(JSON.parse(f.native.mock.calls[0][0]).nativeViewRevision).toBe("")
  expect(f.error).not.toHaveBeenCalled()
})
it.each(["requestId", "bindingId", "target"])("rejects a foreign %s response before activating state", async (key) => {
  const enter = jest.fn(),
    f = setup({ onViewportEnter: enter }),
    original = f.native.getMockImplementation()!
  f.native.mockImplementation((encoded) => JSON.stringify({ ...JSON.parse(original(encoded)), [key]: "foreign" }))
  f.send(true)
  await flush()
  expect(enter).not.toHaveBeenCalled()
  expect(f.active).not.toHaveBeenCalled()
  expect(f.error).toHaveBeenCalled()
})
it("rejects a ref/document change during the native query", async () => {
  const enter = jest.fn(),
    f = setup({ onViewportEnter: enter }),
    original = f.native.getMockImplementation()!
  f.native.mockImplementation((encoded) => {
    const result = original(encoded)
    f.view.ownerDocument = {}
    return result
  })
  f.send(true)
  await flush()
  expect(enter).not.toHaveBeenCalled()
  expect(f.error).toHaveBeenCalled()
})
it.each(["1em", "0", "10px 2px 3px 4px 5px", "Infinitypx"])("rejects invalid root margin %s", (margin) =>
  expect(() => nativeViewportMargins(margin)).toThrow(),
)
it.each([NaN, Infinity, -0.1, 1.1])("rejects invalid amount %s", (amount) =>
  expect(() => nativeViewportThreshold(amount)).toThrow(),
)
it("normalizes CSS shorthand margins without resolving percentages against fabricated dimensions", () => {
  expect(nativeViewportMargins("1PX -2% .5px")).toEqual([
    { value: 1, percent: false },
    { value: -2, percent: true },
    { value: 0.5, percent: false },
    { value: -2, percent: true },
  ])
})
