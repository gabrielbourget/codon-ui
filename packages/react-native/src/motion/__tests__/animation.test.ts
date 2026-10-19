import { animateTarget, animateVariant, animateVisualElement, nativeAnimationControls, setTarget } from "../animation"
import { JSAnimation, MotionGlobalConfig, frameData, motionValue, time } from "../kernel"

import { AnimationOwnerFixture, scalarTransition } from "./animation-owner.fixture"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
const flush = async (timestamp = 1016) => {
  frameData.timestamp = timestamp
  time.set(timestamp)
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(timestamp))
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  time.set(1000)
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++nextFrame
    frames.set(id, callback)
    return id
  })
})
afterEach(async () => {
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("retains mounted start/set/stop and original definition identity", async () => {
  const owner = new AnimationOwnerFixture()
  const controls = nativeAnimationControls()
  controls.subscribe(owner)
  expect(() => controls.start({ x: 10 })).toThrow(/mounted/)
  expect(() => controls.set({ x: 10 })).toThrow(/mounted/)
  const unmount = controls.mount()
  const target = Object.freeze({ x: 100, transition: scalarTransition })
  const pending = controls.start(target)
  expect(owner.events[0]).toEqual({ event: "AnimationStart", definition: target })
  await flush(1050)
  expect(owner.getValue("x")?.get()).toBe(50)
  await flush(1100)
  await pending
  expect(owner.events[1].definition).toBe(target)
  expect(owner.events[1].event).toBe("AnimationComplete")
  controls.set({ x: 0 })
  expect(owner.getValue("x")?.get()).toBe(0)
  unmount()
  expect(() => controls.start(target)).toThrow(/mounted/)
  owner.retire()
})
it("sets variants with source reverse-label precedence without mutating labels or frozen targets", () => {
  const first = Object.freeze({ x: 10 }),
    second = Object.freeze({ x: 20 })
  const owner = new AnimationOwnerFixture({ variants: Object.freeze({ first, second }) })
  const labels = Object.freeze(["first", "second"])
  const controls = nativeAnimationControls()
  controls.subscribe(owner)
  const release = controls.mount()
  controls.set([...labels])
  expect(owner.getValue("x")?.get()).toBe(10)
  expect(labels).toEqual(["first", "second"])
  release()
  owner.retire()
})
it("preserves source set semantics while an existing animation remains active", async () => {
  const owner = new AnimationOwnerFixture(),
    controls = nativeAnimationControls()
  controls.subscribe(owner)
  const release = controls.mount()
  const pending = controls.start({ x: 100, transition: scalarTransition })
  await flush(1040)
  controls.set({ x: 5 })
  expect(owner.getValue("x")?.get()).toBe(5)
  expect(owner.getValue("x")?.isAnimating()).toBe(true)
  await flush(1080)
  expect(owner.getValue("x")?.get()).toBe(80)
  await flush(1100)
  await pending
  release()
  owner.retire()
})
it("retires unsubscribed owners while retaining the current subscriber iteration", async () => {
  const first = new AnimationOwnerFixture(),
    second = new AnimationOwnerFixture(),
    controls = nativeAnimationControls()
  const releaseFirst = controls.subscribe(first)
  controls.subscribe(second)
  const release = controls.mount()
  releaseFirst()
  const pending = controls.start({ x: 20, transition: scalarTransition })
  await flush(1100)
  await pending
  expect(first.getValue("x")?.get()).toBe(0)
  expect(second.getValue("x")?.get()).toBe(20)
  release()
  first.retire()
  second.retire()
})
it("keeps stopped control promises pending, matching pinned playback semantics", async () => {
  const owner = new AnimationOwnerFixture(),
    controls = nativeAnimationControls()
  controls.subscribe(owner)
  const release = controls.mount()
  let settled = false
  void controls.start({ x: 100, transition: scalarTransition }).then(() => {
    settled = true
  })
  await flush(1040)
  controls.stop()
  await flush(1200)
  expect(settled).toBe(false)
  expect(owner.getValue("x")?.get()).toBe(40)
  release()
  owner.retire()
})
it("rejects queued complete notifications after the native owner lease changes", async () => {
  const owner = new AnimationOwnerFixture()
  const pending = animateVisualElement(owner, { x: 100, transition: scalarTransition })
  owner.getValue("x")?.animation?.complete()
  await flush(1100)
  owner.events.length = 0
  const next = animateVisualElement(owner, { x: [100, 200], transition: scalarTransition })
  const finishing = owner.getValue("x")?.animation
  if (finishing instanceof JSAnimation) finishing.finish()
  owner.retire()
  owner.attach()
  await next
  expect(owner.events.map(({ event }) => event)).toEqual(["AnimationStart"])
  await pending
  owner.retire()
})
it("rejects transitionEnd work queued for an older native attachment", async () => {
  const owner = new AnimationOwnerFixture()
  const pending = animateVisualElement(owner, { x: 100, transition: scalarTransition, transitionEnd: { opacity: 0 } })
  await flush(1100)
  await pending
  owner.retire()
  owner.attach()
  owner.getValue("opacity")?.set(0.9)
  await flush(1120)
  expect(owner.getValue("opacity")?.get()).toBe(0.9)
  owner.retire()
})
it("does not start child sequences after a completed parent loses its native lease", async () => {
  const root = new AnimationOwnerFixture({
    variants: { show: { x: 100, transition: { ...scalarTransition, when: "beforeChildren" } } },
  })
  const child = new AnimationOwnerFixture({ variants: { show: { x: 20, transition: scalarTransition } } })
  root.variantChildren.add(child)
  const pending = animateVariant(root, "show")
  const finishing = root.getValue("x")?.animation
  if (finishing instanceof JSAnimation) finishing.finish()
  root.retire()
  root.attach()
  await pending
  expect(child.events).toEqual([])
  expect(child.getValue("x")?.get()).toBe(0)
  root.retire()
  child.retire()
})
it("does not create values or start animations for an unattached native owner", async () => {
  const owner = new AnimationOwnerFixture()
  owner.retire()
  expect(animateTarget(owner, { width: 100 })).toEqual([])
  await animateVisualElement(owner, { x: 100 })
  await animateVariant(owner, "show")
  expect(owner.events).toEqual([])
  expect(owner.hasValue("width")).toBe(false)
})
it("preserves property protections, native reduced-motion routing and path ownership", () => {
  const owner = new AnimationOwnerFixture()
  owner.shouldReduceMotion = true
  const animate = jest.spyOn(owner, "animateValue")
  owner.animationState.getState().whileTap.protectedKeys = { x: 1 }
  animateTarget(owner, { x: 10, opacity: 0, transition: scalarTransition }, { type: "whileTap" })
  expect(animate).toHaveBeenCalledTimes(1)
  expect(animate.mock.calls[0][0]).toBe("opacity")
  expect(animate.mock.calls[0][3].type).toBeUndefined()
  animate.mockClear()
  animateTarget(owner, { x: 20, transition: scalarTransition })
  expect(animate.mock.calls[0][3]).toEqual({ type: false })
  const path = jest.fn((_owner, target) => {
    delete target.x
  })
  animate.mockClear()
  animateTarget(owner, {
    x: 30,
    transition: { path: { animateVisualElement: path, interpolateProjection: () => undefined } },
  })
  expect(path).toHaveBeenCalledTimes(1)
  expect(animate).not.toHaveBeenCalled()
  owner.retire()
})
it("uses exit custom once and does not interrupt an active exit on later custom changes", async () => {
  const resolve = jest.fn((custom: unknown) => ({ x: custom }))
  const owner = new AnimationOwnerFixture({ exit: "gone", variants: { gone: resolve } })
  owner.presenceContext.custom = 0
  const records: unknown[] = []
  owner.animationState.setAnimateFunction(() => async (animations) => {
    records.push(animations)
  })
  await owner.animationState.animateChanges()
  await owner.animationState.setActive("exit", true)
  const count = resolve.mock.calls.length
  owner.presenceContext.custom = 20
  owner.props = { ...owner.props, custom: 20 }
  await owner.animationState.animateChanges()
  expect(resolve).toHaveBeenCalledWith(0, expect.any(Object), expect.any(Object))
  expect(resolve).toHaveBeenCalledTimes(count)
  expect(records).toHaveLength(1)
  owner.retire()
})
it("keeps final zero and the pinned empty-keyframe set fallback", () => {
  const owner = new AnimationOwnerFixture()
  setTarget(owner, { x: [2, 0], opacity: [0.5, null] })
  expect(owner.getValue("x")?.get()).toBe(0)
  expect(owner.getValue("opacity")?.get()).toBe(0)
  const external = motionValue<unknown>(5)
  owner.addValue("x", external)
  setTarget(owner, { x: 10 })
  expect(owner.getValue("x")).toBe(external)
  expect(external.get()).toBe(10)
  owner.retire()
})

it("rejects an equal-target reassertion queued for a replaced native attachment", async () => {
  const owner = new AnimationOwnerFixture()
  expect(animateTarget(owner, { x: 0 })).toEqual([])
  owner.retire()
  owner.attach()
  owner.getValue("x")?.set(99)
  await flush()
  expect(owner.getValue("x")?.get()).toBe(99)
  owner.retire()
})

it("rejects child completion notifications from a retired child attachment", async () => {
  const root = new AnimationOwnerFixture({ variants: { show: {} } })
  const child = new AnimationOwnerFixture({ variants: { show: { x: 20, transition: scalarTransition } } })
  root.variantChildren.add(child)
  const pending = animateVariant(root, "show")
  const finishing = child.getValue("x")?.animation
  if (finishing instanceof JSAnimation) finishing.finish()
  child.retire()
  child.attach()
  await pending
  expect(child.events.map(({ event }) => event)).toEqual(["AnimationStart"])
  root.retire()
  child.retire()
})
