import {
  JSAnimation,
  MotionGlobalConfig,
  SubscriptionManager,
  cancelFrame,
  createRenderBatcher,
  frame,
  frameData,
  frameloopDriver,
  motionValue,
  time,
} from "../kernel"
import type { Driver, DriverControls } from "../kernel"

const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let nextFrame = 0

const flushFrame = (timestamp: number) => {
  frameData.timestamp = timestamp
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(timestamp))
}

beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  time.set(1000)
  frameData.timestamp = 1000
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const handle = ++nextFrame
    frames.set(handle, callback)
    return handle
  })
})

afterEach(() => {
  flushFrame(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

const makeDriver = () => {
  let now = 1000
  let update: (timestamp: number) => void = () => {}
  let active = false
  const controls: DriverControls = {
    start: () => {
      active = true
    },
    stop: () => {
      active = false
    },
    now: () => now,
  }
  const driver: Driver = (callback) => {
    update = callback
    return controls
  }
  return {
    driver,
    advance: (timestamp: number) => {
      now = timestamp
      time.set(timestamp)
      if (active) update(timestamp)
    },
    controls,
  }
}

describe("native motion frame ownership", () => {
  it("schedules updates through native frames and stops future work", () => {
    const update = jest.fn()
    const driver = frameloopDriver(update)
    driver.start()
    expect(update).not.toHaveBeenCalled()
    flushFrame(1016)
    expect(update).toHaveBeenLastCalledWith(1016)
    driver.stop()
    flushFrame(1032)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("retires a callback already selected in the current frame", () => {
    const update = jest.fn()
    const driver = frameloopDriver(update)
    frame.update(() => driver.stop())
    driver.start()
    flushFrame(1016)
    expect(update).not.toHaveBeenCalled()
  })

  it("does not let a selected old run drive a replacement run", () => {
    const update = jest.fn()
    const driver = frameloopDriver(update)
    frame.update(() => {
      driver.stop()
      driver.start(false)
    })
    driver.start()
    flushFrame(1016)
    expect(update).not.toHaveBeenCalled()
    flushFrame(1032)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenLastCalledWith(1032)
    driver.stop()
  })

  it("deduplicates repeated starts and honors single-frame seeking", () => {
    const update = jest.fn()
    const driver = frameloopDriver(update)
    driver.start()
    driver.start(false)
    flushFrame(1016)
    flushFrame(1032)
    expect(update).toHaveBeenCalledTimes(1)
    driver.stop()
  })

  it("uses the current processing timestamp for the native driver clock", () => {
    const driver = frameloopDriver(jest.fn())
    const observed: number[] = []
    frame.update(() => observed.push(driver.now()))
    flushFrame(1234)
    expect(observed).toEqual([1234])
  })

  it("keeps source phase order and same-phase immediate scheduling", () => {
    const scheduled: Array<() => void> = []
    const batcher = createRenderBatcher((callback) => scheduled.push(callback), true)
    const trace: string[] = []
    batcher.schedule.render(() => trace.push("render"))
    batcher.schedule.read(() => trace.push("read"))
    batcher.schedule.update(() => {
      trace.push("update")
      batcher.schedule.update(() => trace.push("immediate"), false, true)
    })
    batcher.schedule.postRender(() => trace.push("postRender"))
    scheduled.shift()?.()
    expect(trace).toEqual(["read", "update", "immediate", "render", "postRender"])
  })

  it("cancels retained keepAlive processes", () => {
    const update = jest.fn()
    frame.update(update, true)
    flushFrame(1016)
    cancelFrame(update)
    flushFrame(1032)
    expect(update).toHaveBeenCalledTimes(1)
  })
})

describe("source-owned native motion values", () => {
  it("tracks same-frame velocity, explicit velocity and the 30ms expiry", () => {
    const value = motionValue("0px")
    time.set(1010)
    value.set("10px")
    value.set("15px")
    expect(value.getPrevious()).toBe("10px")
    expect(value.getVelocity()).toBe(1500)
    time.set(1020)
    value.set("35px")
    expect(value.getVelocity()).toBe(2000)
    value.setWithVelocity("10px", "30px", 20)
    expect(value.getVelocity()).toBe(1000)
    time.set(1051)
    expect(value.getVelocity()).toBe(0)
  })

  it("ignores duplicate values and preserves source notification arguments", () => {
    const value = motionValue(1)
    const change = jest.fn()
    value.on("change", change)
    value.set(1)
    value.set(2)
    expect(change.mock.calls).toEqual([[2, undefined, undefined]])
    value.destroy()
  })

  it("supports arbitrary caller values without coercion", () => {
    const initial = Object.freeze({ id: "first" })
    const next = Object.freeze({ id: "second" })
    const value = motionValue<{ readonly id: string }>(initial)
    value.set(next)
    expect(value.get()).toBe(next)
    expect(value.getPrevious()).toBe(initial)
    expect(value.getVelocity()).toBe(0)
  })

  it("retains passive effects and resets velocity on jump", () => {
    const value = motionValue(0)
    const stopPassive = jest.fn()
    value.attach((incoming, setter) => setter(incoming * 2), stopPassive)
    time.set(1010)
    value.set(5)
    expect(value.get()).toBe(10)
    value.jump(7)
    expect(value.get()).toBe(7)
    expect(value.getVelocity()).toBe(0)
    expect(stopPassive).toHaveBeenCalledTimes(1)
    value.destroy()
  })

  it("stops an animation after the final change listener retires", () => {
    const value = motionValue(0)
    const unsubscribe = value.on("change", jest.fn())
    const driver = makeDriver()
    void value.start(
      () => new JSAnimation({ keyframes: [0, 100], duration: 100, driver: driver.driver, motionValue: value }),
    )
    expect(value.isAnimating()).toBe(true)
    unsubscribe()
    expect(value.isAnimating()).toBe(true)
    flushFrame(1016)
    expect(value.isAnimating()).toBe(false)
    value.destroy()
  })

  it("keeps an animation when another listener subscribes before the next read", () => {
    const value = motionValue(0)
    const first = value.on("change", jest.fn())
    const driver = makeDriver()
    void value.start(() => new JSAnimation({ keyframes: [0, 100], duration: 100, driver: driver.driver }))
    first()
    value.on("change", jest.fn())
    flushFrame(1016)
    expect(value.isAnimating()).toBe(true)
    value.destroy()
  })

  it("tracks dependents of a different value type without retaining removed dependents", () => {
    const source = motionValue(0)
    const dependent = motionValue("derived")
    const change = jest.fn()
    dependent.on("change", change)
    source.addDependent(dependent)
    source.set(1)
    expect(change).toHaveBeenCalledWith("derived", undefined, undefined)
    source.removeDependent(dependent)
    source.set(2)
    expect(change).toHaveBeenCalledTimes(1)
    source.destroy()
    dependent.destroy()
  })

  it("preserves live ordered subscription changes during dispatch", () => {
    const manager = new SubscriptionManager<(value: number) => void>()
    const trace: string[] = []
    let retireSecond = () => {}
    manager.add(() => {
      trace.push("first")
      retireSecond()
    })
    retireSecond = manager.add(() => trace.push("second"))
    manager.add(() => trace.push("third"))
    manager.notify(1)
    expect(trace).toEqual(["first", "third"])
  })
})

describe("native animation playback contracts", () => {
  it("keeps millisecond generator timing and second playback controls", () => {
    const driver = makeDriver()
    const update = jest.fn()
    const animation = new JSAnimation({
      keyframes: [0, 100],
      duration: 200,
      delay: 50,
      ease: "linear",
      driver: driver.driver,
      onUpdate: update,
    })
    expect(animation.duration).toBe(0.2)
    expect(animation.iterationDuration).toBe(0.25)
    driver.advance(1025)
    expect(update).toHaveBeenLastCalledWith(0)
    driver.advance(1150)
    expect(update).toHaveBeenLastCalledWith(50)
    expect(animation.time).toBe(0.1)
    animation.stop()
  })

  it("resolves finished after the final update and completion callback", async () => {
    const driver = makeDriver()
    const trace: string[] = []
    const animation = new JSAnimation({
      keyframes: [0, 100],
      duration: 100,
      driver: driver.driver,
      onUpdate: () => trace.push("update"),
      onComplete: () => trace.push("complete"),
    })
    void animation.finished.then(() => trace.push("finished"))
    driver.advance(1100)
    expect(trace).toEqual(["update", "complete"])
    await Promise.resolve()
    expect(trace).toEqual(["update", "complete", "finished"])
    expect(animation.state).toBe("finished")
  })

  it.each(["stop", "cancel"] as const)("preserves the pinned pending finished promise on %s", async (ending) => {
    const driver = makeDriver()
    const animation = new JSAnimation({ keyframes: [0, 100], duration: 100, driver: driver.driver })
    let finished = false
    void animation.finished.then(() => {
      finished = true
    })
    driver.advance(1040)
    animation[ending]()
    driver.advance(1200)
    await Promise.resolve()
    expect(finished).toBe(false)
    expect(animation.state).toBe("idle")
  })

  it("prevents stopped playback from resuming", () => {
    const driver = makeDriver()
    const update = jest.fn()
    const animation = new JSAnimation({ keyframes: [0, 100], duration: 100, driver: driver.driver, onUpdate: update })
    driver.advance(1040)
    animation.stop()
    const calls = update.mock.calls.length
    animation.play()
    driver.advance(1100)
    expect(update).toHaveBeenCalledTimes(calls)
  })

  it("retires an interrupted value animation and its subscribers on destroy", () => {
    const value = motionValue(0)
    const driver = makeDriver()
    const firstStop = jest.fn()
    const cancel = jest.fn()
    const change = jest.fn()
    value.on("animationCancel", cancel)
    value.on("change", change)
    const start = (target: number, onStop?: () => void) =>
      value.start(
        (resolve) =>
          new JSAnimation({
            keyframes: [value.get(), target],
            duration: 100,
            ease: "linear",
            driver: driver.driver,
            onStop,
            onUpdate: (latest) => value.set(latest),
            onComplete: resolve,
            motionValue: value,
          }),
      )
    void start(100, firstStop)
    driver.advance(1040)
    expect(value.get()).toBe(40)
    void start(200)
    expect(firstStop).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)
    value.destroy()
    const calls = change.mock.calls.length
    driver.advance(1200)
    expect(change).toHaveBeenCalledTimes(calls)
    expect(value.isAnimating()).toBe(false)
  })
})
