import type { View } from "react-native"

import { createNativeToasterFocus } from "../focus"

const fixture = () => {
  const prior = {} as View,
    stack = {} as View,
    child = {} as View,
    outside = {} as View
  let current: View | null = prior,
    previous: View | null = prior,
    allowed = true,
    lifetime = "window:1",
    targetLive = true
  const pending = new Map<number, () => void>()
  let serial = 0
  const request = jest.fn(() => true)
  const focus = createNativeToasterFocus({
    current: () => current,
    previous: () => previous,
    canAct: () => allowed,
    lifetime: () => lifetime,
    isLiveTarget: () => targetLive,
    lease: () => {
      const captured = lifetime
      return () => targetLive && captured === lifetime
    },
    canCaptureUnmatched: () => true,
    tag: () => 17,
    request,
    schedule: (callback) => {
      const id = ++serial
      pending.set(id, callback)
      return id
    },
    cancel: (id) => {
      pending.delete(id)
    },
  })
  focus.register(stack)
  return {
    prior,
    stack,
    child,
    outside,
    focus,
    request,
    pending,
    current: (value: View | null) => {
      current = value
    },
    previous: (value: View | null) => {
      previous = value
    },
    block: () => {
      allowed = false
    },
    allow: () => {
      allowed = true
    },
    retire: () => {
      lifetime = "window:2"
    },
    remove: () => {
      targetLive = false
    },
    flush: () => {
      for (const callback of [...pending.values()]) callback()
      pending.clear()
    },
  }
}
it("CAP.toaster.006 captures the matching actual target but waits for acknowledged entry before restoring", () => {
  const f = fixture()
  f.focus.capture(17)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(f.outside)
  f.focus.changed()
  f.flush()
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.request).toHaveBeenCalledWith(f.prior)
  f.focus.changed()
  f.flush()
  expect(f.request).toHaveBeenCalledTimes(1)
})
it("NATIVE.toaster.focus.001 rejects a mismatched native focused tag", () => {
  const f = fixture()
  f.previous(null)
  f.focus.capture(99)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.002 keeps internal blur/focus handoffs and repeated expansion on the original owner", () => {
  const f = fixture()
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  expect(f.pending.size).toBe(1)
  f.current(f.child)
  f.focus.enter(f.child)
  expect(f.pending.size).toBe(0)
  f.focus.capture(17)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
  f.current(f.outside)
  f.focus.changed()
  f.flush()
  expect(f.request).toHaveBeenCalledWith(f.prior)
})
it.each(["block", "retire", "remove"] as const)("NATIVE.toaster.focus.003 refuses restoration after %s", (change) => {
  const f = fixture()
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  f[change]()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.004 invalidates an old window before a later return to the same owner", () => {
  const f = fixture()
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.focus.invalidate()
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.005 restores once on Toaster-only disposal and retires a saved scheduled frame", () => {
  const f = fixture()
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  const stale = [...f.pending.values()][0]
  f.focus.dispose()
  f.focus.dispose()
  stale()
  expect(f.request).toHaveBeenCalledTimes(1)
  expect(f.pending.size).toBe(0)
})
it("NATIVE.toaster.focus.006 appearing without focus never restores or requests focus", () => {
  const f = fixture()
  f.focus.changed()
  f.focus.dispose()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.007 excludes nondismissable self-focus while allowing its descendants", () => {
  const f = fixture()
  f.focus.register(f.stack, () => false)
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
  f.previous(f.stack)
  f.current(f.child)
  f.focus.enter(f.child)
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).toHaveBeenCalledWith(f.stack)
})
it("NATIVE.toaster.focus.008 stale registration cleanup cannot remove a replacement membership", () => {
  const f = fixture(),
    release = f.focus.register(f.child)
  f.focus.register(f.child)
  release()
  f.focus.capture(17)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(f.child)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.012 an unmatched replacement capture clears an unentered old owner", () => {
  const f = fixture()
  f.focus.capture(17)
  f.focus.capture(99)
  f.previous(null)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
it("NATIVE.toaster.focus.013 window loss discards capture before entry even if the window later returns", () => {
  const f = fixture()
  f.focus.capture(17)
  f.block()
  f.focus.changed()
  f.allow()
  f.previous(null)
  f.current(f.stack)
  f.focus.enter(f.stack)
  f.current(null)
  f.focus.changed()
  f.flush()
  expect(f.request).not.toHaveBeenCalled()
})
