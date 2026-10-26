import type { EmblaCarouselType } from "../engine/EmblaCarousel"
import type { TNativeCarouselPointerEvent } from "../engine/nativeEnvironment"
import type { EmblaOptionsType } from "../engine/Options"

import { browserEngineFixture, engineFixture } from "./engineHarness"

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.clearAllTimers()
  jest.useRealTimers()
  jest.restoreAllMocks()
})
const read = (api: EmblaCarouselType) => {
  const engine = api.internalEngine()
  return {
    selected: api.selectedScrollSnap(),
    previous: api.previousScrollSnap(),
    canNext: api.canScrollNext(),
    canPrev: api.canScrollPrev(),
    snaps: api.scrollSnapList(),
    progress: api.scrollProgress(),
    loop: engine.options.loop,
    rawSnaps: engine.scrollSnaps,
    slideRegistry: engine.slideRegistry,
    target: engine.target.get(),
    location: engine.location.get(),
    previousLocation: engine.previousLocation.get(),
    offsetLocation: engine.offsetLocation.get(),
  }
}
const cases: EmblaOptionsType[] = ["x", "y"].flatMap((axis) =>
  ["start", "center", "end"].flatMap((align) =>
    [false, true].flatMap((loop) =>
      [1, 2, "auto"].map((slidesToScroll) => ({ axis, align, loop, slidesToScroll }) as EmblaOptionsType),
    ),
  ),
)
it.each(cases)("preserves the installed source engine commands and scroll state for %j", (options) => {
  const native = engineFixture([180, 120, 240, 160, 200, 110], options)
  const source = browserEngineFixture([180, 120, 240, 160, 200, 110], options)
  expect(Object.keys(native.api).sort()).toEqual(Object.keys(source).sort())
  expect(read(native.api)).toEqual(read(source))
  for (const index of [3, -1, 20, 0, 2]) {
    native.api.scrollTo(index, true)
    source.scrollTo(index, true)
    expect(read(native.api)).toEqual(read(source))
  }
  for (const method of ["scrollNext", "scrollNext", "scrollPrev"] as const) {
    native.api[method](true)
    source[method](true)
    expect(read(native.api)).toEqual(read(source))
  }
  for (const next of [
    { startIndex: 2 },
    { containScroll: "keepSnaps", loop: false },
    { active: false },
    { active: true, align: (viewSize, snapSize) => (viewSize - snapSize) * 0.3 },
  ] as EmblaOptionsType[]) {
    native.api.reInit(next)
    source.reInit(next)
    expect(read(native.api)).toEqual(read(source))
  }
  source.destroy()
  native.api.destroy()
})

it.each([[], [100], [300], [180, 120]])("retains source empty/short-track state and loop fallback: %j", (...sizes) => {
  const native = engineFixture(sizes, { loop: true }),
    source = browserEngineFixture(sizes, { loop: true })
  expect(read(native.api)).toEqual(read(source))
  native.api.scrollNext(true)
  source.scrollNext(true)
  expect(read(native.api)).toEqual(read(source))
  native.api.destroy()
  source.destroy()
})

it("keeps original hosts, all raw events, plugin lifecycle and explicit reInit semantics", () => {
  const native = engineFixture([300, 300, 300])
  const { api } = native
  expect(api.rootNode()).toBe(native.root.binding.node)
  expect(api.containerNode()).toBe(native.container.binding.node)
  expect(api.slideNodes()).toEqual(native.slides.map(({ binding }) => binding.node))
  const calls: unknown[][] = [],
    callback = (api: EmblaCarouselType, name: string) => {
      calls.push([api, name])
    }
  for (const name of [
    "init",
    "pointerDown",
    "pointerUp",
    "slidesChanged",
    "slidesInView",
    "scroll",
    "select",
    "settle",
    "destroy",
    "reInit",
    "resize",
    "slideFocusStart",
    "slideFocus",
  ] as const) {
    api.on(name, callback)
    api.emit(name)
    api.off(name, callback)
  }
  expect(calls).toHaveLength(13)
  expect(calls.every(([owner]) => owner === api)).toBe(true)
  const plugin = { name: "owner", options: {}, init: jest.fn(), destroy: jest.fn() }
  api.reInit({}, [plugin])
  expect(api.plugins().owner).toBe(plugin)
  expect(plugin.init.mock.calls[0][0]).toBe(api)
  api.scrollTo(2, true)
  api.reInit({ align: "end" })
  expect(api.selectedScrollSnap()).toBe(2)
  expect(plugin.destroy).toHaveBeenCalledTimes(1)
  api.destroy()
  api.destroy()
  expect(plugin.destroy).toHaveBeenCalledTimes(2)
  expect(native.frames.size).toBe(0)
})

it("pauses frames on hidden windows, resumes owner commands, and retires destroyed work", () => {
  const fixture = engineFixture([300, 300, 300])
  fixture.api.scrollTo(2)
  fixture.advance(4)
  const before = fixture.api.internalEngine().location.get()
  fixture.visible(false)
  fixture.advance(20)
  expect(fixture.api.internalEngine().location.get()).toBe(before)
  fixture.api.scrollTo(1)
  expect(fixture.api.selectedScrollSnap()).toBe(1)
  fixture.visible(true)
  fixture.advance(120)
  expect(fixture.api.internalEngine().location.get()).toBeCloseTo(-300)
  fixture.api.destroy()
  fixture.advance(3)
  expect(fixture.frames.size).toBe(0)
})

it("re-evaluates native window breakpoints and filters plugins without a browser facade", () => {
  const fixture = engineFixture([300, 300, 300])
  const plugin = {
    name: "narrow",
    options: {
      breakpoints: { wide: { when: (state: { width: number }) => state.width >= 600, options: { active: false } } },
    },
    init: jest.fn(),
    destroy: jest.fn(),
  }
  fixture.api.reInit({ breakpoints: { wide: { when: (state) => state.width >= 600, options: { loop: true } } } }, [
    plugin,
  ])
  expect(plugin.init).toHaveBeenCalledTimes(1)
  fixture.window({ width: 800 })
  expect(fixture.api.internalEngine().options.loop).toBe(true)
  expect(plugin.destroy).toHaveBeenCalled()
  fixture.api.destroy()
})

it.each(["mouse", "touch", "pen"])(
  "routes original %s packets, pointer identity, watchDrag and source snap selection",
  (pointerType) => {
    const fixture = engineFixture([300, 300, 300])
    const watch = jest.fn(() => true),
      down = jest.fn(),
      up = jest.fn()
    fixture.api.reInit({ watchDrag: watch })
    fixture.api.on("pointerDown", down).on("pointerUp", up)
    const event = (pageX: number, timeStamp: number, pointerId = 1) =>
      ({
        nativeEvent: { pointerId, pointerType, pageX, pageY: 20, button: 0, buttons: 1, isPrimary: true },
        timeStamp,
        target: fixture.root.binding.node,
      }) as unknown as TNativeCarouselPointerEvent
    const start = event(250, 0)
    fixture.root.source.emit("pointerDown", start)
    expect(watch.mock.calls[0]).toEqual([fixture.api, start])
    expect(down).toHaveBeenCalledTimes(1)
    fixture.events.emit("pointerMove", event(20, 20, 2))
    expect(fixture.api.internalEngine().target.get()).toBe(0)
    fixture.events.emit("pointerMove", event(20, 20))
    expect(fixture.api.internalEngine().dragHandler.shouldClaim(20, 20, 1)).toBe(true)
    expect(fixture.api.internalEngine().dragHandler.shouldClaim(20, 20, 2)).toBe(false)
    fixture.events.emit("pointerUp", event(20, 40))
    expect(up).toHaveBeenCalledTimes(1)
    expect(fixture.api.selectedScrollSnap()).toBe(1)
    fixture.advance(120)
    expect(fixture.api.internalEngine().location.get()).toBeCloseTo(-300)
    fixture.api.destroy()
  },
)

it("honors drag refusal, original native editable targets and inactive-window retirement", () => {
  const fixture = engineFixture([300, 300])
  const packet = {
    nativeEvent: { pointerId: 1, pointerType: "touch", pageX: 20, pageY: 10, button: 0, buttons: 1, isPrimary: true },
    timeStamp: 0,
    target: fixture.root.binding.node,
  } as unknown as TNativeCarouselPointerEvent
  fixture.api.reInit({ watchDrag: () => false })
  fixture.root.source.emit("pointerDown", packet)
  expect(fixture.api.internalEngine().dragHandler.pointerDown()).toBe(false)
  fixture.api.reInit({ watchDrag: true })
  fixture.root.source.emit("pointerDown", {
    ...packet,
    target: { tagName: "CUIDateSegment" },
  } as unknown as TNativeCarouselPointerEvent)
  expect(fixture.api.internalEngine().dragHandler.pointerDown()).toBe(false)
  fixture.root.source.emit("pointerDown", packet)
  expect(fixture.api.internalEngine().dragHandler.pointerDown()).toBe(true)
  fixture.visible(false)
  expect(fixture.api.internalEngine().dragHandler.pointerDown()).toBe(false)
  fixture.api.destroy()
})

it("queries measured in-view hosts and retires geometry observations without idle polling", () => {
  const fixture = engineFixture([300, 300, 300])
  expect(fixture.api.slidesInView()).toEqual([])
  fixture.advance(3)
  expect(fixture.api.slidesInView()).toEqual([0, 1])
  expect(fixture.api.slidesNotInView()).toEqual([2])
  fixture.api.scrollTo(2, true)
  fixture.advance(3)
  expect(fixture.api.slidesInView()).toEqual([1, 2])
  expect(fixture.api.slidesNotInView()).toEqual([0])
  expect(fixture.frames.size).toBe(0)
  fixture.api.destroy()
})

it("uses explicit native node selectors and preserves plugin and custom-node object identities", () => {
  const fixture = engineFixture([300, 300, 300])
  const container = fixture.environment.nodes().container
  fixture.api.reInit({ container: () => container, slides: () => [fixture.slides[1].binding] })
  expect(fixture.api.containerNode()).toBe(container.node)
  expect(fixture.api.slideNodes()).toEqual([fixture.slides[1].binding.node])
  expect(fixture.api.internalEngine().options.slides).toEqual(expect.any(Function))
  fixture.api.destroy()
})

it.each([-0.1, 1.1, NaN, Infinity])(
  "rejects invalid observer threshold %s before scheduling native work",
  (inViewThreshold) => {
    expect(() => engineFixture([300], { inViewThreshold })).toThrow(RangeError)
  },
)
