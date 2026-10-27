import type { View } from "react-native"

import {
  requireNativeMotionGeometryCapabilities,
  decodeNativeMotionGeometry,
  NativeMotionGeometryObserver,
  nativeMotionGeometryHistory,
  observeNativeMotionGeometry,
  readNativeMotionGeometry,
  registerNativeMotionGeometryObserver,
} from "../motionGeometry"

import { geometryHarness, geometryPacket, geometrySnapshot } from "./motionGeometry.fixture"

afterEach(() => jest.useRealTimers())
it.each(["android", "ios"] as const)(
  "retains optional resolved %s content boxes without inferring missing metrics",
  (platform) => {
    const original = geometrySnapshot(platform)
    expect(decodeNativeMotionGeometry(JSON.stringify(original)).contentBox).toBeUndefined()
    const snapshot = decodeNativeMotionGeometry(JSON.stringify({ ...original, contentBox: [12, 14, 74, 22] }))
    expect(snapshot.contentBox).toEqual([12, 14, 74, 22])
    expect(Object.isFrozen(snapshot.contentBox)).toBe(true)
    for (const contentBox of [[0, 0, -1, 20], [0, 0, 20], "viewport"])
      expect(() => decodeNativeMotionGeometry(JSON.stringify({ ...original, contentBox }))).toThrow(
        /partial native geometry/,
      )
    expect(decodeNativeMotionGeometry(JSON.stringify({ ...original, contentBox: null })).contentBox).toBeNull()
  },
)
it.each(["android", "ios"] as const)(
  "decodes truthful %s boxes, matrices and presentation availability",
  (platform) => {
    const snapshot = decodeNativeMotionGeometry(JSON.stringify(geometrySnapshot(platform)))
    expect(snapshot.platform).toBe(platform)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.ancestors[0].matrix)).toBe(true)
    expect(snapshot.presentation === null).toBe(platform === "ios")
  },
)
it.each([
  "missing-root",
  "negative-layout",
  "partial-matrix",
  "no-ancestors",
  "wrong-units",
  "nonfinite",
  "missing-layer",
])("rejects partial or inconsistent snapshot %s", (condition) => {
  const value: Record<string, unknown> = geometrySnapshot(condition === "missing-layer" ? "ios" : "android")
  if (condition === "missing-root") delete value.root
  if (condition === "negative-layout") value.layout = [0, 0, -1, 10]
  if (condition === "partial-matrix") (value.ancestors as Array<Record<string, unknown>>)[0].matrix = [1, 0, 1]
  if (condition === "no-ancestors") value.ancestors = []
  if (condition === "wrong-units") value.units = "pixels"
  if (condition === "missing-layer") delete value.layers
  const encoded =
    condition === "nonfinite" ? JSON.stringify(value).replace('"density":2', '"density":1e999') : JSON.stringify(value)
  expect(() => decodeNativeMotionGeometry(encoded)).toThrow(/native/)
})
it("retains unresolved clipping as an explicit capability gap", () => {
  const value = geometrySnapshot()
  value.ancestors[0].clip.complete = false
  expect(decodeNativeMotionGeometry(JSON.stringify(value)).ancestors[0].clip.complete).toBe(false)
})
it("resolves only its actual request and commit revision", async () => {
  const h = geometryHarness(),
    read = h.observer.read(undefined, "next"),
    id = h.dispatch.mock.calls[0][0]
  h.receive({ requestId: "other", commitRevision: "next" })
  h.receive({ requestId: id, commitRevision: "next" })
  await expect(read).resolves.toMatchObject({ requestId: id, commitRevision: "next", snapshot: { units: "dp" } })
  h.observer.dispose()
})
it("rejects a query at the wrong acknowledged commit without relabelling its geometry", async () => {
  const h = geometryHarness(),
    pending = h.observer.read(undefined, "required"),
    failure = expect(pending).rejects.toThrow(/commit revision/)
  h.receive({ requestId: h.dispatch.mock.calls[0][0], commitRevision: "other" })
  await failure
  expect(h.observer.latest()?.commitRevision).toBe("other")
  h.observer.dispose()
})
it.each(["ownerId", "bindingId", "target"])("ignores foreign %s before accepting a matching sample", async (field) => {
  const h = geometryHarness(),
    pending = h.observer.read(),
    id = h.dispatch.mock.calls[0][0]
  h.receive({ requestId: id, [field]: field === "target" ? 72 : "foreign" })
  expect(h.observer.latest()).toBeUndefined()
  h.receive({ requestId: id })
  await pending
  h.observer.dispose()
})
it("pairs actual before/after records only within one native transaction and attachment", () => {
  const h = geometryHarness(),
    listener = jest.fn()
  h.observer.subscribeMountPairs(listener)
  h.receive({ kind: "mount-before", transactionId: "batch", commitRevision: "before" })
  h.receive({ kind: "frame" })
  h.receive({ kind: "mount-after", transactionId: "batch", commitRevision: "after" })
  expect(listener).toHaveBeenCalledTimes(1)
  expect(listener.mock.calls[0][0]).toMatchObject({
    before: { commitRevision: "before", kind: "mount-before" },
    after: { commitRevision: "after", kind: "mount-after" },
  })
  h.receive({ kind: "mount-after", transactionId: "no-before" })
  expect(listener).toHaveBeenCalledTimes(1)
  h.receive({ kind: "mount-before", transactionId: "changed" })
  h.receive({ kind: "mount-after", transactionId: "changed", attachmentRevision: 2 })
  expect(listener).toHaveBeenCalledTimes(1)
  expect(h.observer.latestMountPair()).toBeUndefined()
  h.observer.dispose()
})
it("discards pre-mount geometry after the actual root coordinate identity changes", () => {
  const h = geometryHarness(),
    listener = jest.fn()
  h.observer.subscribeMountPairs(listener)
  h.receive({ kind: "mount-before", transactionId: "batch" })
  h.receive({
    kind: "mount-after",
    transactionId: "batch",
    snapshot: JSON.stringify({ ...geometrySnapshot(), rootIdentity: "replacement-root" }),
  })
  expect(listener).not.toHaveBeenCalled()
  h.observer.dispose()
})
it("does not create a before box for a newly mounted owner", () => {
  const h = geometryHarness(),
    listener = jest.fn()
  h.observer.subscribeMountPairs(listener)
  h.receive({ kind: "mount-after", transactionId: "entry" })
  expect(h.observer.latest()).toBeDefined()
  expect(h.observer.latestMountPair()).toBeUndefined()
  expect(listener).not.toHaveBeenCalled()
  h.observer.dispose()
})
it("rejects stale native query revisions and ignores older unsolicited frames", async () => {
  const h = geometryHarness()
  h.receive({ geometryRevision: 10 })
  const pending = h.observer.read(),
    failure = expect(pending).rejects.toThrow(/stale/)
  h.receive({ requestId: h.dispatch.mock.calls[0][0], geometryRevision: 9 })
  await failure
  h.receive({ geometryRevision: 8 })
  expect(h.observer.latest()?.geometryRevision).toBe(10)
  h.observer.dispose()
})
it("invalidates acknowledged-scope work and ignores old-scope reports", async () => {
  const h = geometryHarness(),
    pending = h.observer.read(),
    failure = expect(pending).rejects.toThrow(/scope changed/)
  h.receive()
  h.scope({ ownerId: "scope", windowId: "next-window", epoch: 3 })
  h.observer.refreshScope()
  await failure
  h.receive({ kind: "frame" })
  expect(h.observer.latest()).toBeUndefined()
  h.receive({ kind: "frame", windowId: "next-window", epoch: 3 })
  expect(h.observer.latest()?.epoch).toBe(3)
  h.observer.dispose()
})
it("retires all in-flight work when the actual native view detaches", async () => {
  const h = geometryHarness(),
    pending = h.observer.read(),
    failure = expect(pending).rejects.toThrow(/detached/)
  h.receive({
    kind: "detached",
    attached: false,
    attachmentRevision: 2,
    snapshot: "",
    error: "native-geometry-view-detached",
  })
  await failure
  expect(h.observer.latest()).toBeUndefined()
  h.observer.dispose()
})
it("releases cancellation and timeout work independently for concurrent queries", async () => {
  jest.useFakeTimers()
  const h = geometryHarness(),
    callbacks = new Set<() => void>()
  const token = {
    isCurrent: () => true,
    onCancel: (callback: () => void) => {
      callbacks.add(callback)
      return () => {
        callbacks.delete(callback)
      }
    },
  }
  const first = h.observer.read(token),
    failure = expect(first).rejects.toThrow(/cancelled/),
    second = h.observer.read()
  callbacks.forEach((callback) => callback())
  await failure
  expect(callbacks.size).toBe(0)
  expect(jest.getTimerCount()).toBe(1)
  h.receive({ requestId: h.dispatch.mock.calls[1][0] })
  await second
  expect(jest.getTimerCount()).toBe(0)
  h.observer.dispose()
})
it("uses the fixed timeout without replay and releases a query on disposal", async () => {
  jest.useFakeTimers()
  const h = geometryHarness(),
    first = h.observer.read(),
    failure = expect(first).rejects.toThrow(/5000ms/)
  jest.advanceTimersByTime(5000)
  await failure
  expect(h.dispatch).toHaveBeenCalledTimes(1)
  const second = h.observer.read(),
    disposed = expect(second).rejects.toThrow(/retired/)
  h.observer.dispose()
  await disposed
  expect(jest.getTimerCount()).toBe(0)
})
it("rejects native errors and malformed data without retaining a stale latest snapshot", async () => {
  const h = geometryHarness()
  h.receive()
  const pending = h.observer.read(),
    failure = expect(pending).rejects.toThrow(/native-failure/)
  h.receive({ requestId: h.dispatch.mock.calls[0][0], snapshot: "", error: "native-failure" })
  await failure
  expect(h.observer.latest()).toBeUndefined()
  h.receive()
  h.receive({ kind: "frame", snapshot: "{}" })
  expect(h.observer.latest()).toBeUndefined()
  h.observer.dispose()
})
it("keeps registrations and remembered revisions bound to the actual View", async () => {
  const target = {} as View,
    dispatch = jest.fn(),
    options = {
      ownerId: "owner",
      bindingId: "binding",
      target: () => 71,
      scope: () => ({ ownerId: "scope", windowId: "window", epoch: 2 }),
      dispatch,
      ...nativeMotionGeometryHistory(target),
    }
  const first = new NativeMotionGeometryObserver(options),
    releaseFirst = registerNativeMotionGeometryObserver(target, first)
  first.receive(geometryPacket({ geometryRevision: 100 }))
  const second = new NativeMotionGeometryObserver(options),
    releaseSecond = registerNativeMotionGeometryObserver(target, second)
  const listener = jest.fn(),
    unsubscribe = observeNativeMotionGeometry(target, listener)
  releaseFirst()
  const pending = readNativeMotionGeometry(target)
  second.receive(geometryPacket({ geometryRevision: 99 }))
  expect(listener).not.toHaveBeenCalled()
  second.receive(geometryPacket({ geometryRevision: 101, requestId: dispatch.mock.calls[0][0] }))
  await pending
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  releaseSecond()
  await expect(readNativeMotionGeometry(target)).rejects.toThrow(/no observer/)
})
it("requires real presentation, clipping and mount capabilities at their consumption boundary", () => {
  const ios = geometrySnapshot("ios")
  const record = { ...geometryPacket(), snapshot: decodeNativeMotionGeometry(JSON.stringify(ios)) }
  expect(() => requireNativeMotionGeometryCapabilities(record, { presentation: true })).toThrow(/presentation/)
  const unavailable = { ...geometrySnapshot(), mountObservationAvailable: false }
  unavailable.ancestors[0].clip.complete = false
  const partial = { ...geometryPacket(), snapshot: decodeNativeMotionGeometry(JSON.stringify(unavailable)) }
  expect(() => requireNativeMotionGeometryCapabilities(partial, { clipping: true })).toThrow(/clipping/)
  expect(() => requireNativeMotionGeometryCapabilities(partial, { mount: true })).toThrow(/mount/)
})
it("delivers the captured mount pair when an earlier listener invalidates the live scope", () => {
  const h = geometryHarness(),
    second = jest.fn(),
    current = jest.fn()
  h.observer.subscribe(current)
  h.observer.subscribeMountPairs(() => {
    h.scope({ ownerId: "scope", windowId: "replacement-window", epoch: 3 })
    h.observer.refreshScope()
  })
  h.observer.subscribeMountPairs(second)
  h.receive({ kind: "mount-before", transactionId: "cohort" })
  h.receive({ kind: "mount-after", transactionId: "cohort" })
  expect(second.mock.calls[0][0]).toMatchObject({
    before: { transactionId: "cohort", windowId: "window" },
    after: { transactionId: "cohort", windowId: "window" },
  })
  expect(h.observer.latestMountPair()).toBeUndefined()
  expect(current.mock.calls.at(-1)?.[0]).toBeUndefined()
  h.observer.dispose()
})
