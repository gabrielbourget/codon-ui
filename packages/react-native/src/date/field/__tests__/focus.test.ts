import type { View } from "react-native"

import {
  NativeDateFieldFocusManager,
  nativeDateFieldPressIndex,
  nativeDateFieldVisualIndex,
  type TNativeDateFieldFocusSnapshot,
  type TNativeDateFieldRect,
} from "../focus"

const setup = (positions = [90, 40, 10]) => {
  const root = {} as View
  const rows = positions.map((_, index) => ({
    original: {} as View,
    isPlaceholder: true,
    identity: {
      ownerId: "field",
      segmentId: `segment:${index}`,
      bindingRevision: "wire:1",
      target: index + 10,
      nativeInstance: `sdk:${index}`,
      surfaceId: 11,
      windowId: "window:1",
      epoch: 1,
    },
  }))
  let current: TNativeDateFieldFocusSnapshot | null = { root, rootTarget: 3, rows }
  let focused: View | null = rows[0].original
  const requests: View[] = [],
    disabled = new Set<View>()
  const pending: Array<(value: TNativeDateFieldRect | null) => void> = []
  let deferred = false
  const native = {
    capture: (target: View) => (disabled.has(target) ? null : () => !disabled.has(target)),
    focused: () => focused,
    focus: (target: View) => {
      requests.push(target)
      return true
    },
    measure: (target: View) =>
      deferred
        ? new Promise<TNativeDateFieldRect | null>((resolve) => pending.push(resolve))
        : Promise.resolve({
            x: positions[rows.findIndex((row) => row.original === target)],
            y: 0,
            width: 20,
            height: 30,
          }),
  }
  const manager = new NativeDateFieldFocusManager(() => current, native)
  return {
    manager,
    rows,
    requests,
    disabled,
    native,
    current: () => current,
    replace: (value: typeof current) => {
      current = value
    },
    focused: (value: View | null) => {
      focused = value
    },
    defer: () => {
      deferred = true
    },
    resolve: (x = positions) =>
      pending.splice(0).forEach((resolve, index) => resolve({ x: x[index], y: 0, width: 20, height: 30 })),
  }
}
it("requests logical focus without wrapping or fabricating focus completion", () => {
  const value = setup()
  expect(value.manager.focusNext()).toBe(true)
  expect(value.requests).toEqual([value.rows[1].original])
  // A second request retains the real observed owner until a native callback.
  value.manager.focusNext()
  expect(value.requests).toEqual([value.rows[1].original, value.rows[1].original])
  value.focused(value.rows[2].original)
  expect(value.manager.focusNext()).toBe(false)
  expect(value.manager.focusPrevious()).toBe(true)
  expect(value.requests.at(-1)).toBe(value.rows[1].original)
})
it("keeps readonly/noneditable original segments eligible and omits only targets without native focus admission", () => {
  const value = setup()
  value.disabled.add(value.rows[1].original)
  value.manager.focusNext()
  expect(value.requests).toEqual([value.rows[2].original])
  value.focused(null)
  value.manager.focusPrevious()
  expect(value.requests.at(-1)).toBe(value.rows[2].original)
})
it("uses actual physical left edges for RTL, without reversing reading order", async () => {
  const value = setup([10, 90, 40])
  expect(await value.manager.focusVisual(1)).toBe(true)
  expect(value.requests).toEqual([value.rows[2].original])
  expect(await value.manager.focusVisual(-1)).toBe(false)
})
it.each([
  [[40, 10, 40], 10, 1, 0],
  [[90, 10, 40], 40, -1, 1],
  [[40, 40], 40, 1, -1],
  [[NaN, Infinity, 20], 10, 1, 2],
] as const)("matches source physical tie and direction selection %j", (positions, from, direction, expected) => {
  expect(nativeDateFieldVisualIndex(positions, from, direction)).toBe(expected)
})
it.each([
  [[true, true, true], null, 0],
  [[false, true, true], null, 1],
  [[true, false, true], null, 2],
  [[false, false, false], null, 2],
  [[true, true, false], 1, 0],
  [[false, true, true], 1, 1],
  [[], null, -1],
  [[true], -1, -1],
] as const)("preserves source placeholder press traversal %j", (placeholders, before, expected) => {
  expect(nativeDateFieldPressIndex(placeholders, before)).toBe(expected)
})
it.each(["instance", "epoch", "root", "reorder", "placeholder", "detach", "native-guard", "focus"])(
  "rejects asynchronous geometry after %s changes",
  async (change) => {
    const value = setup()
    value.defer()
    const request = value.manager.focusVisual(-1),
      current = value.current()!
    if (change === "instance")
      value.replace({
        ...current,
        rows: [current.rows[0], { ...current.rows[1], original: {} as View }, current.rows[2]],
      })
    if (change === "epoch")
      value.replace({
        ...current,
        rows: current.rows.map((row, index) =>
          index === 1 ? { ...row, identity: { ...row.identity, epoch: 2 } } : row,
        ),
      })
    if (change === "root") value.replace({ ...current, root: {} as View })
    if (change === "reorder") value.replace({ ...current, rows: [...current.rows].reverse() })
    if (change === "placeholder")
      value.replace({ ...current, rows: current.rows.map((row) => ({ ...row, isPlaceholder: false })) })
    if (change === "detach") value.replace(null)
    if (change === "native-guard") value.disabled.add(value.rows[2].original)
    if (change === "focus") value.focused(value.rows[1].original)
    value.resolve()
    expect(await request).toBe(false)
    expect(value.requests).toEqual([])
  },
)
it("rejects late geometry after another request or unmount and leaves original objects unchanged", async () => {
  const value = setup()
  value.defer()
  const request = value.manager.focusVisual(-1)
  value.manager.focusNext()
  value.resolve()
  expect(await request).toBe(false)
  expect(value.requests).toEqual([value.rows[1].original])
  const late = value.manager.focusVisual(-1)
  value.manager.retire()
  value.resolve()
  expect(await late).toBe(false)
  expect(value.manager.focusFirst()).toBe(false)
  expect(Object.keys(value.rows[0].original)).toEqual([])
})
it("keeps the captured root and segment identity immutable across render-owned mutation", async () => {
  const value = setup()
  value.defer()
  const request = value.manager.focusVisual(-1)
  value.rows[1].identity.epoch = 9
  value.resolve()
  expect(await request).toBe(false)
  expect(value.requests).toEqual([])
})
it("focuses the source's final contiguous placeholder run from the original predecessor", () => {
  const value = setup()
  value.rows[0].isPlaceholder = false
  value.manager.focusFromPress(null)
  expect(value.requests).toEqual([value.rows[1].original])
  expect(value.manager.focusFromPress({} as View)).toBe(false)
})

it.each(["owner", "window", "duplicate-object", "duplicate-id"])(
  "rejects malformed original field membership: %s",
  (change) => {
    const value = setup()
    if (change === "owner") value.rows[1].identity.ownerId = "foreign"
    if (change === "window") value.rows[1].identity.windowId = "foreign"
    if (change === "duplicate-object") value.rows[1].original = value.rows[0].original
    if (change === "duplicate-id") value.rows[1].identity.segmentId = value.rows[0].identity.segmentId
    expect(value.manager.focusNext()).toBe(false)
    expect(value.requests).toEqual([])
  },
)
it("rejects geometry when the renderer mutates the captured root snapshot in place", async () => {
  const value = setup(),
    snapshot = { ...value.current()! }
  value.replace(snapshot)
  value.defer()
  const request = value.manager.focusVisual(-1)
  snapshot.root = {} as View
  value.resolve()
  expect(await request).toBe(false)
  expect(value.requests).toEqual([])
})
