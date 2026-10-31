import { NativeMotionResolutionBatch } from "../value/resolution-batch"

const token = () => {
  let current = true
  const listeners = new Set<() => void>()
  return {
    isCurrent: () => current,
    onCancel: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    cancel: () => {
      current = false
      for (const listener of [...listeners]) listener()
    },
    size: () => listeners.size,
  }
}
const turn = async () => {
  for (let index = 0; index < 8; index++) {
    jest.runAllTicks()
    await Promise.resolve()
  }
}
beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
})

it("registers synchronous peers before async reads and requires explicit normalization plus settlement", async () => {
  const batch = new NativeMotionResolutionBatch(),
    one = token(),
    two = token()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  const trace: string[] = []
  void width.whenNormalized.then(() => trace.push("normalized"))
  void width.ready.then(() => trace.push("ready"))
  width.normalized([100, 200])
  width.settled()
  await turn()
  expect(trace).toEqual([])
  height.normalized([40, "auto"])
  await turn()
  expect(trace).toEqual(["normalized"])
  const capture = width.capture()
  expect([...capture.frames]).toEqual([
    ["width", [100, 200]],
    ["height", [40, "auto"]],
  ])
  expect(capture.isCurrent()).toBe(true)
  height.settled()
  await width.ready
  await turn()
  expect(trace).toEqual(["normalized", "ready"])
  expect(one.size()).toBe(0)
  expect(two.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it("does not equate a queued microtask with completed initial/color reads", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const item = batch.begin("width", owner)
  await turn()
  expect(() => item.capture()).toThrow("normalization is incomplete")
  item.normalized([100, "auto"])
  item.settled()
  await item.ready
  expect(jest.getTimerCount()).toBe(0)
})
it("retires only a cancelled member, invalidates captured coupling and releases a still-live peer", async () => {
  const batch = new NativeMotionResolutionBatch(),
    one = token(),
    two = token()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  width.normalized([100, "auto"])
  height.normalized([40, "auto"])
  await turn()
  await height.whenNormalized
  const capture = height.capture(),
    changed = jest.fn()
  const stop = capture.onChange(changed)
  const rejected = expect(width.ready).rejects.toThrow("cancelled")
  one.cancel()
  await rejected
  expect(changed).toHaveBeenCalledTimes(1)
  expect(capture.isCurrent()).toBe(false)
  expect([...height.capture().frames]).toEqual([["height", [40, "auto"]]])
  stop()
  height.settled()
  await height.ready
  expect(one.size()).toBe(0)
  expect(two.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it("settles a failed normalizer without deadlocking its unrelated live peer", async () => {
  const batch = new NativeMotionResolutionBatch(),
    one = token(),
    two = token()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  const rejected = expect(width.ready).rejects.toThrow("native color failed")
  width.settled(new Error("native color failed"))
  height.normalized([40, "auto"])
  height.settled()
  await rejected
  await turn()
  await height.ready
  expect(jest.getTimerCount()).toBe(0)
})
it("bounds the entire reservation from before initial reads at 5000ms", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const item = batch.begin("width", owner)
  const rejected = expect(item.ready).rejects.toThrow("5000ms")
  await turn()
  jest.advanceTimersByTime(5000)
  await rejected
  item.normalized([1, 2])
  item.settled()
  expect(owner.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it("starts a separate cohort after sealing without waiting for an earlier async query", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const first = batch.begin("width", owner)
  first.normalized([100, "auto"])
  await turn()
  await first.whenNormalized
  const second = batch.begin("height", owner)
  second.normalized([40, "auto"])
  second.settled()
  await turn()
  await second.ready
  expect(first.capture().cohort).not.toBe(second.capture().cohort)
  first.settled()
  await first.ready
  expect(jest.getTimerCount()).toBe(0)
})
it("cancels every pending reservation and ignores late async normalization", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const first = batch.begin("width", owner),
    second = batch.begin("height", owner)
  const rejected = [
    expect(first.ready).rejects.toThrow("owner cancelled"),
    expect(second.ready).rejects.toThrow("owner cancelled"),
  ]
  batch.cancel()
  await Promise.all(rejected)
  await turn()
  first.normalized([1, 2])
  second.normalized([3, 4])
  expect(owner.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
