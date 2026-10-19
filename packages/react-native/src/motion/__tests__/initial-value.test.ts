import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionColorSampler, registerNativeMotionColorSampler } from "../../input/motionColors"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { readNativeMotionInitialValue } from "../measurement/initialValue"

// Explicit ref/bridge/trait models exercise source guards, not installed native reads.
const harness = (acknowledge = true) => {
  const target = { isConnected: true } as unknown as View,
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
  const response = (encoded: string, value: unknown = 0.75) => ({
    ...JSON.parse(encoded),
    kind: "native-initial-value",
    surfaceId: 1,
    fabricRevision: "9",
    value,
  })
  const backend = jest.fn(async (encoded: string) => JSON.stringify(response(encoded)))
  const registry = jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getInitialValue: backend } as never)
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
  for (let index = 0; index < 8; index++) await Promise.resolve()
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("queries the actual original registered owner and releases every request resource", async () => {
  const h = harness()
  await expect(readNativeMotionInitialValue(h.target, "opacity", 1, h.token)).resolves.toBe(0.75)
  expect(JSON.parse(h.backend.mock.calls[0][0])).toMatchObject({
    name: "opacity",
    ownerId: "owner",
    bindingId: "binding",
    target: 71,
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
    attachmentRevision: 1,
    nativeViewRevision: "initial",
  })
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it.each([
  ["ownerId", "other"],
  ["bindingId", "other"],
  ["target", 72],
  ["windowId", "other"],
  ["scopeOwnerId", "other"],
  ["epoch", 3],
  ["attachmentRevision", 99],
  ["nativeViewRevision", "other"],
  ["requestId", "old"],
  ["kind", "mount-after"],
  ["name", "width"],
  ["surfaceId", 0],
  ["surfaceId", 1.5],
  ["fabricRevision", "01"],
  ["fabricRevision", 9],
  ["value", null],
  ["value", { shadowOffset: { width: null } }],
  ["value", { constructor: "invalid" }],
])("rejects malformed or foreign %s without publishing a value", async (key, value) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => JSON.stringify({ ...h.response(encoded), [key as string]: value }))
  await expect(readNativeMotionInitialValue(h.target, "opacity", 1, h.token)).rejects.toThrow()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it.each([
  ["backgroundColor", "rgba(20, 30, 40, 0.5)"],
  ["shadowOffset", { width: 0, height: -3 }],
  ["transform", [{ translateX: "25%" }, { rotateZ: "0.2rad" }]],
  ["fontVariant", ["tabular-nums", "stylistic-twenty"]],
  [
    "filter",
    [{ blur: 2 }, { dropShadow: { offsetX: 1, offsetY: 2, standardDeviation: 3, color: "rgba(0, 0, 0, 1)" } }],
  ],
  ["includeFontPadding", false],
])("retains native %s structured values and resolved colors", async (name, value) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => JSON.stringify(h.response(encoded, value)))
  await expect(readNativeMotionInitialValue(h.target, name as string, value, h.token)).resolves.toEqual(value)
  h.release()
})

it.each([
  ["90deg", "45deg"],
  ["1rad", `${Math.PI / 4}rad`],
  [90, 45],
])("uses the angle endpoint's %s unit", async (endpoint, initial) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => JSON.stringify(h.response(encoded, 45)))
  await expect(readNativeMotionInitialValue(h.target, "rotate", endpoint, h.token)).resolves.toBe(initial)
  h.release()
})

it.each(["cancel", "window", "revision", "remove", "colors", "tag", "disconnect"])(
  "retires %s and ignores the late module reply",
  async (reason) => {
    const h = harness()
    let complete!: (encoded: string) => void
    h.backend.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const pending = readNativeMotionInitialValue(h.target, "opacity", 1, h.token)
    await turn()
    const rejection = expect(pending).rejects.toThrow()
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

it.each([true, false])("bounds pending baseline/module work at 5000ms (baseline %s)", async (acknowledge) => {
  const h = harness(acknowledge)
  h.backend.mockImplementation(() => new Promise(() => {}))
  const pending = readNativeMotionInitialValue(h.target, "opacity", 1, h.token)
  const rejection = expect(pending).rejects.toThrow("5000ms")
  await turn()
  jest.advanceTimersByTime(5000)
  await rejection
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  if (!acknowledge) expect(h.registry).not.toHaveBeenCalled()
  h.release()
})

it("preserves explicit unsupported native field errors", async () => {
  const h = harness()
  h.backend.mockRejectedValue(new Error("Native motion initial value: lineHeight: native-font-metric-unavailable"))
  await expect(readNativeMotionInitialValue(h.target, "lineHeight", 20, h.token)).rejects.toThrow(
    "native-font-metric-unavailable",
  )
  h.release()
})

it("requires the installed module and an already connected original ref", async () => {
  const h = harness()
  h.registry.mockReturnValue(null)
  await expect(readNativeMotionInitialValue(h.target, "opacity", 1, h.token)).rejects.toThrow("module unavailable")
  h.disconnect()
  await expect(readNativeMotionInitialValue(h.target, "opacity", 1, h.token)).rejects.toThrow("connected native owner")
  h.release()
})
