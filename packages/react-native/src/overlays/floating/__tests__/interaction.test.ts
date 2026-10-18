import type { GestureResponderEvent } from "react-native"

import { createNativeFloatingInteractions } from "../interaction"
import type { TNativeFloatingFocusEvent } from "../interaction"
import { createNativeFloatingLayerRegistry } from "../registry"

const touch = (identifier = "1", stopped = false) =>
  ({
    nativeEvent: { identifier },
    target: 17,
    persist: jest.fn(),
    isPropagationStopped: () => stopped,
  }) as unknown as GestureResponderEvent
const focus = (stopped = false) =>
  ({
    nativeEvent: { target: 23 },
    target: 23,
    persist: jest.fn(),
    isPropagationStopped: () => stopped,
  }) as unknown as TNativeFloatingFocusEvent
const setup = () => {
  const registry = createNativeFloatingLayerRegistry()
  const onOutside = jest.fn()
  const onDismiss = jest.fn()
  const lease = registry.register("layer", {
    parent: null,
    isOpen: true,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss,
    onOutside,
  })
  lease.entered(lease.state().generation)
  const deferred: (() => void)[] = []
  const interactions = createNativeFloatingInteractions(registry.captureOutside, (work) => {
    deferred.push(work)
  })
  const flush = () => {
    for (const work of deferred.splice(0)) work()
  }
  return { registry, lease, onOutside, onDismiss, interactions, flush }
}

it("delivers the original typed native end event once after a wholly outside gesture", () => {
  const f = setup()
  const start = touch(),
    end = touch()
  f.interactions.start(start)
  f.flush()
  f.interactions.end(end)
  f.flush()
  expect(start.persist).toHaveBeenCalledTimes(1)
  expect(end.persist).toHaveBeenCalledTimes(1)
  expect(f.onOutside).toHaveBeenCalledWith({ target: 17, event: end })
  expect(f.onOutside.mock.calls[0]?.[0].event).toBe(end)
  expect(f.onDismiss).not.toHaveBeenCalled()
  f.interactions.end(end)
  f.flush()
  expect(f.onOutside).toHaveBeenCalledTimes(1)
})

it.each(["start", "end"] as const)("does not dismiss when the %s event belongs inside the layer", (stage) => {
  const f = setup()
  const start = touch(),
    end = touch()
  f.interactions.start(start)
  if (stage === "start") f.interactions.mark("layer", start)
  f.flush()
  f.interactions.end(end)
  if (stage === "end") f.interactions.mark("layer", end)
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
})

it("ignores cancelled gestures and queued work after host disposal", () => {
  const f = setup()
  f.interactions.start(touch())
  f.flush()
  f.interactions.cancel(touch())
  f.interactions.end(touch())
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
  f.interactions.start(touch())
  f.interactions.dispose()
  f.flush()
  f.interactions.end(touch())
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
})

it("does not apply a prior gesture to a replaced presentation", () => {
  const f = setup()
  f.interactions.start(touch())
  f.flush()
  f.lease.unregister()
  const replacement = f.registry.register("layer", {
    parent: null,
    isOpen: true,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: f.onDismiss,
    onOutside: f.onOutside,
  })
  replacement.entered(replacement.state().generation)
  f.interactions.end(touch())
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
})

it("keeps gestures isolated and respects stopped propagation without inventing an inside target", () => {
  const f = setup()
  const first = touch("first"),
    second = touch("second")
  f.interactions.start(first)
  f.interactions.mark("layer", first)
  f.interactions.start(second)
  f.flush()
  f.interactions.end(touch("first"))
  f.interactions.end(touch("second", true))
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
})

it("reads the latest outside veto/callback without optimistically closing controlled state", () => {
  const f = setup()
  const next = jest.fn()
  f.interactions.start(touch())
  f.flush()
  f.lease.update({
    parent: null,
    isOpen: true,
    isModal: true,
    isKeyboardDismissDisabled: false,
    onDismiss: f.onDismiss,
    onOutside: next,
  })
  f.interactions.end(touch())
  f.flush()
  expect(next).toHaveBeenCalledTimes(1)
  expect(f.onOutside).not.toHaveBeenCalled()
  expect(f.lease.state().active).toBe(true)
})

it("honors cancellation before queued start processing", () => {
  const f = setup()
  f.interactions.start(touch())
  f.interactions.cancel(touch())
  f.interactions.end(touch())
  f.flush()
  expect(f.onOutside).not.toHaveBeenCalled()
})

it("keeps completed gestures distinct when a native identifier is reused in one dispatch batch", () => {
  const f = setup()
  const firstEnd = touch(),
    secondEnd = touch()
  f.interactions.start(touch())
  f.interactions.end(firstEnd)
  f.interactions.end(firstEnd)
  f.interactions.start(touch())
  f.interactions.end(secondEnd)
  f.flush()
  expect(f.onOutside.mock.calls.map(([record]) => record.event)).toEqual([firstEnd, secondEnd])
})

it("delivers the original newly focused native target after descendant capture", () => {
  const f = setup()
  const event = focus()
  f.interactions.focus(event)
  expect(f.onOutside).not.toHaveBeenCalled()
  f.flush()
  expect(event.persist).toHaveBeenCalledTimes(1)
  expect(f.onOutside).toHaveBeenCalledWith({ target: 23, event, kind: "focus" })
  expect(f.onOutside.mock.calls[0]?.[0].event).toBe(event)
})

it.each(["inside", "stopped", "disposed", "retired"] as const)(
  "ignores %s focus delivery without fabricating a related target",
  (reason) => {
    const f = setup()
    const event = focus(reason === "stopped")
    f.interactions.focus(event)
    if (reason === "inside") f.interactions.mark("layer", event)
    if (reason === "disposed") f.interactions.dispose()
    if (reason === "retired") f.lease.unregister()
    f.flush()
    expect(f.onOutside).not.toHaveBeenCalled()
  },
)
