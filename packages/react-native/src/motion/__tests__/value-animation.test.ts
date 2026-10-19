import { animateVisualElement } from "../animation"
import { MotionGlobalConfig, frameData, motionValue, time } from "../kernel"
import { animateNativeMotionValue, NativeMotionResolutionPendingError, NativeValueAnimation } from "../value"
import type { TNativeMotionValueContext, TNativeMotionValueOptions } from "../value"

import { AnimationOwnerFixture } from "./animation-owner.fixture"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0
const controls: NativeValueAnimation[] = []
const flush = async (timestamp: number) => {
  frameData.timestamp = timestamp
  time.set(timestamp)
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(timestamp))
  for (let index = 0; index < 6; index++) await Promise.resolve()
}
const context = (extra: Partial<TNativeMotionValueContext> = {}): TNativeMotionValueContext => ({
  isCurrent: () => true,
  readValue: () => {
    throw new Error("missing actual native read")
  },
  ...extra,
})
const animation = (extra: Partial<TNativeMotionValueOptions> = {}) => {
  const value = motionValue<unknown>(0)
  const control = new NativeValueAnimation({
    keyframes: [0, 100],
    name: "x",
    motionValue: value,
    context: context(),
    duration: 100,
    ease: "linear",
    onUpdate: (latest) => value.set(latest),
    ...extra,
  })
  controls.push(control)
  return { control, value }
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
  controls.splice(0).forEach((control) => control.stop())
  await flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  MotionGlobalConfig.skipAnimations = false
  MotionGlobalConfig.instantAnimations = false
  jest.restoreAllMocks()
})
it("uses the pinned driver and reports actual resolved duration/state", async () => {
  const { control, value } = animation()
  await control.ready
  expect(control.duration).toBe(0.1)
  expect(control.iterationDuration).toBe(0.1)
  expect(control.state).toBe("running")
  await flush(1050)
  expect(value.get()).toBe(50)
  await flush(1100)
  await control.finished
  expect(value.get()).toBe(100)
  expect(control.state).toBe("finished")
})
it("renews completion after replaying a finished animation", async () => {
  const { control } = animation()
  const first = control.finished
  await flush(1100)
  await first
  control.play()
  expect(control.finished).not.toBe(first)
  let settled = false
  void control.finished.then(() => {
    settled = true
  })
  await flush(1150)
  expect(settled).toBe(false)
  await flush(1200)
  expect(settled).toBe(true)
})
it("samples the current time on stop and preserves the pinned permanent-stop/pending-promise contract", async () => {
  const { control, value } = animation()
  let settled = false
  void control.finished.then(() => {
    settled = true
  })
  time.set(1030)
  frameData.timestamp = 1030
  control.stop()
  expect(value.get()).toBe(30)
  control.play()
  await flush(1200)
  expect(value.get()).toBe(30)
  expect(settled).toBe(false)
})
it("cancels to the original value and can replay the resolved animation", async () => {
  const { control, value } = animation()
  await flush(1040)
  expect(value.get()).toBe(40)
  control.cancel()
  expect(value.get()).toBe(0)
  control.play()
  await flush(1090)
  expect(value.get()).toBe(90)
  await flush(1140)
  await control.finished
  expect(value.get()).toBe(100)
})
it.each([20, 41])("uses the pinned 40ms delayed-resolution start-time rule at %pms", async (delay) => {
  let resolve!: (value: readonly string[]) => void
  const { control } = animation({
    keyframes: ["red", "blue"],
    name: "color",
    context: context({
      resolveColors: () =>
        new Promise((accept) => {
          resolve = accept
        }),
    }),
  })
  expect(() => control.duration).toThrow(NativeMotionResolutionPendingError)
  expect(() => control.getGeneratorVelocity()).toThrow(NativeMotionResolutionPendingError)
  expect(control.startTime).toBeNull()
  time.set(1000 + delay)
  frameData.timestamp = 1000 + delay
  resolve(["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"])
  await control.ready
  expect(control.startTime).toBe(delay > 40 ? 1000 + delay : 1000)
})
it("applies queued time/speed/pause in order after native resolution", async () => {
  let resolve!: (value: unknown) => void
  const { control } = animation({
    keyframes: [null, 100],
    motionValue: motionValue<unknown>(undefined),
    context: context({
      readValue: () =>
        new Promise((accept) => {
          resolve = accept
        }),
    }),
  })
  control.time = 0.03
  control.speed = 2
  control.pause()
  expect(control.time).toBe(0.03)
  expect(control.speed).toBe(2)
  resolve(0)
  await control.ready
  expect(control.time).toBe(0.03)
  expect(control.speed).toBe(2)
  expect(control.state).toBe("paused")
})
it("cancels native query work immediately and ignores a late result", async () => {
  let resolve!: (value: readonly string[]) => void
  const cancelled = jest.fn()
  const { control, value } = animation({
    keyframes: ["red", "blue"],
    name: "color",
    context: context({
      resolveColors: (_colors, token) => {
        token.onCancel(cancelled)
        return new Promise((accept) => {
          resolve = accept
        })
      },
    }),
  })
  let settled = false
  void control.finished.then(() => {
    settled = true
  })
  control.stop()
  expect(cancelled).toHaveBeenCalledTimes(1)
  resolve(["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"])
  await flush(1200)
  expect(value.get()).toBe(0)
  expect(settled).toBe(false)
  expect(control.state).toBe("idle")
})
it("resolves afresh when playing a control stopped before it acquired native keyframes", async () => {
  const resolvers: Array<(colors: readonly string[]) => void> = []
  const { control, value } = animation({
    keyframes: ["red", "blue"],
    name: "color",
    context: context({
      resolveColors: () =>
        new Promise((resolve) => {
          resolvers.push(resolve)
        }),
    }),
  })
  control.stop()
  control.play()
  expect(resolvers).toHaveLength(2)
  resolvers[0](["rgba(1, 1, 1, 1)", "rgba(2, 2, 2, 1)"])
  await flush(1000)
  expect(value.get()).toBe(0)
  resolvers[1](["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"])
  await control.ready
  await flush(1100)
  expect(value.get()).toBe("blue")
})
it("rejects asynchronous resolver errors and errors thrown while accepting their results", async () => {
  const first = animation({
    keyframes: ["red", "blue"],
    name: "color",
    context: context({
      resolveColors: async () => {
        throw new Error("native query rejected")
      },
    }),
  }).control
  await expect(first.ready).rejects.toThrow("native query rejected")
  await expect(first.finished).rejects.toThrow("native query rejected")
  const second = animation({
    keyframes: [0, "auto"],
    context: context({ resolveGeometry: async () => ({ keyframes: [0] }) }),
  }).control
  await expect(second.ready).rejects.toThrow(/incomplete/)
  await expect(second.finished).rejects.toThrow(/incomplete/)
})
it("releases a failed control assigned by MotionValue.start without stopping a replacement", async () => {
  const value = motionValue<unknown>(0)
  void value.start(animateNativeMotionValue("width", value, "auto", {}, context()))
  const failed = value.animation as NativeValueAnimation
  controls.push(failed)
  await expect(failed.ready).rejects.toThrow(/actual native/)
  await flush(1000)
  expect(value.isAnimating()).toBe(false)
})
it("suppresses updates/completion if the owner retires and reclaims a driver retired in onPlay", async () => {
  let current = true
  const update = jest.fn(),
    complete = jest.fn()
  const { control } = animation({
    context: context({ isCurrent: () => current }),
    onUpdate: update,
    onComplete: complete,
    onPlay: () => {
      current = false
    },
  })
  await flush(1200)
  expect(update).not.toHaveBeenCalled()
  expect(complete).not.toHaveBeenCalled()
  expect(control.state).toBe("idle")
})
it("mixes native transform arrays with pinned recursive interpolation and restores the authored endpoint", async () => {
  const initial = [{ translateX: 0 }, { scale: 1 }],
    target = Object.freeze([{ translateX: 100 }, { scale: 3 }])
  const { value, control } = animation({ keyframes: [initial, target], name: "transform" })
  await flush(1050)
  expect(value.get()).toEqual([{ translateX: 50 }, { scale: 2 }])
  await flush(1100)
  await control.finished
  expect(value.get()).toBe(target)
})
it("uses final original geometry only on the appropriate repeat endpoint", async () => {
  const { value, control } = animation({
    keyframes: [0, "auto"],
    context: context({ resolveGeometry: () => ({ keyframes: [0, 100], finalKeyframe: "auto" }) }),
    repeat: 1,
    repeatType: "reverse",
  })
  await flush(1100)
  expect(value.get()).toBe(100)
  await flush(1200)
  await control.finished
  expect(value.get()).toBe(0)
})
it("keeps delayed nonanimatable targets delayed", async () => {
  const { value, control } = animation({ name: "zIndex", keyframes: [0, 10], delay: 50 })
  await flush(1025)
  expect(value.get()).toBe(10)
  expect(control.state).toBe("running")
  await flush(1050)
  await control.finished
  expect(value.get()).toBe(10)
})
it("honors source instant scheduling and native opaque final identity without sampling", async () => {
  const value = motionValue<unknown>("red"),
    target = Object.freeze({ semantic: ["labelColor"] })
  const resolveColors = jest.fn(),
    complete = jest.fn()
  const control = animateNativeMotionValue(
    "color",
    value,
    target,
    { duration: 0 },
    context({ resolveColors }),
  )(complete)
  expect(control).toBeUndefined()
  expect(value.get()).toBe("red")
  expect(resolveColors).not.toHaveBeenCalled()
  await flush(1016)
  expect(value.get()).toBe(target)
  expect(complete).toHaveBeenCalledTimes(1)
})
it("keeps delayed instant opaque colors native and queries no interpolation endpoints", async () => {
  const value = motionValue<unknown>(Object.freeze({ semantic: ["labelColor"] })),
    target = Object.freeze({ semantic: ["secondaryLabelColor"] })
  const resolveColors = jest.fn(),
    complete = jest.fn()
  const control = animateNativeMotionValue(
    "color",
    value,
    target,
    { duration: 0, delay: 0.05 },
    context({ resolveColors }),
  )(complete) as NativeValueAnimation
  controls.push(control)
  await control.ready
  expect(resolveColors).not.toHaveBeenCalled()
  await flush(1025)
  expect(complete).not.toHaveBeenCalled()
  await flush(1050)
  expect(value.get()).toBe(target)
  expect(complete).toHaveBeenCalledTimes(1)
})

it("composes the new backend with target orchestration and transitionEnd", async () => {
  const owner = new AnimationOwnerFixture()
  owner.animateValue = (name, value, target, transition, complete, isCurrent) =>
    animateNativeMotionValue(name, value, target, transition, context({ isCurrent }))(complete)
  const pending = animateVisualElement(owner, {
    x: 100,
    transition: { duration: 0.1, ease: "linear" },
    transitionEnd: { opacity: 0.4 },
  })
  await flush(1050)
  expect(owner.latestValues.x).toBe(50)
  await flush(1100)
  await pending
  await flush(1116)
  expect(owner.latestValues.x).toBe(100)
  expect(owner.latestValues.opacity).toBe(0.4)
  expect(owner.events.map((event) => event.event)).toEqual(["AnimationStart", "AnimationComplete"])
  owner.retire()
})
it("cancels asynchronous color work through the existing owner retirement protocol", async () => {
  const owner = new AnimationOwnerFixture(),
    cancelled = jest.fn()
  let resolve!: (colors: readonly string[]) => void
  owner.addValue("backgroundColor", motionValue<unknown>("red"))
  owner.animateValue = (name, value, target, transition, complete, isCurrent) =>
    animateNativeMotionValue(
      name,
      value,
      target,
      transition,
      context({
        isCurrent,
        resolveColors: (_colors, token) => {
          token.onCancel(cancelled)
          return new Promise((accept) => {
            resolve = accept
          })
        },
      }),
    )(complete)
  let settled = false
  void animateVisualElement(owner, { backgroundColor: "blue", transition: { duration: 0.1 } }).then(() => {
    settled = true
  })
  owner.retire()
  expect(cancelled).toHaveBeenCalledTimes(1)
  resolve(["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"])
  await flush(1200)
  expect(owner.latestValues.backgroundColor).toBe("red")
  expect(settled).toBe(false)
  expect(owner.events.map((event) => event.event)).toEqual(["AnimationStart"])
})
it("preserves explicit seek/cancel state changes on stopped controls while scheduled work stays stopped", async () => {
  const { control, value } = animation()
  await flush(1040)
  control.stop()
  control.time = 0.07
  expect(value.get()).toBe(70)
  expect(control.state).toBe("paused")
  control.cancel()
  expect(value.get()).toBe(0)
  expect(control.state).toBe("idle")
  await flush(1200)
  expect(value.get()).toBe(0)
})
