import { PlatformColor, processColor, type View } from "react-native"

import { NativeMotionColorSampler, registerNativeMotionColorSampler } from "../../input/motionColors"
import type { NativeMotionColors } from "../../input/specs/CUIFocusViewNativeComponent"
import type { TNativeMotionResolutionToken } from "../value"
import { createNativeMotionValueContext } from "../value/nativeContext"

// Source bridge model only. These packets are fixture data, not native observations.
const harness = () => {
  const view = {} as View
  let current: View | null = view,
    active = true
  const callbacks = new Set<() => void>(),
    dispatch = jest.fn()
  const sampler = new NativeMotionColorSampler({
    ownerId: "color-owner",
    target: () => 11,
    scope: () => ({ ownerId: "scope", windowId: "window", epoch: 2 }),
    dispatch,
  })
  const release = registerNativeMotionColorSampler(view, sampler)
  const token: TNativeMotionResolutionToken = {
    isCurrent: () => active,
    onCancel: (callback) => {
      callbacks.add(callback)
      return () => {
        callbacks.delete(callback)
      }
    },
  }
  const context = createNativeMotionValueContext({
    isCurrent: () => active,
    target: () => current,
    readValue: () => undefined,
  })
  const receive = (changes: Partial<NativeMotionColors>) =>
    sampler.receive({
      ownerId: "color-owner",
      target: 11,
      kind: "environment",
      requestId: "",
      windowId: "window",
      scopeOwnerId: "scope",
      epoch: 2,
      environmentRevision: 3,
      attached: true,
      colors: "[]",
      error: "",
      observedAt: 100,
      ...changes,
    })
  return {
    context,
    token,
    dispatch,
    release,
    receive,
    view,
    callbacks,
    replace: () => {
      current = {} as View
    },
    retire: () => {
      active = false
      callbacks.forEach((callback) => callback())
    },
  }
}
it("passes actual registry identity and native processed opaque descriptors through the production adapter", async () => {
  const h = harness(),
    opaque = PlatformColor("labelColor")
  const pending = h.context.resolveColors!([opaque, "red"], h.token)
  h.receive({ requestId: h.dispatch.mock.calls[0][0] })
  const [id, json] = h.dispatch.mock.calls[1]
  expect(JSON.parse(json).colors).toEqual([processColor(opaque), processColor("red")])
  h.receive({
    kind: "sample",
    requestId: id,
    colors: JSON.stringify([
      [0.25, 0.5, 0.75, 0.5],
      [1, 0, 0, 1],
    ]),
  })
  await expect(pending).resolves.toEqual(["rgba(63.75, 127.5, 191.25, 0.5)", "rgba(255, 0, 0, 1)"])
  expect(h.callbacks.size).toBe(0)
  h.release()
})
it("cancels the registered sampler when a value resolution token retires", async () => {
  jest.useFakeTimers()
  try {
    const h = harness(),
      pending = h.context.resolveColors!(["red"], h.token),
      failure = expect(pending).rejects.toThrow(/cancelled/)
    expect(jest.getTimerCount()).toBe(1)
    h.retire()
    await failure
    expect(jest.getTimerCount()).toBe(0)
    expect(h.callbacks.size).toBe(0)
    h.release()
  } finally {
    jest.useRealTimers()
  }
})
it("rejects an otherwise valid response after the actual target ref changes", async () => {
  const h = harness(),
    pending = h.context.resolveColors!(["red"], h.token),
    failure = expect(pending).rejects.toThrow(/retired/)
  h.receive({ requestId: h.dispatch.mock.calls[0][0] })
  const id = h.dispatch.mock.calls[1][0]
  h.replace()
  h.receive({ kind: "sample", requestId: id, colors: "[[1,0,0,1]]" })
  await failure
  h.release()
})
