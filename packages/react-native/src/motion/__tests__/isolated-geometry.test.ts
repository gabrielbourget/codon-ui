import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionColorSampler, registerNativeMotionColorSampler } from "../../input/motionColors"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import {
  NativeMotionIsolatedGeometryState,
  normalizeNativeMotionKeyframeUnits,
  resolveNativeMotionIsolatedLayout,
} from "../measurement/isolatedGeometry"
import { NativeMotionResolutionBatch } from "../value/resolution-batch"

import { measurementToken } from "./measurement.fixture"

// Explicit ref/bridge/trait/layout models exercise source guards and ordering; they do not establish installed native fidelity.
const harness = (acknowledge = true) => {
  const target = { isConnected: true, setNativeProps: jest.fn() } as unknown as View,
    listeners = new Set<() => void>()
  let active = true,
    tag = 71,
    revision = 0,
    scope = { ownerId: "scope", windowId: "window", epoch: 2 }
  const observer = new NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => scope,
    dispatch: (requestId) => {
      if (acknowledge) observer.receive(geometryPacket({ requestId, geometryRevision: ++revision }))
    },
  })
  const sampler = new NativeMotionColorSampler({
    ownerId: "owner",
    target: () => 71,
    scope: () => scope,
    dispatch: jest.fn(),
  })
  sampler.receive({
    ownerId: "owner",
    target: 71,
    kind: "environment",
    requestId: "",
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    environmentRevision: 1,
    attached: true,
    colors: "[]",
    error: "",
    observedAt: 100,
  })
  const releaseGeometry = registerNativeMotionGeometryObserver(target, observer),
    releaseColors = registerNativeMotionColorSampler(target, sampler)
  const response = (encoded: string) => {
    const request = JSON.parse(encoded) as {
      properties: string[]
      stages: Array<{ index: number; nativeView: Record<string, unknown> }>
    }
    return {
      ...JSON.parse(encoded),
      kind: "evaluated-layout",
      surfaceId: 1,
      fabricRevision: "9",
      results: request.stages.map((stage) => {
        const width =
          stage.nativeView.width === "auto"
            ? 200
            : typeof stage.nativeView.width === "number"
              ? stage.nativeView.width
              : 100
        const height =
          stage.nativeView.height === "auto"
            ? width / 2
            : typeof stage.nativeView.height === "number"
              ? stage.nativeView.height
              : 40
        return {
          index: stage.index,
          metrics: Object.fromEntries(
            request.properties.map((field) => [
              field,
              field === "width" ? width : field === "height" ? height : stage.nativeView[field],
            ]),
          ),
        }
      }),
    }
  }
  const backend = jest.fn(async (encoded: string) => JSON.stringify(response(encoded)))
  const registry = jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ evaluateLayout: backend } as never)
  jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation(() => tag)
  const token = {
    isCurrent: () => active,
    onCancel: (callback: () => void) => {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
  }
  return {
    target,
    token,
    backend,
    registry,
    listeners,
    response,
    release: () => {
      releaseGeometry()
      releaseColors()
    },
    retire: () => {
      active = false
      ;[...listeners].forEach((callback) => callback())
    },
    replaceTag: () => {
      tag++
    },
    disconnect: () => {
      ;(target as unknown as { isConnected: boolean }).isConnected = false
    },
    changeWindow: () => {
      scope = { ...scope, windowId: "replacement", epoch: 3 }
      observer.refreshScope()
    },
    changeRevision: () => observer.receive(geometryPacket({ geometryRevision: ++revision, commitRevision: "next" })),
    changeColors: () =>
      sampler.receive({
        ownerId: "owner",
        target: 71,
        kind: "environment",
        requestId: "",
        windowId: "window",
        scopeOwnerId: "scope",
        epoch: 2,
        environmentRevision: 2,
        attached: true,
        colors: "[]",
        error: "",
        observedAt: 100,
      }),
  }
}

const turn = async () => {
  for (let index = 0; index < 20; index++) {
    jest.runAllTicks()
    await Promise.resolve()
  }
}
const stages = Object.freeze([
  Object.freeze({ index: 0, nativeView: Object.freeze({ width: 100, height: 40 }) }),
  Object.freeze({ index: 1, nativeView: Object.freeze({ width: "auto", height: "auto" }) }),
])
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("queries ordered immutable private stages without publishing any actual-view style", async () => {
  const h = harness()
  const result = await resolveNativeMotionIsolatedLayout(h.target, stages, ["width", "height"], h.token)
  expect(result).toMatchObject({
    kind: "evaluated-layout",
    surfaceId: 1,
    fabricRevision: "9",
    results: [
      { index: 0, metrics: { width: 100, height: 40 } },
      { index: 1, metrics: { width: 200, height: 100 } },
    ],
  })
  expect(JSON.parse(h.backend.mock.calls[0][0])).toMatchObject({
    ownerId: "owner",
    bindingId: "binding",
    target: 71,
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    attachmentRevision: 1,
    nativeViewRevision: "initial",
    properties: ["width", "height"],
    stages,
  })
  expect((h.target as unknown as { setNativeProps: jest.Mock }).setNativeProps).not.toHaveBeenCalled()
  expect(stages[1].nativeView.width).toBe("auto")
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})
it.each([
  ["ownerId", "foreign"],
  ["bindingId", "foreign"],
  ["target", 72],
  ["windowId", "foreign"],
  ["scopeOwnerId", "foreign"],
  ["epoch", 3],
  ["attachmentRevision", 99],
  ["nativeViewRevision", "foreign"],
  ["requestId", "old"],
  ["kind", "mount-after"],
  ["surfaceId", 0],
  ["fabricRevision", "01"],
  ["results", []],
  ["results", [{ index: 1, metrics: { width: 1 } }]],
  [
    "results",
    [
      { index: 0, metrics: { width: null } },
      { index: 1, metrics: { width: 1 } },
    ],
  ],
  [
    "results",
    [
      { index: 0, metrics: { height: 1 } },
      { index: 1, metrics: { height: 1 } },
    ],
  ],
])("rejects foreign or incomplete evaluated %s", async (field, value) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => JSON.stringify({ ...h.response(encoded), [field as string]: value }))
  await expect(resolveNativeMotionIsolatedLayout(h.target, stages, ["width"], h.token)).rejects.toThrow()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})
it("retains actual recursive native metrics instead of substituting fabricated dimensions", async () => {
  const h = harness()
  const transform = Object.freeze([{ translateX: 12 }, { rotateZ: "45deg" }])
  h.backend.mockImplementation(async (encoded) =>
    JSON.stringify({
      ...h.response(encoded),
      results: [
        { index: 0, metrics: { transform } },
        { index: 1, metrics: { transform } },
      ],
    }),
  )
  const result = await resolveNativeMotionIsolatedLayout(h.target, stages, ["transform"], h.token)
  expect(result.results[0].metrics.transform).toEqual(transform)
  expect(Object.isFrozen(result.results[0].metrics.transform)).toBe(true)
  h.release()
})
it.each(["cancel", "window", "revision", "colors", "tag", "disconnect", "remove"])(
  "retires %s and ignores a late native result",
  async (reason) => {
    const h = harness()
    let complete!: (value: string) => void
    h.backend.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const pending = resolveNativeMotionIsolatedLayout(h.target, stages, ["width"], h.token)
    const rejection = expect(pending).rejects.toThrow()
    await turn()
    if (reason === "cancel") h.retire()
    else if (reason === "window") h.changeWindow()
    else if (reason === "revision") h.changeRevision()
    else if (reason === "colors") h.changeColors()
    else if (reason === "tag") h.replaceTag()
    else if (reason === "disconnect") h.disconnect()
    else h.release()
    complete(JSON.stringify(h.response(h.backend.mock.calls[0][0])))
    await rejection
    expect(h.listeners.size).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
    if (reason !== "remove") h.release()
  },
)
it.each([true, false])("bounds baseline/module work at the original 5000ms deadline (baseline %s)", async (ack) => {
  const h = harness(ack)
  h.backend.mockImplementation(() => new Promise(() => {}))
  const pending = resolveNativeMotionIsolatedLayout(h.target, stages, ["width"], h.token)
  const rejection = expect(pending).rejects.toThrow("5000ms")
  await turn()
  jest.advanceTimersByTime(5000)
  await rejection
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})
it("preserves native unsupported-field errors", async () => {
  const h = harness()
  h.backend.mockRejectedValue(new Error("Native motion evaluator: transform: incompatible-native-topology"))
  await expect(resolveNativeMotionIsolatedLayout(h.target, stages, ["transform"], h.token)).rejects.toThrow(
    "incompatible-native-topology",
  )
  h.release()
})
it.each([
  ["rotate", ["90deg", `${Math.PI}rad`], [90, 180]],
  ["originX", [0.5, "75%"], [0.5, 0.75]],
  ["transform", [[{ rotate: "0deg" }], [{ rotate: `${Math.PI}rad` }]], [[{ rotate: "0deg" }], [{ rotate: "180deg" }]]],
])("normalizes valid native %s units without consulting Yoga", (name, frames, expected) => {
  expect(normalizeNativeMotionKeyframeUnits(name as string, frames as unknown[])).toEqual(expected)
})
it("preserves native structure order, missing fields, frozen endpoints and opaque unchanged identities", () => {
  const original = Object.freeze([{ scale: 1 }, { translateX: "50%" }])
  const target = Object.freeze([{ translateX: 20 }, { rotate: "1rad" }])
  const frames = normalizeNativeMotionKeyframeUnits("transform", [original, target])
  expect(frames[0]).toBe(original)
  expect((frames[1] as object[])[0]).toEqual({ translateX: 20 })
  expect(Object.keys((frames[1] as object[])[1])).toEqual(["rotate"])
  expect(target[1]).toEqual({ rotate: "1rad" })
})
it("normalizes native angles locally while preserving native font-weight string types", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState()
  await expect(state.resolve(h.target, "rotate", ["0deg", "1rad"], h.token)).resolves.toMatchObject({
    keyframes: [0, 180 / Math.PI],
    finalKeyframe: "1rad",
  })
  await expect(state.resolve(h.target, "fontWeight", ["400", "700"], h.token)).resolves.toEqual({
    keyframes: ["400", "700"],
    finalKeyframe: "700",
  })
  expect(h.backend).not.toHaveBeenCalled()
  h.release()
})
it("waits for async normalization then batches only properties that actually need geometry", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState(),
    batch = new NativeMotionResolutionBatch()
  const width = batch.begin("width", h.token),
    height = batch.begin("height", h.token)
  width.normalized([100, 200])
  width.settled()
  let widthReady = false
  void width.ready.then(() => {
    widthReady = true
  })
  await turn()
  expect(widthReady).toBe(false)
  expect(h.backend).not.toHaveBeenCalled()
  height.normalized([40, "auto"])
  const pending = state.resolve(h.target, "height", [40, "auto"], h.token, height)
  await turn()
  await expect(pending).resolves.toEqual({ keyframes: [40, 50], finalKeyframe: "auto" })
  height.settled()
  await width.ready
  const request = JSON.parse(h.backend.mock.calls[0][0])
  expect(request.properties).toEqual(["height"])
  expect(request.stages).toEqual([
    { index: 0, nativeView: {} },
    { index: 1, nativeView: { height: "auto" } },
  ])
  expect(request.stages.every((stage: { nativeView: object }) => !Object.hasOwn(stage.nativeView, "width"))).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})
it("couples actual geometry jobs and emits source target/restoration notifications in grouped order", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState(),
    batch = new NativeMotionResolutionBatch(),
    trace: unknown[] = []
  const width = batch.begin("width", h.token),
    height = batch.begin("height", h.token)
  width.normalized([100, "auto"])
  const first = state.resolve(h.target, "width", [100, "auto"], h.token, width, (value, phase) =>
    trace.push(["width", value, phase]),
  )
  await turn()
  expect(h.backend).not.toHaveBeenCalled()
  height.normalized([40, "auto"])
  const second = state.resolve(h.target, "height", [40, "auto"], h.token, height, (value, phase) =>
    trace.push(["height", value, phase]),
  )
  await expect(first).resolves.toEqual({ keyframes: [100, 200], finalKeyframe: "auto" })
  await expect(second).resolves.toEqual({ keyframes: [40, 100], finalKeyframe: "auto" })
  width.settled()
  height.settled()
  await width.ready
  expect(h.backend).toHaveBeenCalledTimes(1)
  expect(trace).toEqual([
    ["width", "auto", "target"],
    ["height", "auto", "target"],
    ["width", 100, "restored"],
    ["height", 40, "restored"],
  ])
  h.release()
})
it("retires a cancelled coupled query and re-evaluates its live sibling without the cancelled endpoint", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState(),
    batch = new NativeMotionResolutionBatch(),
    one = measurementToken(),
    two = measurementToken()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  width.normalized([100, "auto"])
  height.normalized([40, "auto"])
  let complete!: (value: string) => void
  h.backend.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      }),
  )
  const first = state.resolve(h.target, "width", [100, "auto"], one, width)
  const rejection = expect(first).rejects.toThrow("cancelled")
  const second = state.resolve(h.target, "height", [40, "auto"], two, height)
  await turn()
  expect(h.backend).toHaveBeenCalledTimes(1)
  one.cancel()
  await rejection
  await expect(second).resolves.toEqual({ keyframes: [40, 50], finalKeyframe: "auto" })
  height.settled()
  await height.ready
  expect(h.backend).toHaveBeenCalledTimes(2)
  expect(JSON.parse(h.backend.mock.calls[1][0]).properties).toEqual(["height"])
  complete(JSON.stringify(h.response(h.backend.mock.calls[0][0])))
  await turn()
  expect(jest.getTimerCount()).toBe(0)
  expect(one.size()).toBe(0)
  expect(two.size()).toBe(0)
  h.release()
})

it("copies requested metric names before asynchronous native reads", async () => {
  const h = harness(),
    properties = ["width"]
  const pending = resolveNativeMotionIsolatedLayout(h.target, stages, properties, h.token)
  properties.push("height")
  await pending
  expect(JSON.parse(h.backend.mock.calls[0][0]).properties).toEqual(["width"])
  h.release()
})

it("uses the authoritative owner stage builder to retain current unrelated transform components", async () => {
  const h = harness()
  const buildStage = jest.fn((patch: Readonly<Record<string, unknown>>) => ({
    ...patch,
    transform: [{ translateY: 9 }, { rotateZ: "0deg" }],
    transformOrigin: ["25%", "75%", 0],
  }))
  const state = new NativeMotionIsolatedGeometryState(buildStage)
  const pending = state.resolve(h.target, "height", [40, "auto"], h.token)
  await turn()
  await expect(pending).resolves.toEqual({ keyframes: [40, 50], finalKeyframe: "auto" })
  expect(buildStage.mock.calls).toEqual([[{}], [{ height: "auto" }]])
  const request = JSON.parse(h.backend.mock.calls[0][0])
  expect(request.stages[1].nativeView).toEqual({
    height: "auto",
    transform: [{ translateY: 9 }, { rotateZ: "0deg" }],
    transformOrigin: ["25%", "75%", 0],
  })
  h.release()
})

it("releases a stalled normalization wait at the job deadline and continues fresh work", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState()
  const stalled = {
    normalized: () => {},
    settled: () => {},
    whenNormalized: new Promise<void>(() => {}),
    ready: new Promise<void>(() => {}),
    capture: () => {
      throw new Error("unreached capture")
    },
  }
  const pending = state.resolve(h.target, "height", [40, "auto"], h.token, stalled)
  const rejected = expect(pending).rejects.toThrow("5000ms")
  await turn()
  jest.advanceTimersByTime(5000)
  await rejected
  const fresh = state.resolve(h.target, "height", [40, "auto"], h.token)
  await turn()
  await expect(fresh).resolves.toEqual({ keyframes: [40, 50], finalKeyframe: "auto" })
  expect(h.backend).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it("retains valid optional native shadow fields as absent rather than inventing metrics", () => {
  const endpoint = Object.freeze([{ offsetX: 2, offsetY: 4, blurRadius: undefined }])
  expect(normalizeNativeMotionKeyframeUnits("boxShadow", [endpoint])).toEqual([[{ offsetX: 2, offsetY: 4 }]])
  expect(endpoint[0]).toHaveProperty("blurRadius", undefined)
})

it("measures the actual native origin without publishing an authored first keyframe into scratch layout", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState(),
    probe = jest.fn()
  const pending = state.resolve(h.target, "width", [10, "auto"], h.token, undefined, probe)
  await turn()
  await expect(pending).resolves.toEqual({ keyframes: [100, 200], finalKeyframe: "auto" })
  expect(JSON.parse(h.backend.mock.calls[0][0]).stages[0].nativeView).toEqual({})
  expect(probe.mock.calls).toEqual([
    ["auto", "target"],
    [100, "restored"],
  ])
  h.release()
})

it("preserves numeric strings and native offset representations for actual native authority", () => {
  expect(normalizeNativeMotionKeyframeUnits("width", [0, "10"])).toEqual([0, "10"])
  expect(normalizeNativeMotionKeyframeUnits("opacity", ["0.1", "1e0"])).toEqual(["0.1", "1e0"])
  const offset = Object.freeze({ width: "0", height: 2 })
  expect(normalizeNativeMotionKeyframeUnits("shadowOffset", [offset])[0]).toBe(offset)
})

it("sends mixed numeric/native-string width to the real evaluator and preserves its unit error", async () => {
  const h = harness(),
    state = new NativeMotionIsolatedGeometryState()
  h.backend.mockRejectedValue(new Error("Native motion evaluator: width: unsupported-native-unit"))
  const pending = state.resolve(h.target, "width", [0, "10"], h.token)
  const rejected = expect(pending).rejects.toThrow("unsupported-native-unit")
  await turn()
  await rejected
  expect(h.backend).toHaveBeenCalledTimes(1)
  expect(JSON.parse(h.backend.mock.calls[0][0]).stages).toEqual([
    { index: 0, nativeView: {} },
    { index: 1, nativeView: { width: "10" } },
  ])
  h.release()
})
