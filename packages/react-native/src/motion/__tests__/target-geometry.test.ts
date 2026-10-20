import { TurboModuleRegistry } from "react-native"
import type { View } from "react-native"

import { geometryPacket, geometrySnapshot } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { readNativeMotionTargetGeometry } from "../measurement/targetGeometry"

// Explicit ref/native module models exercise guards only; no native geometry is measured here.
const harness = (acknowledge = true) => {
  const owner = { isConnected: true } as unknown as View,
    target = { isConnected: true } as unknown as View
  let live = true,
    tag = 72,
    revision = 0,
    scope = { ownerId: "scope", windowId: "window", epoch: 2 }
  const listeners = new Set<() => void>()
  const observer = new NativeMotionGeometryObserver({
    ownerId: "owner",
    bindingId: "binding",
    target: () => 71,
    scope: () => scope,
    dispatch: (requestId) => {
      if (acknowledge) observer.receive(geometryPacket({ requestId, geometryRevision: ++revision }))
    },
  })
  const release = registerNativeMotionGeometryObserver(owner, observer)
  const snapshot = () => ({ ...geometrySnapshot(), mountObservationAvailable: false })
  const response = (encoded: string) => {
    const request = JSON.parse(encoded),
      targetSnapshot = snapshot()
    targetSnapshot.ancestors[0] = { ...targetSnapshot.ancestors[0], tag: 72, identity: "fixture-constraint-view" }
    return { ...request, kind: "native-target-geometry", ownerSnapshot: snapshot(), targetSnapshot, observedAt: 120 }
  }
  const backend = jest.fn(async (encoded: string) => JSON.stringify(response(encoded)))
  const registry = jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ getTargetGeometry: backend } as never)
  const nativeTag = jest
    .spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle")
    .mockImplementation((view: unknown) => (view === target ? tag : 71))
  const token = {
    isCurrent: () => live,
    onCancel: (callback: () => void) => {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
  }
  return {
    owner,
    target,
    backend,
    registry,
    token,
    release,
    response,
    listeners,
    nativeTag,
    changeTag: () => {
      tag++
    },
    disconnect: () => {
      ;(target as unknown as { isConnected: boolean }).isConnected = false
    },
    retire: () => {
      live = false
      ;[...listeners].forEach((callback) => callback())
    },
    moveWindow: () => {
      scope = { ...scope, windowId: "next", epoch: 3 }
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

it("uses the registered owner and original connected target, keeping query snapshots separate and immutable", async () => {
  const h = harness()
  const result = await readNativeMotionTargetGeometry(h.owner, h.target, h.token)
  expect(JSON.parse(h.backend.mock.calls[0][0])).toMatchObject({
    target: 71,
    sampleTarget: 72,
    nativeOwnerIdentity: "fixture-native-view",
    windowId: "window",
    attachmentRevision: 1,
  })
  expect(result.ownerSnapshot.ancestors[0].tag).toBe(71)
  expect(result.targetSnapshot.ancestors[0].tag).toBe(72)
  expect(result.targetSnapshot.mountObservationAvailable).toBe(false)
  expect(Object.isFrozen(result)).toBe(true)
  expect(Object.isFrozen(result.targetSnapshot.ancestors)).toBe(true)
  expect(h.listeners.size).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
  h.release()
})

it.each([
  ["ownerId", "other"],
  ["bindingId", "other"],
  ["target", 999],
  ["sampleTarget", 999],
  ["windowId", "other"],
  ["scopeOwnerId", "other"],
  ["epoch", 3],
  ["attachmentRevision", 2],
  ["nativeViewRevision", "other"],
  ["nativeOwnerIdentity", "other"],
  ["requestId", "old"],
  ["kind", "fabric-input"],
  ["observedAt", null],
  ["observedAt", -1],
])("rejects a foreign/malformed %s", async (key, value) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => JSON.stringify({ ...h.response(encoded), [key as string]: value }))
  await expect(readNativeMotionTargetGeometry(h.owner, h.target, h.token)).rejects.toThrow()
  expect(jest.getTimerCount()).toBe(0)
  expect(h.listeners.size).toBe(0)
  h.release()
})

it.each([
  "owner-tag",
  "owner-native-identity",
  "target-tag",
  "window",
  "platform",
  "density",
  "invalid-target",
  "missing-target",
])("rejects incompatible native %s geometry", async (kind) => {
  const h = harness()
  h.backend.mockImplementation(async (encoded) => {
    const value = h.response(encoded)
    if (kind === "owner-tag") value.ownerSnapshot.ancestors[0].tag = 999
    if (kind === "owner-native-identity") value.ownerSnapshot.ancestors[0].identity = "replacement"
    if (kind === "target-tag") value.targetSnapshot.ancestors[0].tag = 999
    if (kind === "window") value.targetSnapshot.rootIdentity = "other-window"
    if (kind === "platform") Object.assign(value.targetSnapshot, geometrySnapshot("ios"))
    if (kind === "density") value.targetSnapshot.density = 3
    if (kind === "invalid-target") value.targetSnapshot.layout = [0, 0, -1, 10]
    if (kind === "missing-target") Object.assign(value, { targetSnapshot: null })
    return JSON.stringify(value)
  })
  await expect(readNativeMotionTargetGeometry(h.owner, h.target, h.token)).rejects.toThrow()
  h.release()
})

it.each(["cancel", "window", "remove", "disconnect", "tag"])(
  "retires %s and ignores a late native reply",
  async (reason) => {
    const h = harness()
    let complete!: (value: string) => void
    h.backend.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve
        }),
    )
    const pending = readNativeMotionTargetGeometry(h.owner, h.target, h.token)
    await turn()
    const rejection = expect(pending).rejects.toThrow()
    if (reason === "cancel") h.retire()
    if (reason === "window") h.moveWindow()
    if (reason === "remove") h.release()
    if (reason === "disconnect") h.disconnect()
    if (reason === "tag") h.changeTag()
    complete(JSON.stringify(h.response(h.backend.mock.calls[0][0])))
    await rejection
    expect(h.listeners.size).toBe(0)
    expect(jest.getTimerCount()).toBe(0)
    h.release()
  },
)

it.each([false, true])("retains one total 5000ms deadline with native phase=%s", async (nativePhase) => {
  const h = harness(nativePhase)
  h.backend.mockImplementation(() => new Promise<string>(() => {}))
  const result = expect(readNativeMotionTargetGeometry(h.owner, h.target, h.token)).rejects.toThrow(/5000ms/)
  await turn()
  jest.advanceTimersByTime(5000)
  await result
  expect(jest.getTimerCount()).toBe(0)
  expect(h.listeners.size).toBe(0)
  h.release()
})

it("rejects missing native capability and disconnected refs before using stand-in geometry", async () => {
  const h = harness()
  h.registry.mockReturnValue({} as never)
  await expect(readNativeMotionTargetGeometry(h.owner, h.target, h.token)).rejects.toThrow(/module unavailable/)
  h.disconnect()
  await expect(readNativeMotionTargetGeometry(h.owner, h.target, h.token)).rejects.toThrow(/connected refs unavailable/)
  expect(h.backend).not.toHaveBeenCalled()
  h.release()
})
