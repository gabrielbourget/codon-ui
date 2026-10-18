import { createNativeTooltipTiming } from "../tooltipTiming"

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const owner = (group = createNativeTooltipTiming(), initial = false) => {
  const state = { isOpen: initial, delay: undefined as number | undefined, closeDelay: undefined as number | undefined }
  const request = jest.fn()
  const read = () => ({ ...state, request })
  const lease = group.register(read)
  return { group, state, request, lease }
}

it("waits1500ms for the cold hover and preserves a controlled false decline", () => {
  const f = owner()
  f.lease.open()
  jest.advanceTimersByTime(1499)
  expect(f.request).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(f.request.mock.calls).toEqual([[true]])
  expect(f.state.isOpen).toBe(false)
  f.lease.open()
  expect(f.request.mock.calls).toEqual([[true], [true]])
  f.group.dispose()
})

it("uses an explicit zero or immediate open without waiting", () => {
  const f = owner()
  f.state.delay = 0
  f.lease.open()
  expect(f.request.mock.calls).toEqual([[true]])
  f.group.dispose()
  const next = owner()
  next.lease.open(true)
  expect(next.request.mock.calls).toEqual([[true]])
  next.group.dispose()
})

it("cancels cold warmup when the pointer leaves before opening", () => {
  const f = owner()
  f.lease.open()
  jest.advanceTimersByTime(1000)
  f.lease.close()
  jest.runAllTimers()
  expect(f.request).not.toHaveBeenCalled()
  f.group.dispose()
})

it("closes after500ms and cancels pending close when returning to the content", () => {
  const f = owner(undefined, true)
  f.lease.open(true)
  f.lease.close()
  jest.advanceTimersByTime(499)
  expect(f.request).not.toHaveBeenCalled()
  f.lease.open()
  jest.advanceTimersByTime(500)
  expect(f.request).not.toHaveBeenCalled()
  f.lease.close()
  jest.advanceTimersByTime(500)
  expect(f.request.mock.calls).toEqual([[false]])
  expect(f.state.isOpen).toBe(true)
  f.group.dispose()
})

it("warms sibling descriptions in the same window and requests closure without hiding a declined owner", () => {
  const first = owner()
  const second = owner(first.group)
  first.lease.open(true)
  first.state.isOpen = true
  second.lease.open()
  expect(first.request.mock.calls).toEqual([[true], [false]])
  expect(first.state.isOpen).toBe(true)
  expect(second.request.mock.calls).toEqual([[true]])
  first.group.dispose()
})

it("keeps separate native windows cold and independent", () => {
  const first = owner(),
    second = owner()
  first.lease.open(true)
  second.lease.open()
  expect(second.request).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1500)
  expect(second.request.mock.calls).toEqual([[true]])
  first.group.dispose()
  second.group.dispose()
})

it("returns to cold timing after the larger close delay and500ms cooldown", () => {
  const first = owner(undefined, true)
  const second = owner(first.group)
  first.state.closeDelay = 800
  first.lease.open(true)
  first.lease.close()
  jest.advanceTimersByTime(800)
  second.lease.open()
  expect(second.request).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1500)
  expect(second.request.mock.calls).toEqual([[true]])
  first.group.dispose()
})

it("reads the latest callback and owner state when a delayed close fires", () => {
  const group = createNativeTooltipTiming()
  const old = jest.fn(),
    latest = jest.fn()
  let request = old
  let isOpen = true
  const lease = group.register(() => ({ isOpen, request }))
  lease.close()
  request = latest
  jest.advanceTimersByTime(500)
  expect(old).not.toHaveBeenCalled()
  expect(latest.mock.calls).toEqual([[false]])
  isOpen = false
  lease.close()
  jest.advanceTimersByTime(500)
  expect(latest).toHaveBeenCalledTimes(1)
  group.dispose()
})

it("rechecks native window eligibility before a queued hover requests opening", () => {
  const f = owner()
  let active = true
  f.lease.open(false, () => active)
  active = false
  jest.advanceTimersByTime(1500)
  expect(f.request).not.toHaveBeenCalled()
  f.group.dispose()
})

it("does not apply a delayed native close after its window loses eligibility", () => {
  const f = owner(undefined, true)
  let active = true
  f.lease.close(false, () => active)
  active = false
  jest.advanceTimersByTime(500)
  expect(f.request).not.toHaveBeenCalled()
  f.lease.close(true)
  expect(f.request.mock.calls).toEqual([[false]])
  f.group.dispose()
})

it("cancels old owner warmup/close timers on replacement and all timers on host disposal", () => {
  const f = owner()
  f.lease.open()
  f.lease.unregister()
  const replacement = owner(f.group, true)
  replacement.lease.close()
  f.lease.open(true)
  f.lease.close(true)
  f.group.dispose()
  jest.runAllTimers()
  expect(f.request).not.toHaveBeenCalled()
  expect(replacement.request).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
  expect(() => f.group.register(() => ({ isOpen: false, request: jest.fn() }))).toThrow("retired")
})

it("uses the caller's closeDelay0 and rejects nonfinite scheduling inputs", () => {
  const f = owner(undefined, true)
  f.state.closeDelay = 0
  f.lease.close()
  expect(f.request.mock.calls).toEqual([[false]])
  f.state.closeDelay = Infinity
  expect(() => f.lease.close()).toThrow("finite")
  f.state.delay = NaN
  expect(() => f.lease.open()).toThrow("finite")
  f.group.dispose()
})
