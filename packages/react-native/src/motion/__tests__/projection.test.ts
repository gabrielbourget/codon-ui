import { TurboModuleRegistry } from "react-native"
import type { View, ViewStyle } from "react-native"

import { getNativeCardStyle } from "../../components/Card/styles"
import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"
import { resolveNativeTheme } from "../../theme/defaults"
import { NativeMotionDrag } from "../interactions/NativeMotionDrag"
import type { TNativeMotionPointerEvent } from "../interactions/types"
import { MotionGlobalConfig, frameData, time } from "../kernel"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import type { TNativeMotionOwnerProps } from "../owner/NativeMotionOwner"
import { NativeProjectionState } from "../projection/NativeProjectionState"
import { nativeProjectionStyles } from "../projection/nativeStyles"
import { nativeWindowNodeGroup } from "../projection/windowGroup"

const processBoxShadow = jest.requireActual<{
  default: (
    value: ViewStyle["boxShadow"],
  ) => Array<{ offsetX: number; offsetY: number; blurRadius?: number; spreadDistance?: number }>
}>("react-native/Libraries/StyleSheet/processBoxShadow").default

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
it.each([
  {
    name: "default raised style",
    style: getNativeCardStyle({}, resolveNativeTheme("light")),
    count: 2,
    x: 0,
    y: 2,
    blur: 4,
  },
  {
    name: "CSS string",
    style: { boxShadow: "2px 4px 8px 2px rgba(0,0,0,0.5)" } as ViewStyle,
    count: 1,
    x: 4,
    y: 4,
    blur: 8 / 0.75,
  },
  {
    name: "native unit strings",
    style: { boxShadow: [{ offsetX: "2px", offsetY: "4px", color: "navy" }] } as ViewStyle,
    count: 1,
    x: 4,
    y: 4,
    blur: undefined,
  },
])("projects Card shadows from $name through the actual SDK parser", async ({ style, count, x, y, blur }) => {
  const f = create()
  const original = JSON.stringify(style)
  expect(processBoxShadow(style.boxShadow)).toHaveLength(count)
  f.actor.configure("initial", style, undefined, undefined, undefined)
  f.send("frame")
  await turn()
  f.actor.configure("shadow-size", style, undefined, undefined, undefined)
  f.send("mount-before", "shadow-size", 10, 100, "initial")
  f.send("mount-after", "shadow-size", 10, 200, "shadow-size")
  await turn()
  const parsed = processBoxShadow(f.actor.getSnapshot().style.boxShadow)
  expect(parsed).toHaveLength(count)
  expect(parsed[0].offsetX).toBe(x)
  expect(parsed[0].offsetY).toBe(y)
  if (blur === undefined) expect(parsed[0].blurRadius).toBeUndefined()
  else expect(parsed[0].blurRadius).toBeCloseTo(blur, 5)
  expect(JSON.stringify(style)).toBe(original)
  expect(f.errors).not.toHaveBeenCalled()
})
it("tracks native shadow-list live values after a string value without retaining the stale scalar", async () => {
  const f = create()
  const shadow = f.owner.getValue("boxShadow", "2px 4px 8px red")
  const style = { boxShadow: "2px 4px 8px red" }
  f.actor.configure("initial", style, undefined, undefined, undefined)
  f.send("frame")
  await turn()
  f.actor.configure("shadow-live", style, undefined, undefined, undefined)
  f.send("mount-before", "shadow-live", 10, 100, "initial")
  f.send("mount-after", "shadow-live", 10, 200, "shadow-live")
  await turn()
  const latest = Object.freeze([Object.freeze({ offsetX: 4, offsetY: 6, color: "blue" })])
  shadow.set(latest)
  await flush(1050)
  const output = f.actor.getSnapshot().style.boxShadow
  expect(Array.isArray(output)).toBe(true)
  const x = f.actor.node!.projectionDeltaWithTransform!.x.scale * f.actor.node!.treeScale!.x
  const y = f.actor.node!.projectionDeltaWithTransform!.y.scale * f.actor.node!.treeScale!.y
  expect(processBoxShadow(output)).toMatchObject([{ offsetX: 4 / x, offsetY: 6 / y }])
  expect((output as ReadonlyArray<{ color: string }>)[0].color).toBe("blue")
  expect(shadow.get()).toBe(latest)
  shadow.set("none")
  await flush(1060)
  expect(processBoxShadow(f.actor.getSnapshot().style.boxShadow)).toEqual([])
  expect(f.errors).not.toHaveBeenCalled()
})
it("projects a matched actual before/after cohort and finishes the real source-owned animation", async () => {
  const start = jest.fn(),
    complete = jest.fn(),
    before = jest.fn(),
    measure = jest.fn(),
    f = create({
      onLayoutAnimationStart: start,
      onLayoutAnimationComplete: complete,
      onBeforeLayoutMeasure: before,
      onLayoutMeasure: measure,
    })
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
  expect(before.mock.calls.length).toBeGreaterThan(0)
  expect(
    before.mock.calls.every((args) => args.length === 3 && args.every((value: unknown) => value === undefined)),
  ).toBe(true)
  expect(measure.mock.calls.every((args) => args.length === 3 && args[2] === undefined)).toBe(true)
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
it("rejects retired visual callback dispatch after a new projection attaches to the same owner", async () => {
  const callback = jest.fn()
  const f = create({ onBeforeLayoutMeasure: callback, onLayoutMeasure: callback })
  f.send("frame")
  await turn()
  const retired = f.actor.node!.options.visualElement!
  f.actor.detach()
  f.actor.attach(f.target)
  f.send("frame")
  await turn()
  const current = f.actor.node!.options.visualElement!
  expect(current).not.toBe(retired)
  callback.mockClear()
  retired.notify("BeforeLayoutMeasure")
  retired.notify("LayoutMeasure", { x: { min: 0, max: 1 }, y: { min: 0, max: 1 } })
  expect(callback).not.toHaveBeenCalled()
  current.notify("BeforeLayoutMeasure")
  expect(callback.mock.calls).toEqual([[undefined, undefined, undefined]])
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
it("publishes unequal-axis radii independently of styles and clears them when projection resets", async () => {
  const f = create()
  f.actor.configure(
    "initial",
    { borderTopLeftRadius: 10, borderTopRightRadius: "25%" },
    undefined,
    undefined,
    undefined,
  )
  f.send("frame")
  await turn()
  f.actor.configure("size", { borderTopLeftRadius: 10, borderTopRightRadius: "25%" }, undefined, undefined, undefined)
  f.send("mount-before", "size", 10, 100, "initial")
  f.send("mount-after", "size", 10, 200, "size")
  await turn()
  expect(JSON.parse(f.actor.getSnapshot().radii)).toEqual({
    topLeft: { x: 20, y: 10 },
    topRight: null,
    bottomLeft: null,
    bottomRight: null,
  })
  expect(f.actor.getSnapshot().style).toMatchObject({ borderTopRightRadius: "25%" })
  f.actor.node!.needsReset = true
  f.actor.render()
  expect(f.actor.getSnapshot().radii).toBe("")
  f.actor.render()
  expect(f.actor.getSnapshot().radii).not.toBe("")
  f.window("replacement")
  expect(f.actor.getSnapshot()).toEqual({ style: {}, visible: true, radii: "" })
  expect(f.errors).not.toHaveBeenCalled()
})
it.each([
  ["ios", "ltr", false, [5, 6, 7, 8]],
  ["ios", "rtl", false, [6, 5, 8, 7]],
  ["android", "ltr", false, [5, 6, 7, 8]],
  ["android", "rtl", true, [6, 5, 8, 7]],
  ["android", "rtl", false, [6, 5, 7, 8]],
] as const)(
  "preserves %s %s logical-corner precedence with swap=%s",
  async (platform, direction, swapLeftAndRight, expected) => {
    const f = create()
    f.send("frame")
    await turn()
    f.actor.configure("size", {}, undefined, undefined, undefined)
    f.send("mount-before", "size", 10, 100, "initial")
    f.send("mount-after", "size", 10, 200, "size")
    await turn()
    const receive = jest.fn()
    nativeProjectionStyles(
      f.actor.node!,
      {
        borderTopStartRadius: 5,
        borderTopEndRadius: 6,
        borderBottomStartRadius: 7,
        borderBottomEndRadius: 8,
      },
      undefined,
      receive,
      { platform, direction, swapLeftAndRight },
    )
    expect(receive).toHaveBeenCalledWith(
      Object.fromEntries(
        ["topLeft", "topRight", "bottomLeft", "bottomRight"].map((corner, index) => [
          corner,
          { x: expected[index] * 2, y: expected[index] },
        ]),
      ),
    )
  },
)
