import { NativeMotionLayoutCallbacks } from "../projection/layoutCallbacks"
import type { Box } from "../projection/types"

const box = (): Box => Object.freeze({ x: Object.freeze({ min: 1, max: 2 }), y: Object.freeze({ min: 3, max: 4 }) })

it("retains the pinned three undefined before-measure slots despite the public box declaration", () => {
  const callback = jest.fn((_box: Box) => {})
  const events = new NativeMotionLayoutCallbacks()
  events.update({ onBeforeLayoutMeasure: callback })
  events.notify("BeforeLayoutMeasure")
  expect(callback.mock.calls).toEqual([[undefined, undefined, undefined]])
})

it("passes the original current/previous boxes and the pinned third undefined slot", () => {
  const callback = jest.fn((_current: Box, _previous: Box) => {})
  const current = box(),
    previous = box()
  const events = new NativeMotionLayoutCallbacks()
  events.update({ onLayoutMeasure: callback })
  events.notify("LayoutMeasure", current, previous)
  expect(callback.mock.calls).toEqual([[current, previous, undefined]])
  expect(callback.mock.calls[0][0]).toBe(current)
  expect(callback.mock.calls[0][1]).toBe(previous)
})

it("preserves an absent previous box rather than inventing a public-declaration value", () => {
  const callback = jest.fn((_current: Box, _previous: Box) => {})
  const current = box()
  const events = new NativeMotionLayoutCallbacks()
  events.update({ onLayoutMeasure: callback })
  events.notify("LayoutMeasure", current)
  expect(callback.mock.calls).toEqual([[current, undefined, undefined]])
})

it("replaces and removes committed callbacks without replaying the former handlers", () => {
  const old = jest.fn(),
    next = jest.fn()
  const events = new NativeMotionLayoutCallbacks()
  events.update({ onBeforeLayoutMeasure: old, onLayoutMeasure: old })
  events.update({ onBeforeLayoutMeasure: next })
  events.notify("BeforeLayoutMeasure")
  events.notify("LayoutMeasure", box(), box())
  expect(old).not.toHaveBeenCalled()
  expect(next).toHaveBeenCalledTimes(1)
  events.update({})
  events.notify("BeforeLayoutMeasure")
  expect(next).toHaveBeenCalledTimes(1)
})

it("clears handlers on retirement and ignores unrelated visual events", () => {
  const callback = jest.fn()
  const events = new NativeMotionLayoutCallbacks()
  events.update({ onBeforeLayoutMeasure: callback, onLayoutMeasure: callback })
  events.notify("Update", box())
  events.clear()
  events.notify("BeforeLayoutMeasure")
  events.notify("LayoutMeasure", box(), box())
  expect(callback).not.toHaveBeenCalled()
})
