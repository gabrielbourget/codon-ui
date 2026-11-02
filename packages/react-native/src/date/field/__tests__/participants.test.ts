import type { View } from "react-native"

import { registerNativeFocusTarget } from "../../../input/focus"
import { NativeDateFieldParticipantFocusManager } from "../participants"

const setup = () => {
  const root = { _nativeTag: 3 } as unknown as View
  const extra = { _nativeTag: 25 } as unknown as View
  const ref = { current: extra as View | null }
  const rows = [10, 11].map((target, index) => ({
    original: { _nativeTag: target } as unknown as View,
    identity: {
      target,
      ownerId: "field",
      segmentId: String(index),
      bindingRevision: "1",
      nativeInstance: String(index),
      surfaceId: 7,
      windowId: "window",
      epoch: 1,
    },
    isPlaceholder: true,
  }))
  let focused: View | null = rows[0].original
  let current: NonNullable<ReturnType<ConstructorParameters<typeof NativeDateFieldParticipantFocusManager>[0]>> = {
    root,
    owned: { root, rootTarget: 3, rows },
    participants: [ref],
  }
  const focus = jest.fn((_target: View | null) => true)
  const disabled = new Set<View>()
  const response = {
    rootTarget: 3,
    focusedTarget: 10,
    windowId: "window",
    before: null as number | null,
    rows: [
      { target: 10, eligible: true, tabStop: true, x: 20 },
      { target: 25, eligible: true, tabStop: true, x: 40 },
      { target: 11, eligible: true, tabStop: true, x: 60 },
    ],
  }
  const read = jest.fn(
    async (_request: {
      rootTarget: number
      targets: readonly number[]
      pressTarget?: number
      scopeTarget?: number
      inputRoots?: readonly number[]
    }) => JSON.stringify(response),
  )
  const release = registerNativeFocusTarget(extra, { canFocus: () => true, focus: () => {}, blur: () => {} })
  const manager = new NativeDateFieldParticipantFocusManager(() => current, {
    read,
    capture: (target) => (disabled.has(target) ? null : () => !disabled.has(target)),
    focus,
    focused: () => focused,
  })
  return {
    manager,
    rows,
    extra,
    ref,
    response,
    read,
    focus,
    release,
    disabled,
    replace: (value: typeof current) => {
      current = value
    },
    current: () => current,
    focused: (target: View | null) => {
      focused = target
      response.focusedTarget = target ? (target as unknown as { _nativeTag: number })._nativeTag : 0
    },
    flush: async () => {
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

it("uses native order for registered extras without creating date identities, replacing refs or observing requested focus", async () => {
  const f = setup()
  expect(f.manager.focusFromInput(f.rows[0].original, "next")).toBe(true)
  expect(f.focus).not.toHaveBeenCalled()
  await f.flush()
  expect(f.focus).toHaveBeenCalledWith(f.extra)
  expect(f.ref.current).toBe(f.extra)
  expect(f.extra).not.toHaveProperty("identity")
  f.manager.focusNext()
  await f.flush()
  expect(f.focus.mock.calls.map(([target]) => target)).toEqual([f.extra, f.extra])
  f.focused(f.extra)
  f.manager.focusNext()
  await f.flush()
  expect(f.focus).toHaveBeenLastCalledWith(f.rows[1].original)
  f.release()
})
it("keeps one input's membership bounded and uses native eligibility and tab stops", async () => {
  const f = setup()
  f.response.rows[1].eligible = false
  f.manager.focusNext()
  await f.flush()
  expect(f.focus).toHaveBeenLastCalledWith(f.rows[1].original)
  f.response.rows[1].eligible = true
  f.response.rows[1].tabStop = false
  f.manager.focusNext()
  await f.flush()
  expect(f.focus).toHaveBeenLastCalledWith(f.extra)
  f.manager.focusVisual(1)
  await f.flush()
  expect(f.focus).toHaveBeenLastCalledWith(f.rows[1].original)
  f.release()
})
it.each(["ref", "epoch", "root", "focus", "guard", "new-request", "retire"])(
  "rejects a queued participant query after %s changes",
  async (kind) => {
    const f = setup()
    f.manager.focusNext()
    if (kind === "ref") f.ref.current = null
    if (kind === "epoch") f.rows[0].identity.epoch++
    if (kind === "root") f.replace({ ...f.current(), root: {} as View })
    if (kind === "focus") f.focused(f.extra)
    if (kind === "guard") f.disabled.add(f.extra)
    if (kind === "new-request") {
      f.manager.focusFirst()
    }
    if (kind === "retire") f.manager.retire()

    await f.flush()
    if (kind === "new-request") expect(f.focus.mock.calls).toEqual([[f.rows[0].original]])
    else expect(f.focus).not.toHaveBeenCalled()
    f.release()
  },
)
it.each(["foreign", "duplicate", "window", "incomplete", "geometry"])("rejects %s native responses", async (kind) => {
  const f = setup()
  if (kind === "foreign") f.response.rows[1].target = 999
  if (kind === "duplicate") f.response.rows[1].target = 10
  if (kind === "window") f.response.windowId = "other"
  if (kind === "incomplete") f.response.rows.pop()
  if (kind === "geometry") f.response.rows[1].x = NaN
  f.manager.focusNext()
  await f.flush()
  expect(f.focus).not.toHaveBeenCalled()
  f.release()
})
it("rejects opaque or duplicate registered originals rather than silently skipping them", () => {
  const f = setup()
  f.ref.current = {} as View
  expect(() => f.manager.focusNext()).toThrow("opaque controls")
  f.ref.current = f.rows[0].original
  expect(() => f.manager.focusNext()).toThrow()
  f.release()
})
it("resolves group press from native order and prevents a stale delayed press from taking focus", async () => {
  const f = setup(),
    hit = { _nativeTag: 29 } as unknown as View
  f.response.before = 25
  const press = f.manager.capturePress(hit)
  expect(press?.()).toBe(true)
  await f.flush()
  expect(f.focus).toHaveBeenCalledWith(f.extra)
  const stale = f.manager.capturePress(hit)
  f.ref.current = null
  expect(stale?.()).toBe(false)
  f.release()
})

it("allows a nonfocusable owned background while preserving an independently focused native hit", async () => {
  const f = setup(),
    root = f.current().root
  f.disabled.add(root)
  const release = registerNativeFocusTarget(root, { canFocus: () => false, focus: () => {}, blur: () => {} })
  expect(f.manager.capturePress(root)?.()).toBe(true)
  await f.flush()
  // The nonplaceholder extra separates the final owned placeholder run.
  expect(f.focus).toHaveBeenCalledWith(f.rows[1].original)
  f.focus.mockClear()
  Object.assign(f.response, { pressIndependent: true })
  expect(f.manager.capturePress(root)?.()).toBe(true)
  await f.flush()
  expect(f.focus).not.toHaveBeenCalled()
  release()
  f.release()
})

it("passes a fixed native input boundary and rejects queued navigation when that original is replaced", async () => {
  const f = setup(),
    input = { _nativeTag: 31 } as unknown as View
  f.replace({ ...f.current(), scope: input })
  f.response.rows[1].eligible = false
  f.manager.focusNext()
  expect(f.read.mock.calls[0][0].scopeTarget).toBe(31)
  await f.flush()
  expect(f.focus).toHaveBeenLastCalledWith(f.rows[1].original)
  f.focus.mockClear()
  f.manager.focusNext()
  f.replace({ ...f.current(), scope: { _nativeTag: 31 } as unknown as View })
  await f.flush()
  expect(f.focus).not.toHaveBeenCalled()
  f.release()
})
it("scopes range navigation by native input ancestry while keeping initial focus independent of the active endpoint", async () => {
  const f = setup(),
    start = { _nativeTag: 31 } as unknown as View,
    end = { _nativeTag: 32 } as unknown as View
  f.replace({ ...f.current(), inputRoots: [start, end] })
  f.manager.focusNext()
  expect(f.read.mock.calls[0][0].inputRoots).toEqual([31, 32])
  await f.flush()
  f.manager.focusFirst()
  expect(f.read).toHaveBeenCalledTimes(1)
  expect(f.focus).toHaveBeenLastCalledWith(f.rows[0].original)
  await f.flush()
  f.focus.mockClear()
  f.manager.focusNext()
  f.replace({ ...f.current(), inputRoots: [end, start] })
  await f.flush()
  expect(f.focus).not.toHaveBeenCalled()
  f.release()
})

it("rejects native focus movement that has not yet reached the JS observer", async () => {
  const f = setup()
  f.response.focusedTarget = 25
  f.manager.focusFromInput(f.rows[0].original, "next")
  await f.flush()
  expect(f.focus).not.toHaveBeenCalled()
  f.release()
})

it("keeps input auto-advance through a value commit but invalidates placeholder-dependent background targeting", async () => {
  const f = setup(),
    root = f.current().root
  f.manager.focusFromInput(f.rows[0].original, "next")
  f.rows[0].isPlaceholder = false
  await f.flush()
  expect(f.focus).toHaveBeenCalledWith(f.extra)
  f.focus.mockClear()
  const hit = { _nativeTag: 29 } as unknown as View
  const press = f.manager.capturePress(hit)
  f.rows[1].isPlaceholder = false
  expect(press?.()).toBe(false)
  expect(f.focus).not.toHaveBeenCalled()
  expect(root).toBe(f.current().root)
  f.release()
})
