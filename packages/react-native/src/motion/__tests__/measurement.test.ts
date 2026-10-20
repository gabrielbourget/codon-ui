import type { TNativeMotionGeometryRecord } from "../../input/motionGeometry"

import { measurementHarness, measurementToken, measurementTurn } from "./measurement.fixture"

const width = (record: TNativeMotionGeometryRecord) => record.snapshot!.layout[2]
const height = (record: TNativeMotionGeometryRecord) => record.snapshot!.layout[3]
afterEach(() => jest.useRealTimers())
it("aborts a foreign atomic lease without publishing styles on the actual owner", async () => {
  const abort = jest.fn(async () => {}),
    release = jest.fn(async () => {}),
    token = measurementToken()
  const h = measurementHarness({
    provider: { begin: async () => ({ target: {} as never, abort, release }) },
  })
  await expect(h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })).rejects.toThrow(
    "atomic layout lease belongs to another owner",
  )
  expect(abort).toHaveBeenCalledTimes(1)
  expect(release).not.toHaveBeenCalled()
  expect(h.trace.every((event) => (event as unknown[])[2] === undefined)).toBe(true)
  expect(token.size()).toBe(0)
  h.dispose()
})
it("restores after a publication subscriber fails and still notifies the remaining subscribers", async () => {
  const h = measurementHarness(),
    token = measurementToken(),
    observed = jest.fn()
  let fail = true
  h.state.subscribe(() => {
    if (fail && h.state.getSnapshot().values) {
      fail = false
      throw new Error("probe subscriber failed")
    }
  })
  h.state.subscribe(observed)
  await expect(h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })).rejects.toThrow(
    "probe subscriber failed",
  )
  expect(observed).toHaveBeenCalledTimes(3)
  expect(h.trace.filter((event) => (event as unknown[])[0] === "release")).toHaveLength(1)
  expect(h.held()).toBe(false)
  expect(h.state.getSnapshot().values).toBeNull()
  expect(token.size()).toBe(0)
  h.dispose()
})
it("aborts the atomic session when restoration publication fails", async () => {
  const h = measurementHarness(),
    token = measurementToken()
  h.state.subscribe(() => {
    const snapshot = h.state.getSnapshot()
    if (snapshot.values === null && snapshot.revision) throw new Error("restoration subscriber failed")
  })
  await expect(h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })).rejects.toThrow(
    "restoration subscriber failed",
  )
  expect(h.trace.filter((event) => (event as unknown[])[0] === "release")).toHaveLength(0)
  expect(h.trace.filter((event) => (event as unknown[])[0] === "abort")).toHaveLength(1)
  expect(h.held()).toBe(false)
  expect(token.size()).toBe(0)
  h.dispose()
})
it("settles failures from idle publication and continues queued measurements", async () => {
  const h = measurementHarness(),
    token = measurementToken()
  let fail = true
  h.state.subscribe(() => {
    if (fail && !h.state.getSnapshot().revision) {
      fail = false
      throw new Error("idle subscriber failed")
    }
  })
  const first = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })
  const second = h.state.measure({ name: "width", keyframes: [120, "50%"], metric: width, token })
  await expect(first).rejects.toThrow("idle subscriber failed")
  await expect(second).resolves.toEqual({ keyframes: [120, 200], finalKeyframe: "50%" })
  expect(h.trace.filter((event) => (event as unknown[])[0] === "release")).toHaveLength(2)
  expect(h.held()).toBe(false)
  expect(token.size()).toBe(0)
  h.dispose()
})
it("fails before style publication when actual native atomic layout is unavailable", async () => {
  const h = measurementHarness({ omitProvider: true }),
    token = measurementToken()
  await expect(h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })).rejects.toThrow(
    /atomic layout provider unavailable/,
  )
  expect(h.trace).toEqual([])
  expect(h.state.getSnapshot().values).toBeNull()
  h.dispose()
})
it("measures endpoints only from acknowledged native commits and restores before release/result", async () => {
  const h = measurementHarness(),
    token = measurementToken(),
    probe = jest.fn()
  const result = await h.state.measure({
    name: "width",
    keyframes: [120, "auto"],
    metric: width,
    token,
    onProbe: probe,
  })
  expect(result).toEqual({ keyframes: [120, 200], finalKeyframe: "auto" })
  expect(h.trace.map((event) => (event as unknown[])[0])).toEqual([
    "begin",
    "render",
    "render",
    "render",
    "release",
    "render",
  ])
  expect(
    h.trace
      .filter((event) => (event as unknown[])[0] === "render")
      .slice(0, 3)
      .every((event) => (event as unknown[])[3] === true),
  ).toBe(true)
  expect(probe.mock.calls).toEqual([
    [120, "initial"],
    ["auto", "target"],
    [120, "restored"],
  ])
  expect(token.size()).toBe(0)
  expect(h.held()).toBe(false)
  expect(h.state.getSnapshot().values).toBeNull()
  h.dispose()
})
it("batches coupled properties and all keyframes in the same owned model stages", async () => {
  const h = measurementHarness(),
    token = measurementToken()
  const first = h.state.measure({ name: "width", keyframes: [120, "50%", "auto"], metric: width, token })
  const second = h.state.measure({ name: "height", keyframes: [40, "auto"], metric: height, token })
  await expect(first).resolves.toEqual({ keyframes: [120, 200, 200], finalKeyframe: "auto" })
  await expect(second).resolves.toEqual({ keyframes: [40, 200], finalKeyframe: "auto" })
  const probes = h.trace.filter((event) => (event as unknown[])[0] === "render").map((event) => (event as unknown[])[1])
  expect(probes.slice(0, 3)).toEqual([
    { width: 120, height: 40 },
    { width: "50%", height: "auto" },
    { width: "auto", height: "auto" },
  ])
  h.dispose()
})
it("does not let two requests for the same property overwrite each other's model stage", async () => {
  const h = measurementHarness(),
    token = measurementToken()
  const first = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token })
  const second = h.state.measure({ name: "width", keyframes: [120, "25%"], metric: width, token })
  await expect(first).resolves.toMatchObject({ keyframes: [120, 200] })
  await expect(second).resolves.toMatchObject({ keyframes: [120, 100] })
  expect(h.trace.filter((event) => (event as unknown[])[0] === "begin")).toHaveLength(2)
  h.dispose()
})
it("cancels queued work before acquiring native resources", async () => {
  const h = measurementHarness(),
    token = measurementToken(),
    pending = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token }),
    failure = expect(pending).rejects.toThrow(/cancelled/)
  token.cancel()
  await failure
  await measurementTurn()
  expect(h.trace).toEqual([])
  h.dispose()
})
it("restores a cancelled active cohort then remeasures its still-live sibling", async () => {
  const h = measurementHarness({ ack: false }),
    first = measurementToken(),
    second = measurementToken()
  const cancelled = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token: first }),
    failure = expect(cancelled).rejects.toThrow(/cancelled/)
  const retained = h.state.measure({ name: "height", keyframes: [40, "auto"], metric: height, token: second })
  await measurementTurn()
  first.cancel()
  await failure
  h.setAck(true)
  await measurementTurn()
  h.acknowledge()
  await expect(retained).resolves.toEqual({ keyframes: [40, 200], finalKeyframe: "auto" })
  expect(h.held()).toBe(false)
  expect(first.size()).toBe(0)
  expect(second.size()).toBe(0)
  h.dispose()
})
it("rejects missing measurements while restoring and releasing the actual session", async () => {
  const h = measurementHarness(),
    token = measurementToken()
  await expect(h.state.measure({ name: "width", keyframes: [120, "auto"], metric: () => NaN, token })).rejects.toThrow(
    /measurement unavailable/,
  )
  expect(h.trace.map((event) => (event as unknown[])[0])).toEqual(["begin", "render", "render", "release", "render"])
  expect(h.held()).toBe(false)
  h.dispose()
})
it("ignores reports for other revisions until the actual native stage acknowledges", async () => {
  const h = measurementHarness({ ack: false }),
    token = measurementToken()
  let settled = false
  const pending = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token }).then((result) => {
    settled = true
    return result
  })
  await measurementTurn()
  h.acknowledge({ commitRevision: "unrelated" })
  await measurementTurn()
  expect(settled).toBe(false)
  h.setAck(true)
  h.acknowledge()
  await pending
  expect(settled).toBe(true)
  h.dispose()
})
it("rejects timeout and aborts if restoration cannot obtain an acknowledged native commit", async () => {
  jest.useFakeTimers()
  const h = measurementHarness({ ack: false }),
    token = measurementToken(),
    pending = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token }),
    failure = expect(pending).rejects.toThrow(/5000ms/)
  jest.runAllTicks()
  await measurementTurn()
  jest.advanceTimersByTime(5000)
  await measurementTurn()
  jest.advanceTimersByTime(5000)
  await failure
  expect(h.held()).toBe(false)
  expect(h.state.getSnapshot().values).toBeNull()
  expect(jest.getTimerCount()).toBe(0)
  h.dispose()
})
it("does not publish restoration into a replacement native View", async () => {
  const h = measurementHarness({ ack: false }),
    token = measurementToken(),
    pending = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token }),
    failure = expect(pending).rejects.toThrow(/retired/)
  await measurementTurn()
  h.dispose()
  await failure
  await measurementTurn()
  expect(h.trace.filter((event) => (event as unknown[])[0] === "render")).toHaveLength(1)
  expect(h.trace.at(-1)).toEqual(["abort"])
  expect(h.held()).toBe(false)
})
it("restores current styles but aborts the old native lease after a window/scope change", async () => {
  const h = measurementHarness({ ack: false }),
    token = measurementToken()
  const pending = h.state.measure({ name: "width", keyframes: [120, "auto"], metric: width, token }),
    failure = expect(pending).rejects.toThrow(/owner retired/)
  await measurementTurn()
  h.setAck(true)
  h.moveScope()
  await failure
  await measurementTurn()
  expect(h.state.getSnapshot().values).toBeNull()
  expect(h.held()).toBe(false)
  expect(h.trace.filter((event) => (event as unknown[])[0] === "release")).toEqual([])
  expect(h.trace.some((event) => (event as unknown[])[0] === "abort")).toBe(true)
  h.dispose()
})
