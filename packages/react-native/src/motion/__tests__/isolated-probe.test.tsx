import { act, fireEvent, render } from "@testing-library/react-native"
import { useEffect, useSyncExternalStore } from "react"
import { TextInput, TurboModuleRegistry, View } from "react-native"
import type { View as NativeView } from "react-native"

import { geometryPacket } from "../../input/__tests__/motionGeometry.fixture"
import { NativeMotionGeometryObserver, registerNativeMotionGeometryObserver } from "../../input/motionGeometry"
import { frameData, MotionGlobalConfig, motionValue, time } from "../kernel"
import { NativeMotionIsolatedGeometryState } from "../measurement/isolatedGeometry"
import { NativeMotionOwner } from "../owner/NativeMotionOwner"
import { NativeMotionProbeIsolation } from "../value/isolated-probe"
import type { TNativeMotionResolutionToken } from "../value/types"
import { NativeMotionVisualState } from "../visual/state"

// Real source MotionValues/React/private visual state, without mounted native proof.
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
    listeners,
  }
}
const frames = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
let sequence = 0
const flush = (timestamp = 1016) => {
  frameData.timestamp = timestamp
  const selected = [...frames.values()]
  frames.clear()
  for (const callback of selected) callback(timestamp)
}
beforeEach(() => {
  MotionGlobalConfig.useManualTiming = true
  frameData.timestamp = 1000
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((callback) => {
    const id = ++sequence
    frames.set(id, callback)
    return id
  })
})
afterEach(() => {
  flush(9000)
  frames.clear()
  MotionGlobalConfig.useManualTiming = false
  jest.restoreAllMocks()
})

it("keeps stable original-value bindings and real target/restored public jumps with zero final velocity", () => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn()
  const isolation = new NativeMotionProbeIsolation({ onError: errors })
  const native = jest.fn(),
    restored = jest.fn(),
    seen: unknown[] = []
  value.on("change", (next) => seen.push(next))
  const jump = jest.spyOn(value, "jump"),
    binding = isolation.binding(value)
  const stop = binding.on("change", native),
    stopRestored = isolation.observeRestored(value, restored)
  expect(isolation.binding(value)).toBe(binding)
  isolation.probe("width", value, 20, "target", lease)
  expect(value.get()).toBe(20)
  expect(value.getVelocity()).toBe(0)
  expect(binding.get()).toBe(5)
  expect(isolation.isProbing(value)).toBe(true)
  isolation.probe("width", value, 5, "restored", lease)
  expect(seen).toEqual([20, 5])
  expect(jump.mock.calls).toEqual([
    [20, false],
    [5, false],
  ])
  expect(value.getVelocity()).toBe(0)
  expect(native).not.toHaveBeenCalled()
  expect(restored).toHaveBeenCalledTimes(1)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  value.set(8)
  expect(native).toHaveBeenCalledWith(8)
  expect(errors).not.toHaveBeenCalled()
  stop()
  stopRestored()
})

it("never exposes a target to the real private visual state or held-empty React editor", async () => {
  const value = motionValue(5),
    lease = token(),
    isolation = new NativeMotionProbeIsolation()
  const visual = new NativeMotionVisualState({ width: isolation.binding(value) })
  const changed = jest.fn(),
    mounted = jest.fn(),
    unmounted = jest.fn(),
    publicValues: number[] = []
  const Editor = () => {
    const latest = useSyncExternalStore(visual.subscribe, visual.getSnapshot, visual.getSnapshot)
    useEffect(() => {
      mounted()
      return unmounted
    }, [])
    return (
      <View testID="root" style={latest}>
        <TextInput testID="editor" value="" selection={{ start: 0, end: 0 }} onChangeText={changed} />
      </View>
    )
  }
  visual.attach()
  const ui = await render(<Editor />),
    root = ui.getByTestId("root"),
    editor = ui.getByTestId("editor")
  value.on("change", (next) => {
    publicValues.push(next)
    flush()
    expect(visual.getSnapshot()).toEqual({ width: 5 })
    expect(isolation.binding(value).get()).toBe(5)
  })
  await act(() => isolation.probe("width", value, 400, "target", lease))
  await act(() => flush(1032))
  expect(root.props.style).toEqual({ width: 5 })
  await act(() => isolation.probe("width", value, 5, "restored", lease))
  expect(publicValues).toEqual([400, 5])
  expect(ui.getByTestId("editor")).toBe(editor)
  expect(editor.props.value).toBe("")
  expect(editor.props.selection).toEqual({ start: 0, end: 0 })
  await fireEvent.changeText(editor, "")
  expect(changed).toHaveBeenCalledWith("")
  expect(mounted).toHaveBeenCalledTimes(1)
  expect(unmounted).not.toHaveBeenCalled()
  visual.detach()
  await ui.unmount()
})

it("holds one shared source across properties and releases only after the final restoration", () => {
  const value = motionValue(5),
    first = token(),
    second = token(),
    isolation = new NativeMotionProbeIsolation()
  const native = jest.fn(),
    restored = jest.fn(),
    seen: number[] = []
  value.on("change", (next) => seen.push(next))
  const stop = isolation.binding(value).on("change", native)
  isolation.observeRestored(value, restored)
  isolation.probe("width", value, 20, "target", first)
  isolation.probe("height", value, 30, "target", second)
  isolation.probe("width", value, 5, "restored", first)
  expect(isolation.isProbing(value)).toBe(true)
  expect(restored).not.toHaveBeenCalled()
  isolation.probe("height", value, 5, "restored", second)
  expect(isolation.isProbing(value)).toBe(false)
  expect(seen).toEqual([20, 30, 5])
  expect(restored).toHaveBeenCalledTimes(1)
  expect(native).not.toHaveBeenCalled()
  expect(first.listeners.size + second.listeners.size).toBe(0)
  stop()
})

it.each(["token", "owner", "replace", "canAct"])("restores only its owned target on %s retirement", (reason) => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn()
  let active = true
  const isolation = new NativeMotionProbeIsolation({ onError: errors, canAct: () => active })
  const seen: number[] = [],
    native = jest.fn()
  value.on("change", (next) => seen.push(next))
  const stop = isolation.binding(value).on("change", native)
  isolation.probe("width", value, 20, "target", lease)
  if (reason === "token") lease.cancel()
  else if (reason === "owner") isolation.cancel()
  else if (reason === "canAct") {
    active = false
    expect(() => isolation.probe("width", value, 30, "target", lease)).toThrow("retired")
  } else {
    const replacement = token()
    isolation.probe("width", value, 30, "target", replacement)
    isolation.probe("width", value, 5, "restored", replacement)
  }
  expect(value.get()).toBe(5)
  expect(value.getVelocity()).toBe(0)
  expect(native).not.toHaveBeenCalled()
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  expect(seen).toEqual(reason === "replace" ? [20, 5, 30, 5] : [20, 5])
  isolation.probe("width", value, 100, "restored", lease)
  expect(value.get()).toBe(5)
  stop()
})

it.each(["during", "between", "restore"])("preserves a reentrant external new value %s probe stages", (phase) => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn(),
    isolation = new NativeMotionProbeIsolation({ onError: errors })
  const native = jest.fn(),
    seen: number[] = []
  value.on("change", (next) => {
    seen.push(next)
    if ((phase === "during" && next === 20) || (phase === "restore" && next === 5)) value.set(99)
  })
  const stop = isolation.binding(value).on("change", native)
  if (phase === "during") expect(() => isolation.probe("width", value, 20, "target", lease)).toThrow("external")
  else {
    isolation.probe("width", value, 20, "target", lease)
    if (phase === "between") value.set(99)
    else expect(() => isolation.probe("width", value, 5, "restored", lease)).toThrow("external")
  }
  expect(value.get()).toBe(99)
  expect(native.mock.calls).toEqual([[99]])
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  expect(() => isolation.probe("width", value, 30, "target", lease)).toThrow("retired")
  isolation.probe("width", value, 5, "restored", lease)
  isolation.cancel()
  expect(value.get()).toBe(99)
  expect(errors).toHaveBeenCalled()
  expect(seen).toContain(99)
  stop()
})

it("detects an identical reentrant set when the final public notification is observable", () => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn(),
    isolation = new NativeMotionProbeIsolation({ onError: errors })
  value.on("change", (next) => {
    if (next === 20) value.set(20)
  })
  expect(() => isolation.probe("width", value, 20, "target", lease)).toThrow("external")
  expect(value.get()).toBe(20)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
})

it.each(["target", "restore", "both"])("cleans every hold when a public %s callback throws", (phase) => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn(),
    failure = new Error("caller failed")
  const isolation = new NativeMotionProbeIsolation({ onError: errors })
  value.on("change", (next) => {
    if (phase === "both" || (phase === "target" && next === 20) || (phase === "restore" && next === 5)) throw failure
  })
  if (phase === "restore") isolation.probe("width", value, 20, "target", lease)
  expect(() =>
    isolation.probe("width", value, phase === "restore" ? 5 : 20, phase === "restore" ? "restored" : "target", lease),
  ).toThrow(failure)
  expect(value.get()).toBe(5)
  expect(value.getVelocity()).toBe(0)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  expect(errors).toHaveBeenCalledWith(failure)
})

it("finishes cancellation during public target delivery before unmasking any visual subscriber", () => {
  const value = motionValue(5),
    lease = token(),
    isolation = new NativeMotionProbeIsolation(),
    native = jest.fn()
  value.on("change", (next) => {
    if (next === 20) lease.cancel()
  })
  const stop = isolation.binding(value).on("change", native)
  isolation.probe("width", value, 20, "target", lease)
  expect(value.get()).toBe(5)
  expect(native).not.toHaveBeenCalled()
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  stop()
})

it("retires every connected shared-value/token hold without leaking another property", () => {
  const x = motionValue(1),
    y = motionValue(2),
    first = token(),
    second = token(),
    errors = jest.fn()
  const isolation = new NativeMotionProbeIsolation({ onError: errors })
  isolation.probe("width", x, 20, "target", first)
  isolation.probe("height", y, 30, "target", first)
  isolation.probe("scale", y, 40, "target", second)
  x.set(99)
  expect(x.get()).toBe(99)
  expect(y.get()).toBe(2)
  expect(isolation.isProbing(x) || isolation.isProbing(y)).toBe(false)
  expect(first.listeners.size + second.listeners.size).toBe(0)
  expect(() => isolation.probe("scale", y, 50, "target", second)).toThrow("retired")
})

it("retains another property's shared-value hold when one independent token cancels", () => {
  const value = motionValue(5),
    first = token(),
    second = token(),
    isolation = new NativeMotionProbeIsolation()
  isolation.probe("width", value, 20, "target", first)
  isolation.probe("height", value, 30, "target", second)
  first.cancel()
  expect(isolation.isProbing(value)).toBe(true)
  expect(isolation.binding(value).get()).toBe(5)
  isolation.probe("height", value, 5, "restored", second)
  expect(value.get()).toBe(5)
  expect(isolation.isProbing(value)).toBe(false)
  expect(first.listeners.size + second.listeners.size).toBe(0)
})

it("notifies every restored observer and cleans holds even when a private listener throws", () => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn(),
    failure = new Error("native callback failed")
  const isolation = new NativeMotionProbeIsolation({ onError: errors }),
    later = jest.fn()
  const stop = isolation.binding(value).on("change", () => {
    throw failure
  })
  isolation.observeRestored(value, () => {
    throw failure
  })
  isolation.observeRestored(value, later)
  isolation.probe("width", value, 20, "target", lease)
  expect(() => isolation.probe("width", value, 6, "restored", lease)).toThrow(failure)
  expect(value.get()).toBe(6)
  expect(later).toHaveBeenCalledTimes(1)
  expect(lease.listeners.size).toBe(0)
  expect(isolation.isProbing(value)).toBe(false)
  stop()
})

it("cleans a synchronously cancelled or throwing cancellation registration without writing a probe", () => {
  const value = motionValue(5),
    errors = jest.fn(),
    isolation = new NativeMotionProbeIsolation({ onError: errors }),
    cleanup = jest.fn()
  const immediate: TNativeMotionResolutionToken = {
    isCurrent: () => true,
    onCancel: (cancel) => {
      cancel()
      return cleanup
    },
  }
  expect(() => isolation.probe("width", value, 20, "target", immediate)).toThrow("cancelled")
  expect(cleanup).toHaveBeenCalledTimes(1)
  const broken: TNativeMotionResolutionToken = {
    isCurrent: () => true,
    onCancel: () => {
      throw new Error("registration failed")
    },
  }
  expect(() => isolation.probe("width", value, 20, "target", broken)).toThrow("registration failed")
  expect(value.get()).toBe(5)
  expect(isolation.isProbing(value)).toBe(false)
})

it("preserves public animation ownership by using jump(false) and allows fresh tokens after cancellation", () => {
  const value = motionValue(5),
    lease = token(),
    stop = jest.fn(),
    isolation = new NativeMotionProbeIsolation()
  value.on("change", () => {})
  value.animation = { stop } as never
  isolation.probe("width", value, 20, "target", lease)
  isolation.cancel()
  expect(stop).not.toHaveBeenCalled()
  const next = token()
  isolation.probe("width", value, 30, "target", next)
  isolation.probe("width", value, 5, "restored", next)
  expect(value.get()).toBe(5)
  expect(stop).not.toHaveBeenCalled()
})

it("retires a destroyed public MotionValue and releases its cancellation listener", () => {
  const value = motionValue(5),
    lease = token(),
    errors = jest.fn()
  const isolation = new NativeMotionProbeIsolation({ onError: errors })
  isolation.probe("width", value, 20, "target", lease)
  value.destroy()
  expect(value.get()).toBe(5)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
  expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("destroyed") }))
})

it("cleans existing holds if the owner guard throws before a later stage", () => {
  const value = motionValue(5),
    lease = token(),
    failure = new Error("guard failed"),
    errors = jest.fn()
  let broken = false
  const isolation = new NativeMotionProbeIsolation({
    onError: errors,
    canAct: () => {
      if (broken) throw failure
      return true
    },
  })
  isolation.probe("width", value, 20, "target", lease)
  broken = true
  expect(() => isolation.probe("width", value, 30, "target", lease)).toThrow(failure)
  expect(value.get()).toBe(5)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
})

it("does not expose a new reentrant target to later private restoration subscribers", () => {
  const value = motionValue(5),
    first = token(),
    second = token(),
    isolation = new NativeMotionProbeIsolation()
  const later = jest.fn(),
    restored = jest.fn()
  let replaced = false
  const firstStop = isolation.binding(value).on("change", () => {
    if (replaced) return
    replaced = true
    isolation.probe("height", value, 80, "target", second)
  })
  const laterStop = isolation.binding(value).on("change", later)
  isolation.observeRestored(value, restored)
  isolation.probe("width", value, 20, "target", first)
  isolation.probe("width", value, 6, "restored", first)
  expect(isolation.isProbing(value)).toBe(true)
  expect(later).not.toHaveBeenCalled()
  expect(restored).not.toHaveBeenCalled()
  isolation.probe("height", value, 6, "restored", second)
  expect(restored).toHaveBeenCalledTimes(1)
  expect(later.mock.calls).toEqual([[6]])
  expect(later).not.toHaveBeenCalledWith(80)
  firstStop()
  laterStop()
})

it("uses actual set callbacks/passive outputs and preserves set velocity without stopping the effect", () => {
  const value = motionValue(4),
    lease = token(),
    stopEffect = jest.fn(),
    calls: unknown[] = []
  const isolation = new NativeMotionProbeIsolation(),
    native = jest.fn()
  value.attach((next, update) => {
    calls.push(["effect", next])
    update(next * 2)
  }, stopEffect)
  value.on("change", (next) => calls.push(["change", next]))
  const stop = isolation.binding(value).on("change", native)
  time.set(1016)
  isolation.setProbe("scale", value, 1, "target", lease)
  expect(value.get()).toBe(2)
  expect(value.getVelocity()).not.toBe(0)
  expect(isolation.binding(value).get()).toBe(4)
  expect(native).not.toHaveBeenCalled()
  time.set(1032)
  isolation.setProbe("scale", value, 4, "restored", lease)
  expect(calls).toEqual([
    ["effect", 1],
    ["change", 2],
    ["effect", 4],
    ["change", 8],
  ])
  expect(value.get()).toBe(8)
  expect(native.mock.calls).toEqual([[8]])
  expect(stopEffect).not.toHaveBeenCalled()
  expect(lease.listeners.size).toBe(0)
  stop()
})

it("retains repeated synchronous passive outputs under one controlled set hold", () => {
  const value = motionValue(4),
    lease = token(),
    isolation = new NativeMotionProbeIsolation(),
    native = jest.fn()
  value.attach((next, update) => {
    update(next)
    update(next + 1)
  }, jest.fn())
  const stop = isolation.binding(value).on("change", native)
  isolation.setProbe("scale", value, 1, "target", lease)
  expect(value.get()).toBe(2)
  expect(native).not.toHaveBeenCalled()
  isolation.setProbe("scale", value, 4, "restored", lease)
  expect(value.get()).toBe(5)
  expect(native.mock.calls).toEqual([[5]])
  stop()
})

it.each(["target", "restore"])(
  "preserves distinct reentrant values when a controlled %s set callback throws",
  (phase) => {
    const value = motionValue(4),
      lease = token(),
      failure = new Error("set caller failed"),
      errors = jest.fn()
    const isolation = new NativeMotionProbeIsolation({ onError: errors })
    value.on("change", (next) => {
      if ((phase === "target" && next === 1) || (phase === "restore" && next === 4)) value.set(99)
      if (next === 99) throw failure
    })
    if (phase === "restore") isolation.setProbe("scale", value, 1, "target", lease)
    expect(() =>
      isolation.setProbe("scale", value, phase === "target" ? 1 : 4, phase === "target" ? "target" : "restored", lease),
    ).toThrow(failure)
    expect(value.get()).toBe(99)
    expect(isolation.isProbing(value)).toBe(false)
    expect(lease.listeners.size).toBe(0)
  },
)

it("keeps set and jump holds separate for the same controlled measurement source", () => {
  const value = motionValue<unknown>(5),
    lease = token(),
    isolation = new NativeMotionProbeIsolation(),
    seen: unknown[] = []
  value.on("change", (next) => seen.push(next))
  isolation.setProbe("translateX", value, 0, "target", lease)
  isolation.probe("translateX", value, "50%", "target", lease)
  isolation.setProbe("translateX", value, 5, "restored", lease)
  expect(isolation.isProbing(value)).toBe(true)
  isolation.probe("translateX", value, 0, "restored", lease)
  expect(seen).toEqual([0, "50%", 5, 0])
  expect(value.get()).toBe(0)
  expect(isolation.isProbing(value)).toBe(false)
  expect(lease.listeners.size).toBe(0)
})

it("removes/restores only pinned ordered controlled transforms and keeps pathRotation/translations", () => {
  const values = {
    rotate: motionValue<unknown>(30),
    scale: motionValue<unknown>(2),
    translateX: motionValue<unknown>(5),
    x: motionValue<unknown>(7),
    pathRotation: motionValue<unknown>(11),
    width: motionValue<unknown>(120),
  }
  const owner = new NativeMotionOwner({ props: {}, base: {}, values, config: {}, reduced: false, canAct: () => true })
  const release = owner.attach({} as NativeView),
    lease = token(),
    trace: unknown[] = []
  for (const [name, value] of Object.entries(values)) value.on("change", (next) => trace.push([name, next]))
  const visual = new NativeMotionVisualState(owner.getBindings())
  visual.attach()
  const initial = visual.getSnapshot(),
    projections: unknown[] = []
  const stopProjection = owner.subscribeProjectionValues(() => projections.push({ ...owner.latestValues }))
  const restore = owner.beginIsolatedTransforms(lease)
  expect(trace).toEqual([
    ["translateX", 0],
    ["scale", 1],
    ["rotate", 0],
  ])
  expect(owner.latestValues).toMatchObject({ translateX: 5, scale: 2, rotate: 30, x: 7, pathRotation: 11 })
  expect(owner.buildIsolatedStage({}).transform).toEqual([{ translateX: 7 }, { rotate: "11deg" }])
  owner.isolatedProbe("width", "auto", "target", lease)
  restore()
  owner.isolatedProbe("width", 120, "restored", lease)
  flush()
  expect(trace).toEqual([
    ["translateX", 0],
    ["scale", 1],
    ["rotate", 0],
    ["width", "auto"],
    ["translateX", 5],
    ["scale", 2],
    ["rotate", 30],
    ["width", 120],
  ])
  expect(visual.getSnapshot()).toBe(initial)
  expect(
    projections.every(
      (entry) => (entry as { scale: number }).scale === 2 && (entry as { rotate: number }).rotate === 30,
    ),
  ).toBe(true)
  restore()
  expect(trace).toHaveLength(8)
  stopProjection()
  visual.detach()
  release()
})

it("builds isolated stage transforms from actual synchronous passive outputs", () => {
  const scale = motionValue<unknown>(4),
    stopEffect = jest.fn()
  scale.attach((next, update) => update(Number(next) * 2), stopEffect)
  const owner = new NativeMotionOwner({
    props: {},
    base: {},
    values: { scale },
    config: {},
    reduced: false,
    canAct: () => true,
  })
  const release = owner.attach({} as NativeView),
    lease = token()
  const restore = owner.beginIsolatedTransforms(lease)
  expect(owner.buildIsolatedStage({}).transform).toEqual([{ scale: 2 }])
  expect(owner.latestValues.scale).toBe(4)
  restore()
  expect(scale.get()).toBe(8)
  expect(owner.latestValues.scale).toBe(8)
  expect(stopEffect).not.toHaveBeenCalled()
  release()
})

it("restores the remaining transforms and preserves an undefined thrown by a public restoration callback", () => {
  const scale = motionValue<unknown>(2),
    rotate = motionValue<unknown>(30),
    errors = jest.fn()
  const owner = new NativeMotionOwner({
    props: {},
    base: {},
    values: { scale, rotate },
    config: {},
    reduced: false,
    canAct: () => true,
    onMeasurementError: errors,
  })
  const release = owner.attach({} as NativeView),
    lease = token()
  scale.on("change", (next) => {
    if (next === 2) throw undefined
  })
  const restore = owner.beginIsolatedTransforms(lease)
  let failed = false
  try {
    restore()
  } catch (error) {
    failed = true
    expect(error).toBeUndefined()
  }
  expect(failed).toBe(true)
  expect(scale.get()).toBe(2)
  expect(rotate.get()).toBe(30)
  expect(lease.listeners.size).toBe(0)
  release()
})

it("restores held transform sets during owner detach without reporting expected owner loss as a measurement failure", () => {
  const scale = motionValue<unknown>(4),
    errors = jest.fn()
  const owner = new NativeMotionOwner({
    props: {},
    base: {},
    values: { scale },
    config: {},
    reduced: false,
    canAct: () => true,
    onMeasurementError: errors,
  })
  const release = owner.attach({} as NativeView),
    lease = token()
  const restore = owner.beginIsolatedTransforms(lease)
  release()
  expect(scale.get()).toBe(4)
  expect(lease.listeners.size).toBe(0)
  expect(errors).not.toHaveBeenCalled()
  restore()
  expect(scale.get()).toBe(4)
})

it.each(["success", "failure", "cancel"])(
  "restores controlled sets around native query %s in pinned notification order",
  async (outcome) => {
    const target = { isConnected: true } as unknown as NativeView,
      lease = token(),
      scale = motionValue(4)
    const trace: string[] = [],
      isolation = new NativeMotionProbeIsolation({ onError: jest.fn() })
    scale.on("change", (value) => trace.push(`scale:${value}`))
    let revision = 0,
      complete!: (value: string) => void
    const observer = new NativeMotionGeometryObserver({
      ownerId: "owner",
      bindingId: "binding",
      target: () => 71,
      scope: () => ({ ownerId: "scope", windowId: "window", epoch: 2 }),
      dispatch: (requestId) => observer.receive(geometryPacket({ requestId, geometryRevision: ++revision })),
    })
    const release = registerNativeMotionGeometryObserver(target, observer)
    jest.spyOn(jest.requireActual<typeof import("react-native")>("react-native"), "findNodeHandle").mockReturnValue(71)
    let request!: { stages: Array<{ index: number }>; [key: string]: unknown }
    const backend = jest.fn((encoded: string) => {
      trace.push("evaluate")
      request = JSON.parse(encoded)
      return outcome === "failure"
        ? Promise.reject(new Error("native failed"))
        : new Promise<string>((resolve) => {
            complete = resolve
          })
    })
    jest.spyOn(TurboModuleRegistry, "get").mockReturnValue({ evaluateLayout: backend } as never)
    const state = new NativeMotionIsolatedGeometryState(
      (patch) => patch,
      (queryToken) => {
        isolation.setProbe("scale", scale, 1, "target", queryToken)
        return () => isolation.setProbe("scale", scale, 4, "restored", queryToken)
      },
    )
    const pending = state.resolve(target, "width", [100, "auto"], lease, undefined, (_value, phase) =>
      trace.push(phase),
    )
    void pending.catch(() => {})
    for (let index = 0; index < 20; index++) await Promise.resolve()
    if (outcome === "success") {
      complete(
        JSON.stringify({
          ...request,
          kind: "evaluated-layout",
          surfaceId: 1,
          fabricRevision: "2",
          results: request.stages.map((stage) => ({ index: stage.index, metrics: { width: stage.index ? 200 : 100 } })),
        }),
      )
      await expect(pending).resolves.toMatchObject({ keyframes: [100, 200] })
      expect(trace).toEqual(["scale:1", "evaluate", "target", "scale:4", "restored"])
    } else {
      if (outcome === "cancel") lease.cancel()
      await expect(pending).rejects.toThrow()
      for (let index = 0; index < 20; index++) await Promise.resolve()
      expect(trace).toEqual(["scale:1", "evaluate", "scale:4"])
    }
    expect(scale.get()).toBe(4)
    expect(isolation.isProbing(scale)).toBe(false)
    expect(lease.listeners.size).toBe(0)
    state.cancel()
    release()
  },
)
