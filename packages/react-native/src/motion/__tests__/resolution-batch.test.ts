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

it("registers synchronous peers before async reads and requires settlement of every live initial/color read", async () => {
  const batch = new NativeMotionResolutionBatch(),
    one = token(),
    two = token()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  const trace: string[] = []
  void width.ready.then(() => trace.push("ready"))
  width.settled()
  await turn()
  expect(trace).toEqual([])
  height.settled()
  await width.ready
  await turn()
  expect(trace).toEqual(["ready"])
  expect(one.size()).toBe(0)
  expect(two.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it("does not equate a queued microtask with completed initial/color reads", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const item = batch.begin("width", owner)
  await turn()
  const ready = jest.fn()
  void item.ready.then(ready)
  expect(ready).not.toHaveBeenCalled()
  item.settled()
  await item.ready
  expect(jest.getTimerCount()).toBe(0)
})
it("retires only a cancelled member and releases a still-live peer", async () => {
  const batch = new NativeMotionResolutionBatch(),
    one = token(),
    two = token()
  const width = batch.begin("width", one),
    height = batch.begin("height", two)
  await turn()
  const rejected = expect(width.ready).rejects.toThrow("cancelled")
  one.cancel()
  await rejected
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
  item.settled()
  expect(owner.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
it("starts a separate cohort after sealing without waiting for an earlier async query", async () => {
  const batch = new NativeMotionResolutionBatch(),
    owner = token()
  const first = batch.begin("width", owner)
  await turn()
  const second = batch.begin("height", owner)
  second.settled()
  await turn()
  await second.ready
  first.settled()
  await first.ready
  expect(jest.getTimerCount()).toBe(0)
})
it("cancels every pending reservation and ignores late async settlement", async () => {
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
  first.settled()
  second.settled()
  await turn()
  expect(owner.size()).toBe(0)
  expect(jest.getTimerCount()).toBe(0)
})
