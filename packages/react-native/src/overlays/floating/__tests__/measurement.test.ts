import { createNativeFloatingMeasurement, type TNativeFloatingMeasurable } from "../measurement"

type TCallback = Parameters<TNativeFloatingMeasurable["measureInWindow"]>[0]
const target = () => {
  const callbacks: TCallback[] = []
  const node: TNativeFloatingMeasurable = {
    measureInWindow: jest.fn((callback) => {
      callbacks.push(callback)
    }),
  }
  return { ref: { current: node as TNativeFloatingMeasurable | null }, callbacks, node }
}
const setup = () => {
  const host = target(),
    anchor = target(),
    content = target()
  const refs = { host: host.ref, anchor: anchor.ref, content: content.ref }
  return { host, anchor, content, refs, controller: createNativeFloatingMeasurement(), publish: jest.fn() }
}
const complete = (fixture: ReturnType<typeof setup>, index = 0) => {
  fixture.host.callbacks[index]!(100, 200, 300, 400)
  fixture.anchor.callbacks[index]!(120, 240, 40, 20)
  fixture.content.callbacks[index]!(0, 0, 80, 60)
}

it("publishes one complete native batch despite callback order and duplicate delivery", () => {
  const f = setup()
  const boundary = target()
  expect(f.controller.read({ ...f.refs, boundary: boundary.ref }, () => true, f.publish)).toBe(true)
  f.content.callbacks[0]!(0, 0, 80, 60)
  f.content.callbacks[0]!(0, 0, 80, 60)
  f.anchor.callbacks[0]!(120, 240, 40, 20)
  f.host.callbacks[0]!(100, 200, 300, 400)
  expect(f.publish).not.toHaveBeenCalled()
  boundary.callbacks[0]!(110, 220, 250, 350)
  expect(f.publish.mock.calls).toEqual([
    [
      {
        host: { x: 100, y: 200, width: 300, height: 400 },
        anchor: { x: 120, y: 240, width: 40, height: 20 },
        content: { x: 0, y: 0, width: 80, height: 60 },
        boundary: { x: 110, y: 220, width: 250, height: 350 },
      },
    ],
  ])
  expect(f.controller.isPending()).toBe(false)
})

it("preserves measured zero dimensions and signed coordinates without a screen fallback", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.host.callbacks[0]!(-0, -20, 0, 0)
  f.anchor.callbacks[0]!(-5, -4, 0, 0)
  f.content.callbacks[0]!(0, 0, 0, 0)
  expect(f.publish.mock.calls[0]?.[0]).toMatchObject({
    host: { x: -0, y: -20, width: 0, height: 0 },
    content: { width: 0, height: 0 },
  })
})

it("allows only one pending native batch", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  expect(f.controller.read(f.refs, () => true, f.publish)).toBe(false)
  expect(f.host.node.measureInWindow).toHaveBeenCalledTimes(1)
  complete(f)
  expect(f.publish).toHaveBeenCalledTimes(1)
})

it("retires a batch when any native instance is replaced", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.anchor.ref.current = target().node
  complete(f)
  expect(f.publish).not.toHaveBeenCalled()
  expect(f.controller.isPending()).toBe(false)
})

it("replaces a pending batch when a ref detaches without delivering its old callback", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.anchor.ref.current = null
  expect(f.controller.read(f.refs, () => true, f.publish)).toBe(false)
  expect(f.controller.isPending()).toBe(false)
  const replacement = target()
  f.anchor.ref.current = replacement.node
  expect(f.controller.read(f.refs, () => true, f.publish)).toBe(true)
  f.host.callbacks[1]!(0, 0, 300, 400)
  replacement.callbacks[0]!(40, 50, 20, 10)
  f.content.callbacks[1]!(0, 0, 80, 60)
  expect(f.publish).toHaveBeenCalledTimes(1)
})

it("replaces pending ref objects while ignoring their still-live old native instances", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  const replacement = target()
  expect(f.controller.read({ ...f.refs, anchor: replacement.ref }, () => true, f.publish)).toBe(true)
  complete(f)
  expect(f.publish).not.toHaveBeenCalled()
  f.host.callbacks[1]!(0, 0, 300, 400)
  replacement.callbacks[0]!(50, 40, 10, 20)
  f.content.callbacks[1]!(0, 0, 80, 60)
  expect(f.publish).toHaveBeenCalledTimes(1)
})

it("ignores an old generation without cancelling its replacement batch", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.controller.invalidate()
  f.controller.read(f.refs, () => true, f.publish)
  complete(f, 0)
  expect(f.publish).not.toHaveBeenCalled()
  expect(f.controller.isPending()).toBe(true)
  complete(f, 1)
  expect(f.publish).toHaveBeenCalledTimes(1)
})

it("retires callbacks when the owning window/open generation loses eligibility", () => {
  const f = setup()
  let active = true
  f.controller.read(f.refs, () => active, f.publish)
  active = false
  complete(f)
  expect(f.publish).not.toHaveBeenCalled()
  expect(f.controller.isPending()).toBe(false)
})

it("does not measure an unresolved caller-owned boundary", () => {
  const f = setup()
  expect(f.controller.read({ ...f.refs, boundary: { current: null } }, () => true, f.publish)).toBe(false)
  expect(f.host.node.measureInWindow).not.toHaveBeenCalled()
})

it.each([
  [NaN, 0, 1, 1],
  [0, Infinity, 1, 1],
  [0, 0, -1, 1],
  [1e308, 0, 1e308, 1],
])("rejects invalid native bounds %j/%j/%j/%j without publishing partial coordinates", (x, y, width, height) => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.host.callbacks[0]!(x, y, width, height)
  complete(f)
  expect(f.publish).not.toHaveBeenCalled()
  expect(f.controller.isPending()).toBe(false)
})

it("retires pending callbacks and future reads on disposal", () => {
  const f = setup()
  f.controller.read(f.refs, () => true, f.publish)
  f.controller.dispose()
  complete(f)
  expect(f.publish).not.toHaveBeenCalled()
  expect(f.controller.read(f.refs, () => true, f.publish)).toBe(false)
})

it("preserves a thrown native measurement error and clears pending ownership", () => {
  const f = setup()
  f.host.node.measureInWindow = () => {
    throw new Error("native measurement failure")
  }
  expect(() => f.controller.read(f.refs, () => true, f.publish)).toThrow("native measurement failure")
  expect(f.controller.isPending()).toBe(false)
})
