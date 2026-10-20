import { TurboModuleRegistry, type View } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { captureNativeMotionFabricInput } from "../measurement/fabricInput"

// Synthetic bridge/native packets prove receiver lifetime and data guards only.
const harness = (acknowledge = true) => {
  const target = {} as View,
    listeners = new Set<() => void>()
  let active = true,
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
  const release = registerNativeMotionGeometryObserver(target, observer)
  const backend = jest.fn(async (encoded: string) =>
    JSON.stringify({
      ...JSON.parse(encoded),
      kind: "fabric-input",
      surfaceId: 1,
      fabricRevision: "9",
      fabricTargetFrame: [1.25, 2.5, 120, 40],
    }),
  )
  const registry = jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getSnapshot: backend } as never)
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
    release,
    listeners,
    retire: () => {
      active = false
      ;[...listeners].forEach((callback) => callback())
    },
    moveWindow: () => {
      scope = { ...scope, windowId: "replacement", epoch: 3 }
      observer.refreshScope()
    },
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

it("uses the actual registered view lease and freezes separate Fabric input data", async () => {
  const h = harness()
  const result = await captureNativeMotionFabricInput(h.target, h.token)
  expect(h.registry).toHaveBeenCalledWith("CUIMotionSnapshot")
  expect(JSON.parse(h.backend.mock.calls[0][0])).toMatchObject({
    ownerId: "owner",
    bindingId: "binding",
    target: 71,
    windowId: "window",
    scopeOwnerId: "scope",
    epoch: 2,
  })
  expect(result).toMatchObject({
    kind: "fabric-input",
    surfaceId: 1,
    fabricRevision: "9",
    fabricTargetFrame: [1.25, 2.5, 120, 40],
  })
  expect(Object.isFrozen(result)).toBe(true)
  expect(Object.isFrozen(result.fabricTargetFrame)).toBe(true)
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
  ["surfaceId", 0],
  ["surfaceId", 1.5],
  ["fabricRevision", "01"],
  ["fabricRevision", 9],
  ["fabricTargetFrame", [0, 0, -1, 10]],
  ["fabricTargetFrame", [0, 0, null, 10]],
  ["fabricTargetFrame", [0, 0, 10]],
])("rejects a foreign or malformed %s without publishing it", async (key, value) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) =>
    JSON.stringify({
      ...JSON.parse(encoded),
      kind: "fabric-input",
      surfaceId: 1,
      fabricRevision: "9",
      fabricTargetFrame: [0, 0, 120, 40],
      [key as string]: value,
    }),
  )
  await expect(captureNativeMotionFabricInput(h.target, h.token)).rejects.toThrow()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it("fails explicitly when the installed private module is unavailable", async () => {
  const h = harness()
  h.registry.mockReturnValue(null)
  await expect(captureNativeMotionFabricInput(h.target, h.token)).rejects.toThrow("native snapshot module unavailable")
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it.each(["cancel", "window", "remove"])("rejects %s while ignoring its late native reply", async (reason) => {
  const h = harness()
  let complete!: (value: string) => void
  h.backend.mockImplementation(
    () =>
      new Promise<string>((resolve) => {
        complete = resolve
      }),
  )
  const pending = captureNativeMotionFabricInput(h.target, h.token)
  await turn()
  const rejection = expect(pending).rejects.toThrow()
  if (reason === "cancel") h.retire()
  else if (reason === "window") h.moveWindow()
  else h.release()
  await rejection
  complete(
    JSON.stringify({
      ...JSON.parse(h.backend.mock.calls[0][0]),
      kind: "fabric-input",
      surfaceId: 1,
      fabricRevision: "9",
      fabricTargetFrame: [0, 0, 120, 40],
    }),
  )
  await turn()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  if (reason !== "remove") h.release()
})

it("retires pending module work at the unchanged five-second deadline", async () => {
  const h = harness()
  h.backend.mockImplementation(() => new Promise(() => {}))
  const pending = captureNativeMotionFabricInput(h.target, h.token)
  const rejection = expect(pending).rejects.toThrow("5000ms")
  await turn()
  jest.advanceTimersByTime(5000)
  await rejection
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it("cancels a pending baseline query at the same deadline without loading the module", async () => {
  const h = harness(false)
  const pending = captureNativeMotionFabricInput(h.target, h.token)
  const rejection = expect(pending).rejects.toThrow("5000ms")
  jest.advanceTimersByTime(5000)
  await rejection
  expect(h.registry).not.toHaveBeenCalled()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it("releases baseline cancellation and geometry listeners on immediate owner retirement", async () => {
  const h = harness(false)
  const pending = captureNativeMotionFabricInput(h.target, h.token)
  const rejection = expect(pending).rejects.toThrow("owner cancelled")
  h.retire()
  await rejection
  expect(h.registry).not.toHaveBeenCalled()
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})
