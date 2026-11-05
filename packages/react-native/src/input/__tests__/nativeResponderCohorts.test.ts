import type { NativeTouchEvent } from "react-native"

import { createNativeResponderCohorts } from "../nativePressCycle"
import { captureNativeOrdinaryEditorFocus, createNativeOrdinaryEditorKeys } from "../ordinaryEditorKeys"
import type { NativeResponderCohortData } from "../specs/CUIFocusViewNativeComponent"

const packet = (extra: Partial<NativeResponderCohortData> = {}): NativeResponderCohortData => ({
  ownerId: "button",
  bindingId: "binding",
  target: 9,
  sourceTarget: 17,
  surfaceId: 1,
  identifier: 0,
  cycleId: 1,
  cohort: "mouse",
  phase: "start",
  windowId: "window",
  scopeOwnerId: "scope",
  epoch: 5,
  ...extra,
})
const touch = (extra: Record<string, unknown> = {}) =>
  ({ target: 17, identifier: 0, targetSurface: 1, ...extra }) as unknown as NativeTouchEvent
it.each(["mouse", "unknown"])(
  "requires the producer's exact target, surface and serialized responder identifier for %s",
  (cohort) => {
    for (const mismatch of [
      { target: 18 },
      { targetSurface: 2 },
      { identifier: 1 },
      { identifier: "0" },
      { targetSurface: undefined },
    ]) {
      const source = createNativeResponderCohorts()
      source.receive(packet({ cohort }))
      expect(source.grant(touch(mismatch))).toBeNull()
    }
    const source = createNativeResponderCohorts()
    source.receive(packet({ cohort }))
    const record = source.grant(touch())!
    expect(record.cohort).toBe(cohort)
    expect(record.semanticCohort).toBe(cohort === "unknown" ? "responder" : cohort)
    expect(source.current(record)).toBe(true)
  },
)
it("pins the granted cohort across other pointers and retains normal terminal data through release", () => {
  const source = createNativeResponderCohorts()
  source.receive(packet())
  const record = source.grant(touch())!
  source.receive(packet({ identifier: 1, cycleId: 2, cohort: "touch" }))
  source.receive(packet({ phase: "end" }))
  expect(source.current(record)).toBe(true)
  expect(record.cohort).toBe("mouse")
  const replacement = source.grant(touch({ identifier: 1 }))!
  expect(source.current(record)).toBe(false)
  expect(source.current(replacement)).toBe(true)
  expect(replacement.cohort).toBe("touch")
  source.release()
  expect(source.current(replacement)).toBe(false)
  expect(source.grant(touch())).toBeNull()
})
it("retires cancelled producer cycles and rejects stale terminal edges after identifier reuse", () => {
  const source = createNativeResponderCohorts()
  source.receive(packet())
  const old = source.grant(touch())!
  source.receive(packet({ phase: "cancel" }))
  expect(source.current(old)).toBe(false)
  source.release()
  source.receive(packet({ cycleId: 2, cohort: "pen" }))
  const current = source.grant(touch())!
  source.receive(packet({ phase: "end" }))
  expect(source.current(current)).toBe(true)
  source.receive(packet({ cycleId: 1, phase: "retire" }))
  expect(source.current(current)).toBe(true)
  source.receive(packet({ cycleId: 3, cohort: "touch" }))
  expect(source.current(current)).toBe(false)
})
it("retains raw native unknown evidence while the actual matched grant admits a generic responder policy", () => {
  const source = createNativeResponderCohorts()
  source.receive(packet({ cohort: "unknown" }))
  const record = source.grant(touch())!
  expect(record.cohort).toBe("unknown")
  expect(record.semanticCohort).toBe("responder")
  expect(source.current(record)).toBe(true)
})
it("retirement rejects old generations and a new binding reset admits its own counter", () => {
  const source = createNativeResponderCohorts()
  source.receive(packet())
  const old = source.grant(touch())!
  source.receive(packet({ cycleId: 2, phase: "retire" }))
  expect(source.current(old)).toBe(false)
  source.receive(packet())
  expect(source.grant(touch())).toBeNull()
  source.reset()
  source.receive(packet())
  expect(source.current(source.grant(touch())!)).toBe(true)
})
it("captures editor focus from its own acknowledged binding epoch and the shared actual window", () => {
  const original = { _nativeTag: 17 } as unknown as import("react-native").TextInput
  const session = { windowId: "window", epoch: 71, active: true }
  const registry = createNativeOrdinaryEditorKeys("editor-owner", () => session)
  const before = Object.keys(registry)
  const lease = registry.register("editor", {
    original,
    current: () => original,
    canAct: () => true,
    receive: () => {},
  })
  const binding = registry.bindings()[0]
  registry.acceptStatus({
    ...binding,
    ownerId: "editor-owner",
    target: 17,
    windowId: "window",
    epoch: 71,
    sequence: 1,
    ready: true,
    windowActive: true,
    error: "",
  })
  const guard = captureNativeOrdinaryEditorFocus(registry, original, { windowId: "window" })!
  expect(guard()).toBe(true)
  expect(captureNativeOrdinaryEditorFocus(registry, original, { windowId: "other" })).toBeNull()
  expect(Object.keys(registry)).toEqual(before)
  expect(Object.keys(lease)).toEqual(["receive", "unregister"])
  session.epoch++
  expect(guard()).toBe(false)
  lease.unregister()
  expect(captureNativeOrdinaryEditorFocus(registry, original, { windowId: "window" })).toBeNull()
})

it("enrolls only opt-in original-editor bindings and removes the marker without changing legacy purpose or lease shape", () => {
  const original = { _nativeTag: 17 } as unknown as import("react-native").TextInput
  const registry = createNativeOrdinaryEditorKeys("scope", () => ({ windowId: "window", epoch: 1, active: true }))
  const config = { original, current: () => original, canAct: () => true, receive: () => {} }
  const legacy = registry.register("legacy", config)
  const before = registry.bindings()[0]
  expect(before).not.toHaveProperty("originalEditorAction")
  const opted = registry.register("stepper", { ...config, originalEditorAction: true })
  expect(registry.bindings()[0]).toMatchObject({ ...before, originalEditorAction: true })
  expect(Object.keys(opted)).toEqual(["receive", "unregister"])
  opted.unregister()
  expect(registry.bindings()).toEqual([before])
  legacy.unregister()
})
