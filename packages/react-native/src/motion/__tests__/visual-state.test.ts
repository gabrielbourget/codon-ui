import { JSAnimation, MotionGlobalConfig, frame, frameData, motionValue } from "../kernel"
import { NativeMotionVisualState } from "../visual/state"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
const flush = (timestamp = 1016) => {
  frameData.timestamp = timestamp
  const work = [...frames.values()]
  frames.clear()
  work.forEach((callback) => callback(timestamp))
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
})
afterEach(() => {
  flush(9000)
  MotionGlobalConfig.useManualTiming = false
  frames.clear()
  jest.restoreAllMocks()
})

it("samples initial values without subscribing before attachment", () => {
  const value = motionValue(0)
  const subscribe = jest.spyOn(value, "on")
  const visual = new NativeMotionVisualState({ x: value })
  expect(visual.getSnapshot()).toEqual({ x: 0 })
  expect(subscribe).not.toHaveBeenCalled()
  value.set(5)
  visual.attach()
  expect(visual.getSnapshot()).toEqual({ x: 5 })
  expect(subscribe).toHaveBeenCalledTimes(1)
  visual.detach()
})
it("coalesces current values and notifies before the render phase", () => {
  const x = motionValue(0),
    opacity = motionValue(1)
  const visual = new NativeMotionVisualState({ x, opacity })
  const trace: unknown[] = []
  visual.configure({ x, opacity }, (latest) => trace.push(["update", { ...latest }]))
  const release = visual.attach()
  const unsubscribe = visual.subscribe(() => trace.push(["render", visual.getSnapshot()]))
  const initial = visual.getSnapshot()
  x.set(10)
  opacity.set(0.5)
  x.set(20)
  expect(visual.getSnapshot()).toBe(initial)
  flush()
  expect(trace).toEqual([
    ["update", { x: 20, opacity: 0.5 }],
    ["render", { x: 20, opacity: 0.5 }],
  ])
  unsubscribe()
  release()
})
it("uses the current callback and preserves the live source-values identity", () => {
  const x = motionValue(0)
  const first = jest.fn(),
    current = jest.fn()
  const visual = new NativeMotionVisualState({ x })
  visual.configure({ x }, first)
  visual.attach()
  x.set(10)
  visual.configure({ x }, current)
  flush()
  expect(first).not.toHaveBeenCalled()
  const latest = current.mock.calls[0][0]
  x.set(20)
  flush(1032)
  expect(current.mock.calls[1][0]).toBe(latest)
  expect(latest.x).toBe(20)
  visual.detach()
})
it("resets removed fields and replaces subscriptions without stopping a shared source", () => {
  const x = motionValue(0),
    replacement = motionValue(15)
  const first = new NativeMotionVisualState({ x }),
    second = new NativeMotionVisualState({ x })
  first.attach()
  second.attach()
  first.configure({ x: replacement })
  x.set(5)
  replacement.set(25)
  flush()
  expect(first.getSnapshot()).toEqual({ x: 25 })
  expect(second.getSnapshot()).toEqual({ x: 5 })
  first.configure({})
  expect(first.getSnapshot()).toEqual({})
  first.detach()
  second.detach()
})
it("clears fields changed while detached before the host reattaches", () => {
  const x = motionValue(1),
    opacity = motionValue(0.5)
  const visual = new NativeMotionVisualState({ x })
  visual.attach()
  visual.detach()
  visual.configure({ opacity })
  visual.attach()
  expect(visual.getSnapshot()).toEqual({ opacity: 0.5 })
  visual.detach()
})
it("rejects late packets from a retired subscription even when the same source is rebound", () => {
  const callbacks: Array<(value: number) => void> = []
  const source = {
    get: () => 0,
    on: (_event: "change", callback: (value: number) => void) => {
      callbacks.push(callback)
      return () => {}
    },
  }
  const visual = new NativeMotionVisualState({ x: source })
  visual.attach()
  visual.configure({})
  visual.configure({ x: source })
  callbacks[0](100)
  flush()
  expect(visual.getSnapshot()).toEqual({ x: 0 })
  callbacks[1](20)
  flush(1032)
  expect(visual.getSnapshot()).toEqual({ x: 20 })
  visual.detach()
})
it("retires a render already selected in the current phase on owner replacement", () => {
  const x = motionValue(0)
  const visual = new NativeMotionVisualState({ x })
  const release = visual.attach()
  const render = jest.fn()
  visual.subscribe(render)
  frame.render(() => {
    release()
    visual.attach()
    render.mockClear()
  })
  x.set(5)
  flush()
  expect(render).not.toHaveBeenCalled()
  x.set(10)
  flush(1032)
  expect(visual.getSnapshot()).toEqual({ x: 10 })
  expect(render).toHaveBeenCalledTimes(1)
  visual.detach()
})
it("an old owner release cannot retire the current attachment", () => {
  const x = motionValue(0)
  const visual = new NativeMotionVisualState({ x })
  const oldRelease = visual.attach(),
    currentRelease = visual.attach()
  oldRelease()
  x.set(10)
  flush()
  expect(visual.getSnapshot()).toEqual({ x: 10 })
  currentRelease()
})
it("keeps an external animation alive while another host still observes it", () => {
  const x = motionValue(0)
  const first = new NativeMotionVisualState({ x }),
    second = new NativeMotionVisualState({ x })
  const stop = jest.fn()
  first.attach()
  second.attach()
  void x.start(
    (resolve) =>
      new JSAnimation({
        keyframes: [0, 100],
        duration: 100,
        motionValue: x,
        onUpdate: (value) => x.set(value),
        onComplete: resolve,
        driver: () => ({ start: () => {}, stop, now: () => 1000 }),
      }),
  )
  first.detach()
  flush()
  expect(stop).not.toHaveBeenCalled()
  second.detach()
  flush(1032)
  expect(stop).toHaveBeenCalledTimes(1)
})
it("does not notify queued callbacks or publish frames after detach", () => {
  const x = motionValue(0)
  const update = jest.fn(),
    render = jest.fn()
  const visual = new NativeMotionVisualState({ x })
  visual.configure({ x }, update)
  visual.attach()
  visual.subscribe(render)
  x.set(20)
  visual.detach()
  flush()
  expect(update).not.toHaveBeenCalled()
  expect(render).not.toHaveBeenCalled()
})
