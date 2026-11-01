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
  let current = { root, owned: { root, rootTarget: 3, rows }, participants: [ref] }
  const focus = jest.fn((_target: View | null) => true)
  const disabled = new Set<View>()
  const response = {
    rootTarget: 3,
    windowId: "window",
    before: null as number | null,
    rows: [
      { target: 10, eligible: true, tabStop: true, x: 20 },
      { target: 25, eligible: true, tabStop: true, x: 40 },
      { target: 11, eligible: true, tabStop: true, x: 60 },
    ],
  }
  const read = jest.fn(async () => JSON.stringify(response))
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
      f.focus.mockClear()
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
