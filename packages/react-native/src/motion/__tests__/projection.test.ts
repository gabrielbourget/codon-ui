import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { NativeMotionDrag } from "../interactions/NativeMotionDrag"
import type { TNativeMotionPointerEvent } from "../interactions/types"
import { MotionGlobalConfig, frameData, time } from "../kernel"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import { NativeProjectionState } from "../projection/NativeProjectionState"
import { nativeProjectionStyles } from "../projection/nativeStyles"
import { nativeWindowNodeGroup } from "../projection/windowGroup"

// Real observer/owner/projection code with explicit ref/native-packet/frame models; no native rendering occurs.
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>(),
  disposals = new Set<() => void>()
let sequence = 0,
  frameId = 0
const turn = async () => {
  for (let i = 0; i < 24; i++) await Promise.resolve()
}
const flush = async (timestamp: number) => {
  frameData.timestamp = timestamp
  time.set(timestamp)
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(timestamp))
  await turn()
}
const create = (
  extra: Partial<TNativeMotionOwnerProps> = {},
  parent?: NativeProjectionState,
  initialWindow = "window",
) => {
  const id = ++sequence,
    tag = 70 + id,
    ownerId = `owner:${id}`,
    bindingId = `binding:${id}`,
    target = { isConnected: true, setNativeProps: jest.fn() } as unknown as View
  const props = { layout: true, transition: { duration: 0.1, ease: "linear" as const }, ...extra }
  const owner = new NativeMotionOwner({ props, base: {}, config: {}, reduced: false, canAct: () => true })
  let lastPacket: ReturnType<typeof geometryPacket> | undefined
  let revision = 0,
    windowId = initialWindow
  const observer = new NativeMotionGeometryObserver({
    ownerId,
    bindingId,
    target: () => tag,
    scope: () => ({ ownerId: "scope", windowId, epoch: 2 }),
    dispatch: (requestId) => {
      if (lastPacket) observer.receive({ ...lastPacket, kind: "sample", requestId, geometryRevision: ++revision })
    },
  })
  const release = registerNativeMotionGeometryObserver(target, observer)
  owner.attach(target)
  const errors = jest.fn(),
    actor = new NativeProjectionState(owner, parent, errors)
  actor.configure("initial", {}, undefined, undefined, undefined)
  actor.attach(target)
  const send = (
    kind: TNativeMotionGeometryRecord["kind"],
    transactionId = "",
    x = 10,
    width = 100,
    intent = "initial",
    direction: "ltr" | "rtl" = "ltr",
  ) => {
    const snapshot = geometrySnapshot()
    Object.assign(snapshot, {
      layout: [x, 20, width, 50],
      untransformed: { box: [x, 20, width, 50], quad: [x, 20, x + width, 20, x + width, 70, x, 70] },
      model: { box: [x, 20, width, 50], quad: [x, 20, x + width, 20, x + width, 70, x, 70] },
    })
    Object.assign(snapshot.ancestors[0], {
      tag,
      identity: ownerId,
      projectionRevision: intent,
      layoutDirection: direction,
    })
    snapshot.ancestors.push({ ...snapshot.ancestors[0], tag: 0, identity: "parent", bounds: [0, 0, 300, 200] })
    lastPacket = geometryPacket({
      ownerId,
      bindingId,
      target: tag,
      windowId,
      kind,
      transactionId,
      geometryRevision: ++revision,
      snapshot: JSON.stringify(snapshot),
    })
    observer.receive(lastPacket)
  }
  const dispose = () => {
    actor.detach()
    owner.detach()
    release()
    disposals.delete(dispose)
  }
  disposals.add(dispose)
  return {
    actor,
    owner,
    props,
    observer,
    errors,
    send,
    target,
    dispose,
    window: (next: string) => {
      windowId = next
      observer.refreshScope()
    },
  }
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    frames.set(++frameId, callback)
    return frameId
  })
})
afterEach(async () => {
  for (const dispose of [...disposals]) dispose()
  await flush(10000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})
it("projects a matched actual before/after cohort and finishes the real source-owned animation", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    measure = jest.fn(),
    f = create({ onLayoutAnimationStart: start, onLayoutAnimationComplete: complete, onLayoutMeasure: measure })
  f.send("frame")
  await turn()
  f.actor.configure("move", {}, undefined, undefined, undefined)
  f.send("mount-before", "cohort", 10, 100, "initial")
  f.send("mount-after", "cohort", 110, 100, "move")
  await turn()
  expect(f.actor.node?.projectionDelta?.x.translate).toBe(-100)
  expect(f.actor.getSnapshot().style.transform).toContainEqual({ translateX: -100 })
  await flush(1050)
  await flush(1120)
  expect(start).toHaveBeenCalledTimes(1)
  expect(complete).toHaveBeenCalledTimes(1)
  expect(measure).toHaveBeenCalled()
  expect(f.errors).not.toHaveBeenCalled()
})
it("waits for all members of the same window and rejects an older React intent", async () => {
  const a = create(),
    b = create()
  a.send("frame")
  b.send("frame")
  await turn()
  a.actor.configure("next", {}, undefined, undefined, undefined)
  b.actor.configure("next", {}, undefined, undefined, undefined)
  a.send("mount-before", "pair", 10, 100, "initial")
  b.send("mount-before", "pair", 10, 100, "initial")
  a.send("mount-after", "pair", 50, 100, "old")
  b.send("mount-after", "pair", 50, 100, "next")
  await turn()
  expect(a.actor.node?.projectionDelta).toBeUndefined()
  a.send("mount-after", "pair", 50, 100, "next")
  await turn()
  expect(a.actor.node?.projectionDelta?.x.translate).toBe(-40)
  expect(b.actor.node?.projectionDelta?.x.translate).toBe(-40)
})
it("preserves size/position modes and default reduced/skip completion policies", async () => {
  const f = create({ layout: "position" })
  f.send("frame")
  await turn()
  f.actor.configure("size", {}, undefined, undefined, undefined)
  f.send("mount-before", "size", 10, 100, "initial")
  f.send("mount-after", "size", 30, 200, "size")
  await turn()
  expect(f.actor.node?.projectionDelta?.x.scale).toBe(1)
  expect(f.actor.node?.projectionDelta?.x.translate).toBe(-20)
  f.owner.shouldSkipAnimations = true
  f.actor.configure("size", {}, undefined, undefined, undefined)
  await flush(1040)
  expect(f.actor.node?.currentAnimation).toBeUndefined()
})
it("routes owned pop roots through the native family lease without writing pop fields through the visual host", async () => {
  const f = create(),
    writer = jest.fn()
  f.actor.attachWriter(writer)
  Object.assign(f.target, { ownerDocument: {} })
  jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(31)
  const backend = jest.fn((encoded: string) => {
    const request = JSON.parse(encoded)
    return JSON.stringify(
      request.action === "capture"
        ? {
            ...request,
            kind: "native-pop-frame",
            lease: "projection-pop",
            surfaceId: 1,
            fabricRevision: "2",
            positionedParent: 11,
            left: 10,
            top: 20,
            width: 100,
            height: 50,
            right: 190,
            bottom: 130,
            direction: "rtl",
          }
        : { lease: request.lease, released: request.action === "release" },
    )
  })
  jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ popPresentation: backend } as never)
  f.send("frame", "", 10, 100, "initial", "rtl")
  await turn()
  const measured = f.actor.read()
  expect(measured).toMatchObject({
    left: 10,
    top: 20,
    width: 100,
    height: 50,
    right: 190,
    bottom: 130,
    direction: "rtl",
  })
  writer.mockClear()
  const release = f.actor.freeze(measured, "left", "bottom")
  expect(writer).not.toHaveBeenCalled()
  expect(JSON.parse(backend.mock.calls[1][0])).toMatchObject({
    action: "activate",
    lease: "projection-pop",
    anchorX: "left",
    anchorY: "bottom",
  })
  release()
  expect(f.actor.getSnapshot().style.position).toBeUndefined()
})
it("retires pending frame work and leaves a replacement native ref untouched", async () => {
  const f = create(),
    writer = jest.fn()
  f.actor.attachWriter(writer)
  f.send("frame")
  await turn()
  f.actor.configure("move", {}, undefined, undefined, undefined)
  f.send("mount-before", "move")
  f.send("mount-after", "move", 50, 100, "move")
  f.actor.detach()
  f.owner.attach({} as View)
  await turn()
  await flush(1200)
  expect(writer).not.toHaveBeenCalled()
  expect(f.actor.node).toBeUndefined()
})
it("does not mutate frozen native boxes while calculating projection", async () => {
  const f = create()
  f.send("frame")
  await turn()
  const record = f.actor.record!,
    before = JSON.stringify(record)
  f.actor.node!.measure()
  expect(JSON.stringify(record)).toBe(before)
  expect(Object.isFrozen(record.snapshot!.model)).toBe(true)
})
it("blocks layout animation while dragging and applies the source layout delta exactly once", async () => {
  const f = create({ drag: "x" })
  f.send("frame")
  await turn()
  const drag = new NativeMotionDrag(f.owner, f.errors)
  const pointer = (x: number) =>
    ({
      nativeEvent: { pageX: x, pageY: 0, pointerId: 1, pointerType: "touch", isPrimary: true, button: 0 },
      persist() {},
    }) as unknown as TNativeMotionPointerEvent
  drag.refresh()
  await turn()
  drag.start(pointer(0))
  await turn()
  drag.move(pointer(20))
  await flush(1016)
  expect(f.actor.node!.isAnimationBlocked).toBe(true)
  f.actor.configure("move", {}, undefined, undefined, undefined)
  f.send("mount-before", "drag-layout", 10, 100, "initial")
  f.send("mount-after", "drag-layout", 20, 100, "move")
  await turn()
  expect(f.owner.getValue("x")!.get()).toBe(10)
  drag.move(pointer(30))
  await flush(1032)
  expect(f.owner.getValue("x")!.get()).toBe(20)
  drag.cancel()
  expect(f.actor.node!.isAnimationBlocked).toBe(false)
  drag.retire()
  expect(f.errors).not.toHaveBeenCalled()
})
it("scopes one logical layout group to separate actual window trees", async () => {
  const group = nativeWindowNodeGroup(),
    a = create({ layoutId: "shared" }, undefined, "a"),
    b = create({ layoutId: "shared" }, undefined, "b")
  a.actor.configure("initial", {}, undefined, group, "group")
  b.actor.configure("initial", {}, undefined, group, "group")
  a.send("frame")
  b.send("frame")
  await turn()
  expect(a.actor.node!.root).not.toBe(b.actor.node!.root)
  a.actor.node!.willUpdate()
  expect(a.actor.node!.isLayoutDirty).toBe(true)
  expect(b.actor.node!.isLayoutDirty).toBe(false)
})
it("retires an actual old window before attaching fresh geometry", async () => {
  const f = create()
  f.send("frame")
  await turn()
  const old = f.actor.node
  f.window("new")
  expect(f.actor.node).toBeUndefined()
  f.actor.configure("next", {}, undefined, undefined, undefined)
  f.send("frame", "", 30, 100, "next")
  await turn()
  expect(f.actor.node).toBeDefined()
  expect(f.actor.node).not.toBe(old)
})
it("requires an exact native receiver for anisotropic corner correction instead of rounding or snapping", async () => {
  const f = create()
  f.send("frame")
  await turn()
  f.actor.configure("size", {}, undefined, undefined, undefined)
  f.send("mount-before", "size", 10, 100, "initial")
  f.send("mount-after", "size", 10, 200, "size")
  await turn()
  expect(() => nativeProjectionStyles(f.actor.node!, { borderRadius: 10 })).toThrow(
    /exact elliptical radius receiver unavailable/,
  )
  const receive = jest.fn()
  nativeProjectionStyles(f.actor.node!, { borderRadius: 10 }, undefined, receive)
  expect(receive).toHaveBeenCalledWith(expect.objectContaining({ topLeft: { x: 20, y: 10 } }))
})
